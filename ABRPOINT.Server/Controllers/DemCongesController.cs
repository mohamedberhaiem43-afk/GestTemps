using ABRPOINT.Server.Annotations.CongesAttributes.DemCongeAttributes;
using ABRPOINT.Server.Data;
using ABRPOINT.Server.Dtaos;
using ABRPOINT.Server.Interfaces;
using ABRPOINT.Server.Models;
using ABRPOINT.Server.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Threading.Tasks;

namespace ABRPOINT.Server.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    [Authorize]
    [Tenancy.RequirePlanFeature(nameof(Tenancy.PlanFeatures.LeaveManagement))]
    public class DemCongesController : ControllerBase
    {
        private readonly IDemCongeRepository _demandecongeRepository;
        private readonly ApplicationDbContext _context;
        private readonly IUserNotificationService? _notify;
        private readonly ILogger<DemCongesController> _log;
        public DemCongesController(
            IDemCongeRepository demandecongeRepository,
            ApplicationDbContext context,
            ILogger<DemCongesController> log,
            IUserNotificationService? notify = null)
        {
            _demandecongeRepository = demandecongeRepository;
            _context = context;
            _notify = notify;
            _log = log;
        }

        // GET: api/DemConges/get-next-concod/{soccod}
        // A16 — Permission requise (créer une demande de congé).
        [HttpGet("get-next-concod/{soccod}")]
        [CanAddDemConge]
        public async Task<IActionResult> GetNextConcod(string soccod)
        {
            try
            {
                var now = DateTime.Now;
                var prefix = "D" + now.ToString("yyMM");

                var maxConcod = await _context.Demconges
                    .Where(c => c.Soccod == soccod && c.Concod.StartsWith(prefix))
                    .OrderByDescending(c => c.Concod)
                    .Select(c => c.Concod)
                    .FirstOrDefaultAsync();

                int nextSeq = 1;
                if (!string.IsNullOrEmpty(maxConcod) && maxConcod.Length >= 7)
                {
                    if (int.TryParse(maxConcod.Substring(5), out int lastSeq))
                        nextSeq = lastSeq + 1;
                }

                var nextConcod = prefix + nextSeq.ToString("D2");
                return Ok(new { concod = nextConcod });
            }
            catch (Exception ex)
            {
                return StatusCode(500, "Erreur lors de la génération du numéro: ");
            }
        }
        // GET: api/<DirectionsController>
        [HttpGet("get-demconge/{soccod}/{uticod}")]
        [CanGetDemConge]
        public async Task<List<DemcongeEmpAbsDto>> GetCongeWithAbsenceAsync(string soccod, string uticod)
        {
            try
            {
                return await _demandecongeRepository.GetDemongeWithAbsenceAsync(soccod, uticod);
            }
            catch (Exception)
            {
                throw;
            }
        }
        // A12 — Self-service : un employé voit ses propres demandes ; sinon permission consult requise.
        // Avant, n'importe quel user pouvait lister les demandes de congés d'un autre via cet endpoint.
        [HttpGet("get-emp-demconge/{soccod}/{empcod}")]
        public async Task<IActionResult> GetEmpDemconge(string soccod, string empcod)
        {
            try
            {
                var caller = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;
                if (string.IsNullOrEmpty(caller)) return Unauthorized();
                if (!string.Equals(caller, empcod, StringComparison.OrdinalIgnoreCase))
                {
                    var isPrivileged = await _context.Utilisateurs.AsNoTracking()
                        .Where(u => u.Uticod == caller)
                        .Select(u => u.Utiadm == "1" || ABRPOINT.Server.Authorization.PermissionCatalog.IsAdminRole(u.Utirole))
                        .FirstOrDefaultAsync();
                    if (!isPrivileged) return Forbid();
                }

                var result = await _demandecongeRepository.GetEmpDemcongeAsync(soccod, empcod);
                return Ok(result);
            }
            catch (Exception)
            {
                throw;
            }
        }

        [HttpGet("get-demconge-by-periode/{soccod}/{uticod}/{datedebut}/{datefin}")]
        [CanGetDemConge]
        public async Task<List<DemcongeDto>> GetCongeWithAbsenceAsync(string soccod, string uticod,DateTime datedebut,DateTime datefin)
        {
            try
            {
                datedebut = datedebut.Date;
                datefin = datefin.Date;
                    var result =  await _demandecongeRepository.GetAllByPeriodAsync(soccod, uticod,datedebut,datefin);
                return result;
            }
            catch (Exception)
            {
                throw;
            }
        }
        // GET: api/DemConges/by-soc/{soccod}
        // Vue agrégée pour le Calendrier équipe (TeamCalendarPage). Aligné sur
        // MissionsController.GetBySoc : admin/manager uniquement (vue globale
        // tenant — un employé ne voit pas les congés des collègues).
        // Renvoie chaque DemConge avec son `etat` calculé (Accepté / Refusé /
        // En attente) — la table Conge sert de source de vérité pour le statut
        // post-décision, sans laquelle le calendrier restait vide même quand
        // des congés étaient acceptés. Le frontend filtre ensuite via
        // `isAccepted(etat)` (cf. TeamCalendarPage.tsx ligne 76).
        [HttpGet("by-soc/{soccod}")]
        public async Task<IActionResult> GetBySoc(string soccod)
        {
            var caller = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;
            if (string.IsNullOrEmpty(caller)) return Unauthorized();
            var isPrivileged = await _context.Utilisateurs.AsNoTracking()
                .Where(u => u.Uticod == caller)
                .Select(u => u.Utiadm == "1"
                          || ABRPOINT.Server.Authorization.PermissionCatalog.IsAdminRole(u.Utirole)
                          || u.Utirole == ABRPOINT.Server.Authorization.PermissionCatalog.Roles.Manager)
                .FirstOrDefaultAsync();
            if (!isPrivileged) return Forbid();

            // Left join Demconge ↔ Conge : Conge présent = décidé, Conrefus="1"
            // = refusé, sinon accepté. Left join Employe pour emplib. On garde
            // les 3 statuts dans la sortie ; le front choisit ce qu'il affiche.
            var rows = await (
                from d in _context.Demconges.AsNoTracking()
                where d.Soccod == soccod
                join c in _context.Conges.AsNoTracking()
                    on new { d.Soccod, d.Concod } equals new { c.Soccod, c.Concod } into cj
                from c in cj.DefaultIfEmpty()
                join e in _context.Employes.AsNoTracking()
                    on new { d.Soccod, d.Empcod } equals new { e.Soccod, e.Empcod } into ej
                from e in ej.DefaultIfEmpty()
                select new
                {
                    concod   = d.Concod,
                    empcod   = d.Empcod,
                    emplib   = e != null ? e.Emplib : null,
                    abscod   = d.Abscod,
                    condep   = d.Condep,
                    conret   = d.Conret,
                    conrefus = c != null ? c.Conrefus : null,
                    etat     = c == null ? "En attente"
                             : (c.Conrefus == "1" ? "Refusé" : "Accepté"),
                }
            ).ToListAsync();
            return Ok(rows);
        }

        [HttpGet("get-pending-demconge-by-periode/{soccod}/{uticod}/{datedebut}/{datefin}")]
        [CanGetDemConge]
        public async Task<List<Demconge>> GetPendingCongeWithAbsenceAsync(string soccod, string uticod,DateTime datedebut,DateTime datefin)
        {
            try
            {
                datedebut = datedebut.Date;
                datefin = datefin.Date;
                    var result =  await _demandecongeRepository.GetAllEnAttenteByPeriodAsync(soccod, uticod,datedebut,datefin);
                return result;
            }
            catch (Exception)
            {
                throw;
            }
        }

        [HttpPost("accept-demconge/{soccod}/{concod}/{empcod}")]
        [CanAddDemConge]
        public async Task<IActionResult> AcceptDemConge(string soccod, string concod,string empcod)
        {
            try
            {
                var result = await _demandecongeRepository.AcceptDemCongeAsync(soccod, concod,empcod);

                if (!result.Success)
                {
                    return BadRequest(new
                    {
                        success = false,
                        message = result.Message
                    });
                }

                // Notifie l'employé que sa demande est validée.
                if (_notify != null)
                {
                    _ = _notify.NotifyUserAsync(
                        empcod,
                        "✅ Votre congé est validé",
                        "Bonne nouvelle : votre demande de congé est acceptée.",
                        new { type = "leave_request_accepted", concod, soccod });
                }

                return Ok(new
                {
                    success = true,
                    message = result.Message
                });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new
                {
                    success = false,
                    message = $"Erreur interne du serveur: erreur interne"
                });
            }
        }

        [HttpPost("refuse-demconge/{soccod}/{concod}/{empcod}")]
        [CanAddDemConge]
        public async Task<IActionResult> RefuseDemConge(string soccod, string concod,string empcod)
        {
            try
            {
                var result = await _demandecongeRepository.RefuseDemCongeAsync(soccod, concod,empcod);

                if (!result.Success)
                {
                    return BadRequest(new
                    {
                        success = false,
                        message = result.Message
                    });
                }

                if (_notify != null)
                {
                    _ = _notify.NotifyUserAsync(
                        empcod,
                        "❌ Votre congé est refusé",
                        "Votre demande n'a pas été acceptée. Consultez le motif dans Demandes et validations.",
                        new { type = "leave_request_refused", concod, soccod });
                }

                return Ok(new
                {
                    success = true,
                    message = result.Message
                });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new
                {
                    success = false,
                    message = $"Erreur interne du serveur: erreur interne"
                });
            }
        }


        // POST api/<DirectionsController>
        [HttpPost]
        [CanAddDemConge]
        public async Task<IActionResult> Post([FromBody] Demconge conge)
        {
            if (conge == null)
                return BadRequest("Veuillez saisie les champs obligatoires");

            // Garde d'éligibilité RTT — refuse une demande sur un type Abscng='R' si
            // l'employé n'a pas le RTT activé (EmpRttMethode='N' ou null). Avant ce
            // garde, l'admin acceptait la demande puis la décrémentation de solde
            // RTT tombait dans le vide (pas de ligne RTT à décrémenter) → confusion.
            // Le front fait déjà le filtrage UX mais on garde la défense en profondeur
            // ici au cas où le filtrage côté client est contourné.
            if (!string.IsNullOrWhiteSpace(conge.Abscod))
            {
                var absInfo = await _context.Absences.AsNoTracking()
                    .Where(a => a.Soccod == conge.Soccod && a.Abscod == conge.Abscod)
                    .Select(a => new { a.Abscng, a.Absprendcet })
                    .FirstOrDefaultAsync();
                var abscng = absInfo?.Abscng;
                if (string.Equals(abscng, "R", StringComparison.OrdinalIgnoreCase))
                {
                    var rttMethode = await _context.Employes.AsNoTracking()
                        .Where(e => e.Soccod == conge.Soccod && e.Empcod == conge.Empcod)
                        .Select(e => e.EmpRttMethode)
                        .FirstOrDefaultAsync();
                    var isEligible = !string.IsNullOrEmpty(rttMethode)
                        && !string.Equals(rttMethode, "N", StringComparison.OrdinalIgnoreCase);
                    if (!isEligible)
                    {
                        _log.LogWarning(
                            "DemConge.Post — refus RTT non-éligible : Soccod={Soccod} Empcod={Empcod} Abscod={Abscod} EmpRttMethode={Methode}",
                            conge.Soccod, conge.Empcod, conge.Abscod, rttMethode ?? "(null)");
                        return BadRequest(new
                        {
                            code = "rtt_not_eligible",
                            message = "Cet employé n'est pas éligible aux congés RTT. Activez la méthode RTT sur sa fiche (M, H ou F) avant de soumettre ce type de demande."
                        });
                    }
                }
                // Garde CET — un congé puisant dans le CET (Absprendcet='1' ou imputation
                // Abscng='E') ne peut excéder le solde CET disponible du salarié. Le décrément
                // effectif a lieu à l'acceptation (cf. DemCongeRepository.AcceptDemCongeAsync),
                // mais on bloque dès la création pour ne pas laisser passer une demande inhonorable.
                else if (absInfo?.Absprendcet == "1" || string.Equals(abscng, "E", StringComparison.OrdinalIgnoreCase))
                {
                    var cetDispo = await _context.Soldes.AsNoTracking()
                        .Where(s => s.Soccod == conge.Soccod && s.Empcod == conge.Empcod)
                        .Select(s => s.Cetjours)
                        .FirstOrDefaultAsync() ?? 0f;
                    var demande = conge.Connbjour ?? 0f;
                    if (demande <= 0)
                    {
                        return BadRequest(new { code = "cet_invalid_days", message = "Le nombre de jours demandé est invalide." });
                    }
                    if (demande > cetDispo)
                    {
                        _log.LogWarning(
                            "DemConge.Post — refus prise CET : demande {Demande}j > solde CET {Dispo}j pour Soccod={Soccod} Empcod={Empcod}",
                            demande, cetDispo, conge.Soccod, conge.Empcod);
                        return BadRequest(new
                        {
                            code = "cet_insufficient",
                            message = $"Solde CET insuffisant : {cetDispo:0.#} jour(s) disponible(s), {demande:0.#} demandé(s)."
                        });
                    }
                }
            }

            // Génération authoritative du Concod côté serveur, avec retry sur
            // collision PK. Avant : le client appelait `get-next-concod` puis
            // POSTait — deux clients quasi-simultanés obtenaient le même numéro
            // (race entre SELECT MAX et INSERT) et le second se prenait une
            // violation PK_demconge → 500. Maintenant : on calcule MAX une fois,
            // on tente l'insert ; si conflit PK on incrémente la séquence et on
            // retente, jusqu'à 10 essais. La valeur client-suggérée est ignorée.
            const int maxRetries = 10;
            var now = DateTime.Now;
            var prefix = "D" + now.ToString("yyMM");

            int nextSeq;
            {
                var maxConcod = await _context.Demconges.AsNoTracking()
                    .Where(c => c.Soccod == conge.Soccod && c.Concod.StartsWith(prefix))
                    .OrderByDescending(c => c.Concod)
                    .Select(c => c.Concod)
                    .FirstOrDefaultAsync();

                nextSeq = 1;
                if (!string.IsNullOrEmpty(maxConcod) && maxConcod.Length >= 7
                    && int.TryParse(maxConcod.Substring(5), out int lastSeq))
                {
                    nextSeq = lastSeq + 1;
                }
            }

            bool saved = false;
            Exception? lastEx = null;
            for (int attempt = 0; attempt < maxRetries && !saved; attempt++)
            {
                conge.Concod = prefix + nextSeq.ToString("D2");
                try
                {
                    await _demandecongeRepository.AddAsync(conge);
                    saved = true;
                }
                catch (DbUpdateException ex) when (
                    // Postgres : SQLSTATE 23505 = unique_violation (couvre l'équivalent
                    // SQL Server 2627 (PRIMARY KEY violation) + 2601 (UNIQUE INDEX
                    // violation), distingués historiquement mais regroupés sous 23505 en PG).
                    ex.InnerException is Npgsql.PostgresException pgEx
                    && pgEx.SqlState == "23505")
                {
                    // Conflit PK : un autre process a pris ce numéro entre notre
                    // SELECT MAX et notre INSERT. On détache l'entité (sinon EF
                    // garde un État Added avec la même PK et re-rejette) et on
                    // tente la séquence suivante.
                    lastEx = ex;
                    var entry = _context.Entry(conge);
                    if (entry.State != EntityState.Detached) entry.State = EntityState.Detached;
                    _log.LogWarning(
                        "DemConge.Post — conflit PK sur {Concod}, retry {Attempt}/{Max} pour Soccod={Soccod}",
                        conge.Concod, attempt + 1, maxRetries, conge.Soccod);
                    nextSeq++;
                }
                catch (Exception ex)
                {
                    // Autre erreur (FK, NOT NULL, contexte concurrent…) — on
                    // remonte avec log détaillé et 500 générique au client.
                    _log.LogError(ex,
                        "DemConge.Post — échec persistance pour Soccod={Soccod} Empcod={Empcod} Concod={Concod} Abscod={Abscod}",
                        conge.Soccod, conge.Empcod, conge.Concod, conge.Abscod);
                    return StatusCode(500, new { message = "Échec d'enregistrement de la demande de congé." });
                }
            }

            if (!saved)
            {
                _log.LogError(lastEx,
                    "DemConge.Post — abandon après {Max} tentatives (conflits PK persistants) pour Soccod={Soccod} Empcod={Empcod}",
                    maxRetries, conge.Soccod, conge.Empcod);
                return StatusCode(500, new { message = "Impossible de générer un numéro de demande unique. Réessayez." });
            }

            // Best-effort : un échec de notification (DbContext concurrent, employé
            // introuvable, push provider down…) NE DOIT PAS faire retomber le client
            // sur "Impossible d'ajouter" alors que la demande est bien persistée.
            try
            {
                if (_notify != null)
                {
                    var who = await _context.Employes.AsNoTracking()
                        .Where(e => e.Soccod == conge.Soccod && e.Empcod == conge.Empcod)
                        .Select(e => e.Emplib)
                        .FirstOrDefaultAsync()
                        ?? conge.Empcod ?? "Un employé";
                    _ = _notify.NotifyManagersAsync(
                        "🗓️ Demande de congé à valider",
                        $"{who} attend votre validation.",
                        new { type = "leave_request_created", concod = conge.Concod, soccod = conge.Soccod });
                }
            }
            catch (Exception notifyEx)
            {
                Console.WriteLine($"[DemConges.Post] Notification side-effect failed (ignored, record was saved): {notifyEx.Message}");
            }

            return Ok(new { message = "Demande ajoutée avec succès", concod = conge.Concod });
        }

        // PUT api/<DirectionsController>/5
        [HttpPut]
        [CanUpdateDemConge]
        public async Task<IActionResult> Put([FromBody] Demconge demconge)
        {
            if (demconge == null || string.IsNullOrWhiteSpace(demconge.Concod))
                return BadRequest("Veuillez saisie les champs obligatoires");
            try
            {
                await _demandecongeRepository.UpdateAsync(demconge);
                return Ok("Demande de congé modifiée avec sucées");
            }
            catch (Exception)
            {

                return StatusCode(500);
            }
            
        }

        // DELETE api/<DirectionsController>/5
        [HttpDelete("{soccod}/{concod}")]
        [CanDeleteDemConge]
        public async Task<IActionResult> Delete(string soccod, string concod)
        {
            Demconge? demconge = await _demandecongeRepository.GetByConcodAsync(soccod, concod);
            if (demconge == null)
            {
                return NotFound();
            }
            await _demandecongeRepository.DeleteAsync(demconge);
            return NoContent();
        }
    }
}
