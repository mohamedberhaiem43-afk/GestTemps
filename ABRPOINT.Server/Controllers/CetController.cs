using ABRPOINT.Server.Authorization;
using ABRPOINT.Server.CalculService.Conge;
using ABRPOINT.Server.CalculService.Rtt;
using ABRPOINT.Server.Data;
using ABRPOINT.Server.Interfaces;
using ABRPOINT.Server.Models;
using ABRPOINT.Server.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;

namespace ABRPOINT.Server.Controllers
{
    /// <summary>
    /// Compte Épargne Temps (CET) — application de la règle :
    ///   Les congés payés non pris à la date limite paramétrée (par défaut 31-05) sont
    ///   automatiquement transférés vers le CET, dans la limite du plafond paramétré
    ///   (par défaut 10 jours).
    ///
    /// Date et plafond sont stockés sur Parametre (Parcetdatelim, Parcetmaxjours) au
    /// niveau de chaque société, modifiables via PUT /api/cet/parametres.
    /// </summary>
    [Route("api/[controller]")]
    [ApiController]
    [Authorize]
    public class CetController : ControllerBase
    {
        private readonly ApplicationDbContext _db;
        private readonly ICongeCalculationService _congeCalc;
        private readonly IRttCalculationService _rttService;
        // Notifications best-effort (push/in-app + email) — un échec downstream ne doit
        // jamais faire échouer l'action métier déjà persistée. Pattern repris de
        // TeletravailController : champs nullable + try/catch autour de chaque envoi.
        private readonly IUserNotificationService? _notify;
        private readonly IEmailService? _email;
        private readonly ILogger<CetController>? _log;

        public CetController(ApplicationDbContext db, ICongeCalculationService congeCalc, IRttCalculationService rttService,
            IUserNotificationService? notify = null, IEmailService? email = null, ILogger<CetController>? log = null)
        {
            _db = db;
            _congeCalc = congeCalc;
            _rttService = rttService;
            _notify = notify;
            _email = email;
            _log = log;
        }

        public sealed class CetParametersDto
        {
            public string Soccod { get; set; } = string.Empty;
            /// <summary>"DD-MM" — date limite annuelle (ex: "31-05").</summary>
            public string? Datelim { get; set; }
            /// <summary>Plafond CET annuel en jours (ex: 10).</summary>
            public float? Maxjours { get; set; }
            /// <summary>Les demandes d'alimentation du CET exigent-elles une validation ? (défaut true)</summary>
            public bool? RequireValidation { get; set; }
        }

        public sealed class CetTransferLine
        {
            public string Empcod { get; set; } = string.Empty;
            public float SoldeAvant { get; set; }
            public float Transferes { get; set; }
            public float CetApres { get; set; }
        }

        public sealed class CetTransferResult
        {
            public string Soccod { get; set; } = string.Empty;
            public string Annee { get; set; } = string.Empty;
            public string DateLimite { get; set; } = string.Empty;
            public float MaxJours { get; set; }
            public int EmployesTraites { get; set; }
            public float TotalJoursTransferes { get; set; }
            public List<CetTransferLine> Details { get; set; } = new();
        }

        public sealed class CetSoldeLine
        {
            public string Empcod { get; set; } = string.Empty;
            public string? Emplib { get; set; }
            public string? Annee { get; set; }
            public float Cetjours { get; set; }
        }

        /// <summary>
        /// Liste permanente des soldes CET cumulés par salarié pour la société. Permet de
        /// consulter à tout moment l'état réel du CET (indépendamment d'un aperçu/transfert).
        /// </summary>
        [HttpGet("soldes/{soccod}")]
        public async Task<IActionResult> GetSoldes(string soccod)
        {
            var list = await (
                from s in _db.Soldes
                join e in _db.Employes on new { s.Soccod, s.Empcod } equals new { e.Soccod, e.Empcod } into ej
                from e in ej.DefaultIfEmpty()
                where s.Soccod == soccod
                select new CetSoldeLine
                {
                    Empcod = s.Empcod,
                    Emplib = e != null ? e.Emplib : null,
                    Annee = s.Annee,
                    Cetjours = s.Cetjours ?? 0f,
                }).ToListAsync();

            // Comptes alimentés en premier, puis tri par matricule.
            return Ok(list.OrderByDescending(x => x.Cetjours).ThenBy(x => x.Empcod).ToList());
        }

        /// <summary>Renvoie les paramètres CET pour la société. Crée la ligne par défaut si absente.</summary>
        [HttpGet("parametres/{soccod}")]
        public async Task<IActionResult> GetParametres(string soccod)
        {
            var p = await _db.Parametres.FirstOrDefaultAsync(x => x.Soccod == soccod);
            return Ok(new CetParametersDto
            {
                Soccod = soccod,
                Datelim = p?.Parcetdatelim ?? "31-05",
                Maxjours = p?.Parcetmaxjours ?? 10f,
                // null/"1" = validation requise (défaut prudent) ; "0" = application immédiate.
                RequireValidation = p?.Parcetvalidation != "0",
            });
        }

        /// <summary>Met à jour les paramètres CET (date limite + plafond).</summary>
        [HttpPut("parametres")]
        public async Task<IActionResult> UpdateParametres([FromBody] CetParametersDto dto)
        {
            if (string.IsNullOrWhiteSpace(dto.Soccod))
                return BadRequest(new { error = "Soccod requis." });
            if (!string.IsNullOrWhiteSpace(dto.Datelim) && !System.Text.RegularExpressions.Regex.IsMatch(dto.Datelim, @"^\d{2}-\d{2}$"))
                return BadRequest(new { error = "Datelim doit être au format DD-MM (ex: 31-05)." });
            if (dto.Maxjours.HasValue && dto.Maxjours.Value < 0)
                return BadRequest(new { error = "Maxjours ne peut pas être négatif." });

            // Upsert : la ligne Parametre n'est pas créée automatiquement à la création
            // de la société, donc le premier enregistrement de paramètres CET (ou de
            // n'importe quel autre paramètre) doit créer la ligne plutôt que de renvoyer
            // 404. Cohérent avec GET /parametres/{soccod} qui retourne déjà des valeurs
            // par défaut quand la ligne est absente.
            var p = await _db.Parametres.FirstOrDefaultAsync(x => x.Soccod == dto.Soccod);
            if (p == null)
            {
                p = new Parametre { Soccod = dto.Soccod };
                _db.Parametres.Add(p);
            }
            p.Parcetdatelim = dto.Datelim;
            p.Parcetmaxjours = dto.Maxjours;
            // RequireValidation null (champ non envoyé par un ancien client) → on ne touche
            // pas au réglage existant. Sinon on persiste "1" (requise) ou "0" (immédiate).
            if (dto.RequireValidation.HasValue)
                p.Parcetvalidation = dto.RequireValidation.Value ? "1" : "0";
            await _db.SaveChangesAsync();
            return Ok(new { success = true });
        }

        /// <summary>
        /// Aperçu (dry-run) du transfert CET pour une société + année donnée. Ne modifie rien.
        /// </summary>
        [HttpGet("preview/{soccod}/{annee}")]
        public async Task<IActionResult> Preview(string soccod, string annee)
            => Ok(await ComputeAsync(soccod, annee, applyChanges: false));

        /// <summary>
        /// Applique le transfert CET : pour chaque solde, transfère min(reste, plafond) vers Cetjours
        /// puis met Conge à Empconge (solde restant à 0). Retourne le détail des lignes traitées.
        /// </summary>
        [HttpPost("apply/{soccod}/{annee}")]
        public async Task<IActionResult> Apply(string soccod, string annee)
            => Ok(await ComputeAsync(soccod, annee, applyChanges: true));

        private async Task<CetTransferResult> ComputeAsync(string soccod, string annee, bool applyChanges)
        {
            var param = await _db.Parametres.FirstOrDefaultAsync(x => x.Soccod == soccod);
            var dateLim = param?.Parcetdatelim ?? "31-05";
            var maxJours = param?.Parcetmaxjours ?? 10f;

            var soldes = await _db.Soldes
                .Where(s => s.Soccod == soccod && s.Annee == annee)
                .ToListAsync();

            var result = new CetTransferResult
            {
                Soccod = soccod,
                Annee = annee,
                DateLimite = dateLim,
                MaxJours = maxJours,
            };

            // Mois de fin pour le calcul d'acquisition : on s'aligne sur le KPI « Solde de
            // congé ». Pour l'année courante, on s'arrête au mois courant (acquisition au
            // prorata, comme le KPI) ; pour une année révolue, on prend l'année complète.
            var currentYear = DateTime.Now.Year;
            var yearInt = int.TryParse(annee, out var y) ? y : currentYear;
            var moisFin = yearInt < currentYear ? "12" : DateTime.Now.Month.ToString("D2");

            foreach (var s in soldes)
            {
                // « Solde restant avant » aligné sur le KPI Solde de congé : on prend le
                // SoldeAnterieur calculé = droit acquis (report N-1 + affectation + acquisition
                // mensuelle calculée) MOINS les congés déjà pris. Avant, on faisait
                // `Conge - Empconge`, qui ne tenait compte que du solde affecté manuellement
                // et ignorait l'acquisition de l'année → le nombre de jours transférables était
                // sous-évalué (cf. demande métier 2026-05-30).
                var etat = await _congeCalc.GetEmpEtatCongeAsync(soccod, s.Empcod, "01", moisFin, annee);
                var reste = (float)etat.SoldeAnterieur;
                if (reste <= 0) continue;
                var transfer = Math.Min(reste, maxJours);
                if (transfer <= 0) continue;

                if (applyChanges)
                {
                    s.Cetjours = (s.Cetjours ?? 0f) + transfer;
                    // On retire les jours transférés vers le CET de la graine de solde persistée
                    // (Solde.Conge sert d'amorce au calcul d'acquisition). Décrémenter Conge de
                    // `transfer` diminue d'autant le solde recalculé ensuite, donc le solde KPI
                    // de l'employé baisse exactement du nombre de jours épargnés.
                    s.Conge = (s.Conge ?? 0f) - transfer;
                }

                result.Details.Add(new CetTransferLine
                {
                    Empcod = s.Empcod,
                    SoldeAvant = reste,
                    Transferes = transfer,
                    CetApres = (s.Cetjours ?? 0f) + (applyChanges ? 0f : transfer),
                });
                result.TotalJoursTransferes += transfer;
                result.EmployesTraites++;
            }

            if (applyChanges) await _db.SaveChangesAsync();
            return result;
        }

        // ═══════════════════════════════════════════════════════════════════════════
        //  ALIMENTATION DU CET PAR LE SALARIÉ
        //  Le salarié demande de transférer N jours d'un type de congé source (RTT, CP…)
        //  vers son CET. Limites contrôlées via la config du type (Abspeutcet/Absmaxcet)
        //  + le solde source disponible. Validation RH/admin/manager optionnelle selon
        //  Parametre.Parcetvalidation.
        // ═══════════════════════════════════════════════════════════════════════════

        public sealed class CetEligibiliteLine
        {
            public string Abscod { get; set; } = string.Empty;
            public string? Abslib { get; set; }
            public string Categorie { get; set; } = "CP";   // "RTT" | "CP"
            public float SoldeDisponible { get; set; }
            public float DejaTransfere { get; set; }
            public float? PlafondAnnuel { get; set; }
            public float ResteTransferable { get; set; }
        }

        public sealed class AlimentationRequestDto
        {
            public string Empcod { get; set; } = string.Empty;
            public string Abscod { get; set; } = string.Empty;
            public float Nbjours { get; set; }
        }

        public sealed class AlimentationLine
        {
            public int Id { get; set; }
            public string? Empcod { get; set; }
            public string? Emplib { get; set; }
            public string? Abscod { get; set; }
            public string? Abslib { get; set; }
            public float Nbjours { get; set; }
            public string? Annee { get; set; }
            public DateTime Datedemande { get; set; }
            public string Statut { get; set; } = "pending";
            public string? Validepar { get; set; }
            public DateTime? Datevalidation { get; set; }
            public string? Motifrefus { get; set; }
        }

        public sealed class RefusDto { public string? Motif { get; set; } }

        /// <summary>
        /// Types de congé éligibles à l'alimentation du CET pour un salarié, avec le solde
        /// source disponible, le déjà-transféré de l'année, le plafond et le reste transférable.
        /// </summary>
        [HttpGet("alimentation/eligibilite/{soccod}/{empcod}")]
        public async Task<IActionResult> GetAlimentationEligibilite(string soccod, string empcod)
        {
            var caller = await ResolveCallerAsync();
            if (caller is null) return Forbid();
            if (!caller.Value.IsAdmin && !caller.Value.IsManager && caller.Value.Uticod != empcod)
                return Forbid();

            var types = await _db.Absences.AsNoTracking()
                .Where(a => a.Soccod == soccod && a.Abspeutcet == "1")
                .Select(a => new { a.Abscod, a.Abslib, a.Abscng })
                .ToListAsync();

            var annee = DateTime.Now.Year.ToString();
            var lines = new List<CetEligibiliteLine>();
            foreach (var t in types)
            {
                if (string.IsNullOrEmpty(t.Abscod)) continue;
                var (cat, dispo) = await GetSourceDispoAsync(soccod, empcod, t.Abscng);
                var deja = await DejaTransfereAsync(soccod, empcod, t.Abscod, annee);
                var plafond = await _db.Absences.AsNoTracking()
                    .Where(a => a.Soccod == soccod && a.Abscod == t.Abscod)
                    .Select(a => a.Absmaxcet).FirstOrDefaultAsync();
                var remainingCap = (plafond.HasValue && plafond.Value > 0)
                    ? Math.Max(0f, plafond.Value - deja)
                    : dispo;
                var reste = Math.Max(0f, Math.Min(dispo, remainingCap));
                lines.Add(new CetEligibiliteLine
                {
                    Abscod = t.Abscod,
                    Abslib = t.Abslib,
                    Categorie = cat,
                    SoldeDisponible = dispo,
                    DejaTransfere = deja,
                    PlafondAnnuel = plafond,
                    ResteTransferable = reste,
                });
            }
            return Ok(lines);
        }

        /// <summary>Crée une demande d'alimentation du CET (besoin 1).</summary>
        [HttpPost("alimentation")]
        public async Task<IActionResult> CreateAlimentation([FromBody] AlimentationRequestDto dto, [FromQuery] string soccod)
        {
            var caller = await ResolveCallerAsync();
            if (caller is null) return Forbid();
            if (string.IsNullOrWhiteSpace(soccod) || string.IsNullOrWhiteSpace(dto.Empcod) || string.IsNullOrWhiteSpace(dto.Abscod))
                return BadRequest(new { message = "Société, employé et type de congé sont requis." });
            // Un salarié ne peut demander que pour lui-même ; admin/manager peuvent agir pour autrui.
            if (!caller.Value.IsAdmin && !caller.Value.IsManager && caller.Value.Uticod != dto.Empcod)
                return Forbid();
            if (dto.Nbjours <= 0)
                return BadRequest(new { message = "Le nombre de jours doit être strictement positif." });

            var type = await _db.Absences.AsNoTracking()
                .FirstOrDefaultAsync(a => a.Soccod == soccod && a.Abscod == dto.Abscod);
            if (type == null || type.Abspeutcet != "1")
                return BadRequest(new { message = "Ce type de congé n'est pas autorisé à alimenter le CET." });

            var annee = DateTime.Now.Year.ToString();
            var (_, dispo) = await GetSourceDispoAsync(soccod, dto.Empcod, type.Abscng);
            if (dto.Nbjours > dispo)
                return BadRequest(new { message = $"Solde source insuffisant : {dispo:0.#} jour(s) disponible(s)." });

            if (type.Absmaxcet.HasValue && type.Absmaxcet.Value > 0)
            {
                var deja = await DejaTransfereAsync(soccod, dto.Empcod, dto.Abscod, annee);
                if (deja + dto.Nbjours > type.Absmaxcet.Value)
                    return BadRequest(new { message = $"Plafond annuel dépassé : {type.Absmaxcet.Value:0.#} jour(s) max, {deja:0.#} déjà transféré(s)." });
            }

            var param = await _db.Parametres.AsNoTracking().FirstOrDefaultAsync(p => p.Soccod == soccod);
            var requireValidation = param?.Parcetvalidation != "0"; // null/"1" = requise

            var req = new DemAlimentationCet
            {
                Soccod = soccod,
                Empcod = dto.Empcod,
                Abscod = dto.Abscod,
                Nbjours = dto.Nbjours,
                Annee = annee,
                Datedemande = DateTime.UtcNow,
                Statut = requireValidation ? "pending" : "approved",
            };

            if (!requireValidation)
            {
                await ApplyAlimentationAsync(soccod, dto.Empcod, dto.Abscod, type.Abscng, dto.Nbjours);
                req.Validepar = "AUTO";
                req.Datevalidation = DateTime.UtcNow;
            }

            _db.DemAlimentationsCet.Add(req);
            await _db.SaveChangesAsync();

            // ─── Notification employeur (managers/admins) — best-effort ───
            // On prévient les valideurs qu'une demande d'alimentation CET arrive. Pas
            // d'email côté managers (trop spammy) : push/in-app seulement. Si la demande
            // est appliquée immédiatement (pas de validation requise), aucune notif.
            if (requireValidation)
            {
                try
                {
                    if (_notify != null)
                    {
                        var who = await _db.Employes.AsNoTracking()
                            .Where(e => e.Soccod == soccod && e.Empcod == dto.Empcod)
                            .Select(e => e.Emplib).FirstOrDefaultAsync() ?? dto.Empcod;
                        _ = _notify.NotifyManagersAsync(
                            "🏦 Demande d'alimentation CET à valider",
                            $"{who} demande à transférer {dto.Nbjours:0.#} jour(s) de « {type.Abslib} » vers le CET.",
                            new { type = "cet_alimentation_created", id = req.Id, soccod });
                    }
                }
                catch (Exception ex) { _log?.LogWarning(ex, "CET.CreateAlimentation — notification managers ignorée (demande sauvegardée)."); }
            }

            return Ok(new { req.Id, req.Statut, applied = !requireValidation });
        }

        /// <summary>Demandes d'alimentation du salarié connecté (ou ciblé si privilégié).</summary>
        [HttpGet("alimentation/mine/{soccod}/{empcod}")]
        public async Task<IActionResult> GetMyAlimentations(string soccod, string empcod)
        {
            var caller = await ResolveCallerAsync();
            if (caller is null) return Forbid();
            if (!caller.Value.IsAdmin && !caller.Value.IsManager && caller.Value.Uticod != empcod)
                return Forbid();

            var rows = await _db.DemAlimentationsCet.AsNoTracking()
                .Where(d => d.Soccod == soccod && d.Empcod == empcod)
                .OrderByDescending(d => d.Datedemande)
                .ToListAsync();
            return Ok(await HydrateLinesAsync(soccod, rows));
        }

        /// <summary>Demandes d'alimentation en attente de validation (admin/manager).</summary>
        [HttpGet("alimentation/pending/{soccod}")]
        public async Task<IActionResult> GetPendingAlimentations(string soccod)
        {
            var caller = await ResolveCallerAsync();
            if (caller is null) return Forbid();
            if (!caller.Value.IsAdmin && !caller.Value.IsManager) return Forbid();

            var rows = await _db.DemAlimentationsCet.AsNoTracking()
                .Where(d => d.Soccod == soccod && d.Statut == "pending")
                .OrderBy(d => d.Datedemande)
                .ToListAsync();
            return Ok(await HydrateLinesAsync(soccod, rows));
        }

        /// <summary>Approuve une demande d'alimentation et applique le transfert (admin/manager).</summary>
        [HttpPost("alimentation/{soccod}/{id}/approve")]
        public async Task<IActionResult> ApproveAlimentation(string soccod, int id)
        {
            var caller = await ResolveCallerAsync();
            if (caller is null) return Forbid();
            if (!caller.Value.IsAdmin && !caller.Value.IsManager) return Forbid();

            var req = await _db.DemAlimentationsCet.FirstOrDefaultAsync(d => d.Soccod == soccod && d.Id == id);
            if (req == null) return NotFound(new { message = "Demande introuvable." });
            if (req.Statut != "pending") return BadRequest(new { message = "Cette demande a déjà été traitée." });

            // Re-contrôle du solde au moment de la validation (il a pu bouger depuis la demande).
            var type = await _db.Absences.AsNoTracking()
                .FirstOrDefaultAsync(a => a.Soccod == soccod && a.Abscod == req.Abscod);
            var (_, dispo) = await GetSourceDispoAsync(soccod, req.Empcod!, type?.Abscng);
            if (req.Nbjours > dispo)
                return BadRequest(new { message = $"Solde source insuffisant au moment de la validation : {dispo:0.#} jour(s)." });

            await ApplyAlimentationAsync(soccod, req.Empcod!, req.Abscod!, type?.Abscng, req.Nbjours);
            req.Statut = "approved";
            req.Validepar = caller.Value.Uticod;
            req.Datevalidation = DateTime.UtcNow;
            await _db.SaveChangesAsync();

            await NotifyAlimentationDecisionAsync(req, type?.Abslib, approved: true);
            return Ok(new { success = true });
        }

        /// <summary>Refuse une demande d'alimentation (admin/manager).</summary>
        [HttpPost("alimentation/{soccod}/{id}/refuse")]
        public async Task<IActionResult> RefuseAlimentation(string soccod, int id, [FromBody] RefusDto? dto)
        {
            var caller = await ResolveCallerAsync();
            if (caller is null) return Forbid();
            if (!caller.Value.IsAdmin && !caller.Value.IsManager) return Forbid();

            var req = await _db.DemAlimentationsCet.FirstOrDefaultAsync(d => d.Soccod == soccod && d.Id == id);
            if (req == null) return NotFound(new { message = "Demande introuvable." });
            if (req.Statut != "pending") return BadRequest(new { message = "Cette demande a déjà été traitée." });

            var type = await _db.Absences.AsNoTracking()
                .FirstOrDefaultAsync(a => a.Soccod == soccod && a.Abscod == req.Abscod);

            req.Statut = "refused";
            req.Validepar = caller.Value.Uticod;
            req.Datevalidation = DateTime.UtcNow;
            req.Motifrefus = dto?.Motif;
            await _db.SaveChangesAsync();

            await NotifyAlimentationDecisionAsync(req, type?.Abslib, approved: false);
            return Ok(new { success = true });
        }

        /// <summary>
        /// Notifie le salarié (push/in-app + email best-effort) de la décision prise sur
        /// sa demande d'alimentation CET. Aligné sur TeletravailController.DecideAsync :
        /// tous les envois sont fail-silent (l'action métier est déjà persistée).
        /// </summary>
        private async Task NotifyAlimentationDecisionAsync(DemAlimentationCet req, string? typeLib, bool approved)
        {
            try
            {
                var emp = await _db.Employes.AsNoTracking()
                    .Where(e => e.Soccod == req.Soccod && e.Empcod == req.Empcod)
                    .Select(e => new { e.Emplib, e.Empemail })
                    .FirstOrDefaultAsync();

                var libelle = string.IsNullOrWhiteSpace(typeLib) ? req.Abscod : typeLib;
                var detail = $"{req.Nbjours:0.#} jour(s) de « {libelle} » vers le CET";

                if (_notify != null && !string.IsNullOrEmpty(req.Empcod))
                {
                    var title = approved ? "✅ Alimentation CET validée" : "❌ Alimentation CET refusée";
                    var body = approved
                        ? $"Votre demande de transfert de {detail} a été validée."
                        : $"Votre demande de transfert de {detail} a été refusée."
                            + (string.IsNullOrWhiteSpace(req.Motifrefus) ? "" : $" Motif : {req.Motifrefus}");
                    _ = _notify.NotifyUserAsync(req.Empcod, title, body,
                        new { type = approved ? "cet_alimentation_approved" : "cet_alimentation_refused", id = req.Id, soccod = req.Soccod });
                }

                if (_email != null && !string.IsNullOrWhiteSpace(emp?.Empemail))
                {
                    try
                    {
                        var subject = approved
                            ? "Votre demande d'alimentation CET a été validée"
                            : "Votre demande d'alimentation CET a été refusée";
                        var html = BuildCetDecisionEmail(emp.Emplib ?? req.Empcod ?? "", approved, detail, req.Motifrefus);
                        await _email.SendEmailAsync(emp.Empemail!, subject, html);
                    }
                    catch (Exception emailEx) { _log?.LogWarning(emailEx, "Email décision CET non envoyé — id={Id} empcod={Empcod}", req.Id, req.Empcod); }
                }
            }
            catch (Exception ex) { _log?.LogWarning(ex, "CET.NotifyAlimentationDecisionAsync — notification ignorée (décision sauvegardée)."); }
        }

        private static string BuildCetDecisionEmail(string employeeName, bool approved, string detail, string? motif)
        {
            var statusLabel = approved ? "validée" : "refusée";
            var statusColor = approved ? "#16a34a" : "#dc2626";
            var statusIcon = approved ? "✅" : "❌";
            var motifBlock = (!approved && !string.IsNullOrWhiteSpace(motif))
                ? $"<p style='margin:12px 0;padding:12px;background:#f8fafc;border-left:3px solid {statusColor};border-radius:4px;'><strong>Motif du refus :</strong><br>{System.Net.WebUtility.HtmlEncode(motif)}</p>"
                : "";
            return $@"<!DOCTYPE html>
<html><body style='font-family:Arial,Helvetica,sans-serif;color:#1e293b;max-width:560px;margin:0 auto;padding:24px;'>
  <h2 style='color:{statusColor};margin:0 0 16px;'>{statusIcon} Demande d'alimentation CET {statusLabel}</h2>
  <p>Bonjour {System.Net.WebUtility.HtmlEncode(employeeName)},</p>
  <p>Votre demande de transfert de <strong>{System.Net.WebUtility.HtmlEncode(detail)}</strong> a été <strong style='color:{statusColor};'>{statusLabel}</strong>.</p>
  {motifBlock}
  <p style='margin-top:24px;font-size:12px;color:#94a3b8;'>Concorde Workforce — Notification automatique</p>
</body></html>";
        }

        // ───────────────────────── Helpers alimentation ─────────────────────────

        /// <summary>
        /// Applique le transfert : décrémente le solde source (RTT consommé via RttUtilises,
        /// ou congé payé via Conge), puis crédite Cetjours du même nombre de jours.
        /// </summary>
        private async Task ApplyAlimentationAsync(string soccod, string empcod, string abscod, string? abscng, float nbjours)
        {
            var year = DateTime.UtcNow.Year;
            if (string.Equals(abscng, "R", StringComparison.OrdinalIgnoreCase))
            {
                // RTT : on consomme le droit RTT (RttUtilises += nbjours) puis on crédite le CET.
                await _rttService.IncrementUsedAsync(soccod, empcod, year, nbjours);
                var solde = await _db.Soldes.FirstOrDefaultAsync(s => s.Soccod == soccod && s.Empcod == empcod);
                if (solde != null)
                {
                    solde.Cetjours = (solde.Cetjours ?? 0f) + nbjours;
                    await _db.SaveChangesAsync();
                }
            }
            else
            {
                // Congé payé (ou autre catégorie) : on décrémente la graine de solde Conge
                // (cohérent avec le transfert collectif admin) et on crédite le CET.
                var solde = await _db.Soldes.FirstOrDefaultAsync(s => s.Soccod == soccod && s.Empcod == empcod);
                if (solde == null)
                {
                    solde = new Solde { Soccod = soccod, Empcod = empcod, Annee = year.ToString(), Conge = -nbjours, Cetjours = nbjours };
                    _db.Soldes.Add(solde);
                }
                else
                {
                    solde.Conge = (solde.Conge ?? 0f) - nbjours;
                    solde.Cetjours = (solde.Cetjours ?? 0f) + nbjours;
                }
                await _db.SaveChangesAsync();
            }
        }

        /// <summary>Solde source disponible : RTT = droit - utilisés ; sinon CP net (SoldeAnterieur du KPI).</summary>
        private async Task<(string Categorie, float Dispo)> GetSourceDispoAsync(string soccod, string empcod, string? abscng)
        {
            if (string.Equals(abscng, "R", StringComparison.OrdinalIgnoreCase))
            {
                var solde = await _db.Soldes.AsNoTracking()
                    .FirstOrDefaultAsync(s => s.Soccod == soccod && s.Empcod == empcod);
                var dispo = Math.Max(0f, (solde?.RttJours ?? 0f) - (solde?.RttUtilises ?? 0f));
                return ("RTT", dispo);
            }
            // CP : on s'aligne sur le KPI Solde de congé (net = droit calculé - congés pris).
            var year = DateTime.Now.Year.ToString();
            var month = DateTime.Now.Month.ToString("D2");
            var etat = await _congeCalc.GetEmpEtatCongeAsync(soccod, empcod, "01", month, year);
            return ("CP", Math.Max(0f, (float)etat.SoldeAnterieur));
        }

        private async Task<float> DejaTransfereAsync(string soccod, string empcod, string abscod, string annee)
        {
            return await _db.DemAlimentationsCet.AsNoTracking()
                .Where(d => d.Soccod == soccod && d.Empcod == empcod && d.Abscod == abscod
                            && d.Annee == annee && d.Statut == "approved")
                .SumAsync(d => (float?)d.Nbjours) ?? 0f;
        }

        private async Task<List<AlimentationLine>> HydrateLinesAsync(string soccod, List<DemAlimentationCet> rows)
        {
            if (rows.Count == 0) return new List<AlimentationLine>();
            var abscods = rows.Where(r => r.Abscod != null).Select(r => r.Abscod!).Distinct().ToList();
            var empcods = rows.Where(r => r.Empcod != null).Select(r => r.Empcod!).Distinct().ToList();
            var libs = await _db.Absences.AsNoTracking()
                .Where(a => a.Soccod == soccod && abscods.Contains(a.Abscod!))
                .ToDictionaryAsync(a => a.Abscod!, a => a.Abslib);
            var emps = await _db.Employes.AsNoTracking()
                .Where(e => e.Soccod == soccod && empcods.Contains(e.Empcod))
                .ToDictionaryAsync(e => e.Empcod, e => e.Emplib);

            return rows.Select(r => new AlimentationLine
            {
                Id = r.Id,
                Empcod = r.Empcod,
                Emplib = r.Empcod != null && emps.TryGetValue(r.Empcod, out var el) ? el : r.Empcod,
                Abscod = r.Abscod,
                Abslib = r.Abscod != null && libs.TryGetValue(r.Abscod, out var al) ? al : r.Abscod,
                Nbjours = r.Nbjours,
                Annee = r.Annee,
                Datedemande = r.Datedemande,
                Statut = r.Statut,
                Validepar = r.Validepar,
                Datevalidation = r.Datevalidation,
                Motifrefus = r.Motifrefus,
            }).ToList();
        }

        /// <summary>
        /// Résout l'appelant (uticod) + ses droits (admin/manager) depuis le token. Même
        /// logique que AuditLogsController : on lit Utiadm + Utirole en une requête.
        /// </summary>
        private async Task<(string Uticod, bool IsAdmin, bool IsManager)?> ResolveCallerAsync()
        {
            var caller = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (string.IsNullOrEmpty(caller)) return null;

            var info = await _db.Utilisateurs.AsNoTracking()
                .Where(u => u.Uticod == caller)
                .Select(u => new { u.Utiadm, u.Utirole })
                .FirstOrDefaultAsync();
            if (info is null) return (caller, false, false);

            var isAdmin = info.Utiadm == "1" || PermissionCatalog.IsAdminRole(info.Utirole);
            var isManager = string.Equals(info.Utirole, PermissionCatalog.Roles.Manager, StringComparison.OrdinalIgnoreCase);
            return (caller, isAdmin, isManager);
        }
    }
}
