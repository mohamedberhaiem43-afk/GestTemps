using ABRPOINT.Server.Annotations.AutSortieAttributes;
using ABRPOINT.Server.Authorization;
using ABRPOINT.Server.Data;
using ABRPOINT.Server.Dtaos;
using ABRPOINT.Server.Interfaces;
using ABRPOINT.Server.Models;
using ABRPOINT.Server.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;
using System.Threading.Tasks;

namespace ABRPOINT.Server.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    [Authorize]
    [Tenancy.RequirePlanFeature(nameof(Tenancy.PlanFeatures.AuthorizationManagement))]
    public class AutorisersController : ControllerBase
    {
        // Marker injecté côté mobile dans `conmotif` pour distinguer les demandes
        // d'heures sup. des autorisations de sortie classiques (cf.
        // abrpoint.mobile/src/screens/AddRequestScreen.tsx). Les deux flux partagent
        // la table `autoriser` ; seul le préfixe permet de les router vers l'écran
        // de validation dédié côté web.
        private const string OvertimeMotifMarker = "[HEURES SUP]";

        private readonly IautoriserRepository _autoriserRepository;
        private readonly IReportsGenerationService _reportsGenerationService;
        private readonly ApplicationDbContext _db;
        private readonly IUserNotificationService? _notify;
        private readonly IEmailService? _email;
        private readonly ILogger<AutorisersController> _log;

        public AutorisersController(
            IautoriserRepository autoriserRepository,
            IReportsGenerationService reportsGenerationService,
            ApplicationDbContext db,
            ILogger<AutorisersController> log,
            IUserNotificationService? notify = null,
            IEmailService? email = null)
        {
            _autoriserRepository = autoriserRepository;
            _reportsGenerationService = reportsGenerationService;
            _db = db;
            _log = log;
            _notify = notify;
            _email = email;
        }

        // A5 — Validation/refus réservé aux admins et managers. Aligné sur le pattern
        // de DemandeAutorisationsController.CallerCanApproveAsync : Utiadm=1 OU rôle
        // admin OU rôle manager OU permission explicite Autorisations.modify.
        private async Task<bool> CallerCanApproveAsync()
        {
            var caller = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (string.IsNullOrEmpty(caller)) return false;
            var isPrivileged = await _db.Utilisateurs.AsNoTracking()
                .Where(u => u.Uticod == caller)
                .Select(u => u.Utiadm == "1"
                          || PermissionCatalog.IsAdminRole(u.Utirole)
                          || u.Utirole == PermissionCatalog.Roles.Manager)
                .FirstOrDefaultAsync();
            if (isPrivileged) return true;
            return await _db.RolePermissions.AsNoTracking()
                .AnyAsync(rp => rp.Role!.RoleName == _db.Utilisateurs
                                    .Where(u => u.Uticod == caller).Select(u => u.Utirole).FirstOrDefault()
                                && (rp.RpModule == "Autorisations" || rp.RpModule == "Demandes")
                                && rp.RpModify == "1");
        }

        // A4 / A13 — l'utilisateur doit consulter / créer SES propres autorisations.
        // Accepté aussi pour un appelant admin/privilégié (manager/RH).
        private async Task<bool> CallerOwnsOrCanManageAsync(string targetEmpcod)
        {
            var caller = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (string.IsNullOrEmpty(caller)) return false;
            if (string.Equals(caller, targetEmpcod, StringComparison.OrdinalIgnoreCase)) return true;
            return await _db.Utilisateurs.AsNoTracking()
                .Where(u => u.Uticod == caller)
                .Select(u => u.Utiadm == "1" || PermissionCatalog.IsAdminRole(u.Utirole))
                .FirstOrDefaultAsync();
        }

        // GET: api/Autorisers/my-auths/{soccod}/{empcod} - Employee self-service (no special permission needed)
        [HttpGet("my-auths/{soccod}/{empcod}")]
        public async Task<IActionResult> GetMyAuthorizations(string soccod, string empcod)
        {
            if (string.IsNullOrWhiteSpace(soccod) || string.IsNullOrWhiteSpace(empcod))
                return BadRequest("Veuillez remplir les champs obligatoires");
            // A13 — un employé ne peut consulter QUE ses propres autorisations.
            if (!await CallerOwnsOrCanManageAsync(empcod)) return Forbid();
            try
            {
                List<AutoriserEmployeDto> result = await _autoriserRepository.GetAutoriserWithAbsenceAsync(soccod, empcod);
                return Ok(result ?? new List<AutoriserEmployeDto>());
            }
            catch (Exception)
            {
                return StatusCode(500);
            }
        }

        // GET: api/<DirectionsController>
        [HttpGet("{soccod}/{uticod}")]
        [CanGetAutSortie]
        public async Task<IActionResult> Get(string soccod, string uticod)
        {
            if (string.IsNullOrWhiteSpace(soccod)|| string.IsNullOrWhiteSpace(uticod))
                return BadRequest("Veuillez remplir les champs obligatoires");
            try
            {
                List<AutoriserEmployeDto> result = await _autoriserRepository.GetAutoriserWithAbsenceAsync(soccod, uticod);

                if (result == null)
                {
                    return NotFound();
                }

                return Ok(result);
            }
            catch (Exception)
            {

                return StatusCode(500);
            }
            
        }

        // GET: api/Autorisers/all/{soccod} — liste de TOUTES les autorisations de la
        // société (écran de gestion). Le segment littéral « all » prime sur la route
        // {soccod}/{uticod} dans le routage attribut, donc pas de collision.
        [HttpGet("all/{soccod}")]
        [CanGetAutSortie]
        public async Task<IActionResult> GetAll(string soccod)
        {
            if (string.IsNullOrWhiteSpace(soccod))
                return BadRequest("Veuillez remplir les champs obligatoires");
            try
            {
                List<AutoriserEmployeDto> result = await _autoriserRepository.GetAllAutoriserWithAbsenceAsync(soccod);
                return Ok(result ?? new List<AutoriserEmployeDto>());
            }
            catch (Exception)
            {
                return StatusCode(500);
            }
        }

        [HttpGet("get-autorisation/{soccod}/{concod}")]
        [CanGetAutSortie]
        public async Task<IActionResult> GetAutoriser(string soccod,string concod)
        {
            if (string.IsNullOrWhiteSpace(soccod) || string.IsNullOrWhiteSpace(concod))
                return BadRequest("Veuillez saisie les champs obligatoires");
            try
            {
                Autoriser autoriser = await _autoriserRepository.GetByConcodAsync(soccod, concod);
                return Ok(autoriser);
            }
            catch (Exception)
            {

                return StatusCode(500);
            }
        }
        [HttpGet("get-autorisation-report/{soccod}/{concod}")]
        [CanGetAutSortie]
        public IActionResult GetAutoriserReport(string soccod,string concod)
        {
            if (string.IsNullOrWhiteSpace(soccod) || string.IsNullOrWhiteSpace(concod))
                return BadRequest("Veuillez saisie les champs obligatoires");
            try
            {
                byte[] pdfBytes = _reportsGenerationService.GenerateAutorisationSortieReport(soccod, concod);
                return File(pdfBytes, "application/pdf", "AutorisationSortie.pdf");
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = "Erreur lors de récupérer des contrats", details = "Erreur interne. Consultez les logs serveur pour le détail." });
            }
        }


        // DTO « create » pour my-auth : le Concod est généré côté serveur (cf. plus
        // bas) et donc OPTIONNEL côté requête. On ne peut pas réutiliser le modèle
        // Autoriser comme corps direct : son champ Concod est `[Required]`, et avec
        // `[ApiController]` ASP.NET court-circuite l'action sur ModelState invalide
        // → 400 systématique avant que la logique d'auto-génération ne s'exécute.
        // Ce DTO miroir ne déclare aucun champ requis pour laisser passer la requête,
        // puis on mappe vers Autoriser dans l'action.
        public sealed class CreateMyAuthDto
        {
            public string? Concod { get; set; }
            public string? Soccod { get; set; }
            public string? Empcod { get; set; }
            public DateTime? Condat { get; set; }
            public string? Conjour { get; set; }
            public DateTime? Condep { get; set; }
            public string? Conamdep { get; set; }
            public DateTime? Conret { get; set; }
            public string? Conamret { get; set; }
            public string? Abscod { get; set; }
            public string? Conmotif { get; set; }
            public string? Consanc { get; set; }
            public float? Connbjour { get; set; }
            public string? Conref { get; set; }
            public string? Conaffecte { get; set; }
        }

        // POST api/Autorisers/my-auth - Employee self-service create (no special permission)
        // A4 — `autoriser.Empcod` doit correspondre à l'appelant. Sinon n'importe quel
        // employé peut créer une autorisation au nom de n'importe quel collègue.
        [HttpPost("my-auth")]
        public async Task<IActionResult> PostMyAuthorization([FromBody] CreateMyAuthDto dto)
        {
            if (dto == null)
                return BadRequest("Veuillez saisir les champs obligatoires");
            try
            {
                var caller = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
                if (string.IsNullOrEmpty(caller)) return Unauthorized();

                var autoriser = new Autoriser
                {
                    Concod = dto.Concod ?? string.Empty, // placeholder ; renseigné plus bas
                    Soccod = dto.Soccod,
                    Empcod = dto.Empcod,
                    Condat = dto.Condat,
                    Conjour = dto.Conjour,
                    Condep = dto.Condep,
                    Conamdep = dto.Conamdep,
                    Conret = dto.Conret,
                    Conamret = dto.Conamret,
                    Abscod = dto.Abscod,
                    Conmotif = dto.Conmotif,
                    Consanc = dto.Consanc,
                    Connbjour = dto.Connbjour,
                    Conref = dto.Conref,
                    Conaffecte = dto.Conaffecte,
                };

                if (string.IsNullOrEmpty(autoriser.Empcod))
                {
                    // Permissif : on aligne sur l'appelant si le client n'a pas posé l'empcod.
                    autoriser.Empcod = caller;
                }
                else if (!await CallerOwnsOrCanManageAsync(autoriser.Empcod))
                {
                    return Forbid();
                }

                // Heures sup. : marquer en attente de validation. Détection via le préfixe
                // `[HEURES SUP]` que le mobile injecte dans Conmotif (AddRequestScreen.tsx).
                // Les autorisations de sortie classiques restent sans état (NULL) pour ne
                // pas changer leur flux historique.
                if (!string.IsNullOrEmpty(autoriser.Conmotif)
                    && autoriser.Conmotif.Contains(OvertimeMotifMarker, StringComparison.OrdinalIgnoreCase))
                {
                    autoriser.Conetat = "Pending";
                }

                // Auto-génération du Concod si le client n'en fournit pas — permet à un
                // front (web ou autre intégration) de poster sans avoir à appeler un
                // endpoint séparé `get-next-concod`. Le mobile continue de pouvoir
                // pré-affecter une valeur (via DemConges.get-next-concod) ; on respecte
                // alors sa préférence. Format : "A" + yyMM + séquence 5 digits, aligné
                // sur Sanction.InsertSanctionFromDemandeAsync.
                if (string.IsNullOrWhiteSpace(autoriser.Concod) && !string.IsNullOrEmpty(autoriser.Soccod))
                {
                    var prefix = "A" + DateTime.Now.ToString("yyMM");
                    var maxConcod = await _db.Autorisers.AsNoTracking()
                        .Where(a => a.Soccod == autoriser.Soccod && a.Concod.StartsWith(prefix))
                        .OrderByDescending(a => a.Concod)
                        .Select(a => a.Concod)
                        .FirstOrDefaultAsync();
                    int nextSeq = 1;
                    if (!string.IsNullOrEmpty(maxConcod) && maxConcod.Length > prefix.Length
                        && int.TryParse(maxConcod.Substring(prefix.Length), out int lastSeq))
                    {
                        nextSeq = lastSeq + 1;
                    }
                    autoriser.Concod = prefix + nextSeq.ToString("D5");
                }

                await _autoriserRepository.AddAsync(autoriser);

                // Notifie admins/managers qu'une nouvelle demande d'heures sup. est à traiter
                // (fire-and-forget — l'employé n'attend pas la livraison du push).
                if (autoriser.Conetat == "Pending" && _notify != null)
                {
                    var employeName = await _db.Employes.AsNoTracking()
                        .Where(e => e.Soccod == autoriser.Soccod && e.Empcod == autoriser.Empcod)
                        .Select(e => e.Emplib)
                        .FirstOrDefaultAsync() ?? autoriser.Empcod;
                    _ = _notify.NotifyManagersForEmployeeAsync(
                        autoriser.Soccod ?? string.Empty, autoriser.Empcod ?? string.Empty,
                        "⏱️ Nouvelle demande d'heures supplémentaires",
                        $"{employeName} attend votre validation.",
                        new { type = "overtime_request_pending", concod = autoriser.Concod, soccod = autoriser.Soccod });
                }

                return Ok(new { message = "Autorisation de sortie envoyée avec succès", concod = autoriser.Concod });
            }
            catch (Exception)
            {
                return StatusCode(500);
            }
        }

        // POST api/<DirectionsController>
        [HttpPost]
        [CanAddAutSortie]
        public async Task Post([FromBody] Autoriser autoriser)
        {
            try
            {
                await _autoriserRepository.AddAsync(autoriser);
            }
            catch (Exception)
            {
                throw;
            }
        }
        [HttpPut("bulk")]
        [CanAddAutSortieGeneral]
        [Tenancy.RequirePlanFeature(nameof(Tenancy.PlanFeatures.GeneralExit))]
        public async Task BulkPost([FromBody] List<Autoriser> autorisers)
        {
            try
            {
                await _autoriserRepository.AddMultipleAutorisation(autorisers);
            }
            catch (Exception)
            {
                throw;
            }
        }

        // PUT api/<DirectionsController>/5
        [HttpPut]
        [CanUpdateAutSortie]
        public async Task<IActionResult> Put([FromBody] Autoriser autoriser)
        {
            if (autoriser == null)
                return BadRequest("Veuillez saisie les champs obligatoires");
            try
            {
                await _autoriserRepository.UpdateAsync(autoriser);
                return Ok("Autorisation de sortie modifiée avec succées");
            }
            catch (Exception)
            {

                return StatusCode(500);
            }
            
        }

        // DELETE api/<DirectionsController>/5
        [HttpDelete("{soccod}/{concod}")]
        [CanDeleteAutSortie]
        public async Task<IActionResult> Delete(string soccod,string concod)
        {
            Autoriser autoriser = await _autoriserRepository.GetByConcodAsync(soccod,concod);
            if (autoriser == null)
            {
                return NotFound();
            }
            await _autoriserRepository.DeleteAsync(autoriser);
            return NoContent();
        }

        // DELETE api/Autorisers/my-auth/{soccod}/{concod} — self-service : l'employé supprime
        // SA propre demande (typiquement une demande d'heures sup. créée depuis le mobile),
        // sans la permission « CanDeleteAutSortie » réservée aux gestionnaires. Garde-fous :
        //   - ownership (l'appelant doit être le propriétaire, ou un admin/manager) ;
        //   - on ne supprime QU'une demande encore en attente : une fois validée/refusée
        //     (Conetat ≠ Pending), elle est figée pour préserver la traçabilité paie.
        [HttpDelete("my-auth/{soccod}/{concod}")]
        public async Task<IActionResult> DeleteMyAuthorization(string soccod, string concod)
        {
            if (string.IsNullOrWhiteSpace(soccod) || string.IsNullOrWhiteSpace(concod))
                return BadRequest("Veuillez remplir les champs obligatoires");

            var autoriser = await _autoriserRepository.GetByConcodAsync(soccod, concod);
            if (autoriser == null) return NotFound();

            if (!await CallerOwnsOrCanManageAsync(autoriser.Empcod ?? string.Empty)) return Forbid();

            if (!string.IsNullOrEmpty(autoriser.Conetat)
                && !string.Equals(autoriser.Conetat, "Pending", StringComparison.OrdinalIgnoreCase))
            {
                return Conflict(new { message = "Cette demande a déjà été traitée : elle ne peut plus être supprimée." });
            }

            await _autoriserRepository.DeleteAsync(autoriser);
            return NoContent();
        }

        // ───────────────────────────────────────────────────────────────────────
        // Validation des demandes d'heures supplémentaires (web admin/manager)
        // ───────────────────────────────────────────────────────────────────────
        // Le mobile crée les heures sup. via POST /Autorisers/my-auth avec un
        // préfixe `[HEURES SUP]` dans Conmotif. Le web a besoin d'une vue dédiée
        // pour lister/valider/refuser, distincte du flux Autorisations de sortie
        // classique. Les 3 endpoints suivants n'agissent QUE sur les demandes
        // marquées avec ce préfixe pour éviter d'altérer accidentellement une
        // autorisation de sortie ordinaire.

        public sealed class OvertimeApprovalRequest
        {
            /// <summary>Commentaire libre. Obligatoire en cas de refus pour que l'employé
            /// comprenne le motif ; optionnel à l'approbation (peut servir à indiquer
            /// une majoration spéciale, un plafond, etc.).</summary>
            public string? Commentaire { get; set; }
        }

        /// <summary>
        /// Liste les demandes d'heures supplémentaires d'une société, optionnellement
        /// filtrées par état. Réservé aux admins/managers — un employé doit utiliser
        /// `/my-auths/...` pour ses propres demandes.
        /// </summary>
        [HttpGet("heures-sup/{soccod}")]
        public async Task<IActionResult> GetOvertimeRequests(string soccod, [FromQuery] string? etat = null)
        {
            if (string.IsNullOrWhiteSpace(soccod))
                return BadRequest(new { message = "Société requise." });
            if (!await CallerCanApproveAsync()) return Forbid();

            try
            {
                var query = _db.Autorisers.AsNoTracking()
                    .Where(a => a.Soccod == soccod
                                && a.Conmotif != null
                                && EF.Functions.ILike(a.Conmotif, "%" + OvertimeMotifMarker + "%"));

                // Isolation PAR SITE : un valideur non-admin ne voit que les demandes
                // d'heures sup. des employés rattachés à SES sites (Socuser).
                var callerHs = User.FindFirst(ClaimTypes.NameIdentifier)?.Value ?? string.Empty;
                if (!await SiteAccess.IsAdminAsync(_db, callerHs))
                {
                    query = query.Where(a => _db.Employes.Any(e =>
                        e.Soccod == a.Soccod && e.Empcod == a.Empcod && e.Sitcod != null &&
                        _db.Socusers.Any(s => s.Uticod == callerHs && s.Soccod == e.Soccod && s.Sitcod == e.Sitcod)));
                }

                if (!string.IsNullOrWhiteSpace(etat))
                {
                    // "Pending" inclut les lignes NULL (legacy avant l'ajout de Conetat).
                    if (string.Equals(etat, "Pending", StringComparison.OrdinalIgnoreCase))
                        query = query.Where(a => a.Conetat == null || a.Conetat == "Pending");
                    else
                        query = query.Where(a => a.Conetat == etat);
                }

                // Jointure manuelle vers `employe` pour récupérer Emplib (affichage RH-friendly).
                // Pas d'Include() : pas de relation EF Core formelle sur la clé composite.
                var rows = await (from a in query
                                  join e in _db.Employes.AsNoTracking()
                                       on new { a.Soccod, a.Empcod } equals new { e.Soccod, e.Empcod } into je
                                  from emp in je.DefaultIfEmpty()
                                  orderby a.Condat descending
                                  select new
                                  {
                                      concod = a.Concod,
                                      soccod = a.Soccod,
                                      empcod = a.Empcod,
                                      emplib = emp != null ? emp.Emplib : null,
                                      empemail = emp != null ? emp.Empemail : null,
                                      condat = a.Condat,
                                      condep = a.Condep,
                                      conret = a.Conret,
                                      conmotif = a.Conmotif,
                                      conetat = a.Conetat ?? "Pending",
                                      contraitepar = a.Contraitepar,
                                      contraitedat = a.Contraitedat,
                                      concommentaire = a.Concommentaire,
                                  })
                                  .ToListAsync();

                return Ok(rows);
            }
            catch (Exception ex)
            {
                _log.LogError(ex, "GetOvertimeRequests échec — soccod={Soccod}", soccod);
                return StatusCode(500, new { message = "Erreur lors de la récupération des heures supplémentaires." });
            }
        }

        /// <summary>
        /// Valide une demande d'heures supplémentaires. Notifie l'employé par push/in-app
        /// + email. Idempotent : un appel sur une demande déjà traitée renvoie 409.
        /// </summary>
        [HttpPost("heures-sup/{soccod}/{concod}/approve")]
        public Task<IActionResult> ApproveOvertime(string soccod, string concod, [FromBody] OvertimeApprovalRequest? body)
            => HandleOvertimeDecisionAsync(soccod, concod, approve: true, body?.Commentaire);

        /// <summary>
        /// Refuse une demande d'heures supplémentaires. Le commentaire est obligatoire
        /// pour que l'employé comprenne le motif.
        /// </summary>
        [HttpPost("heures-sup/{soccod}/{concod}/refuse")]
        public Task<IActionResult> RefuseOvertime(string soccod, string concod, [FromBody] OvertimeApprovalRequest? body)
            => HandleOvertimeDecisionAsync(soccod, concod, approve: false, body?.Commentaire);

        private async Task<IActionResult> HandleOvertimeDecisionAsync(string soccod, string concod, bool approve, string? commentaire)
        {
            if (string.IsNullOrWhiteSpace(soccod) || string.IsNullOrWhiteSpace(concod))
                return BadRequest(new { message = "Société et code de demande requis." });
            if (!approve && string.IsNullOrWhiteSpace(commentaire))
                return BadRequest(new { message = "Un commentaire est obligatoire pour refuser une demande." });
            if (!await CallerCanApproveAsync()) return Forbid();

            var caller = User.FindFirst(ClaimTypes.NameIdentifier)?.Value ?? "";

            try
            {
                // On charge la ligne en tracking pour pouvoir la modifier.
                var autoriser = await _db.Autorisers
                    .FirstOrDefaultAsync(a => a.Soccod == soccod && a.Concod == concod);
                if (autoriser == null) return NotFound(new { message = "Demande introuvable." });

                // Guard : on n'agit que sur les heures sup. (préfixe Conmotif). Sans ce
                // garde-fou, un appelant pourrait détourner cet endpoint pour modifier
                // une autorisation de sortie classique en contournant les permissions
                // dédiées (CanUpdateAutSortie).
                if (string.IsNullOrEmpty(autoriser.Conmotif)
                    || !autoriser.Conmotif.Contains(OvertimeMotifMarker, StringComparison.OrdinalIgnoreCase))
                {
                    return BadRequest(new { message = "Cette demande n'est pas une demande d'heures supplémentaires." });
                }

                var current = autoriser.Conetat ?? "Pending";
                if (!string.Equals(current, "Pending", StringComparison.OrdinalIgnoreCase))
                {
                    return Conflict(new
                    {
                        message = $"Cette demande a déjà été traitée ({current}).",
                        conetat = current,
                    });
                }

                autoriser.Conetat = approve ? "Approved" : "Rejected";
                autoriser.Contraitepar = caller;
                autoriser.Contraitedat = DateTime.UtcNow;
                autoriser.Concommentaire = commentaire;
                await _db.SaveChangesAsync();

                // Récupère l'email + nom pour la notif (best-effort, ne bloque pas la réponse
                // si l'employé n'a pas de compte ou pas d'email).
                var employee = await _db.Employes.AsNoTracking()
                    .Where(e => e.Soccod == autoriser.Soccod && e.Empcod == autoriser.Empcod)
                    .Select(e => new { e.Emplib, e.Empemail })
                    .FirstOrDefaultAsync();

                var displayDate = autoriser.Condat?.ToString("dd/MM/yyyy") ?? "—";

                // 1. In-app + push
                if (_notify != null && !string.IsNullOrEmpty(autoriser.Empcod))
                {
                    var title = approve
                        ? "✅ Heures supplémentaires validées"
                        : "❌ Heures supplémentaires refusées";
                    var bodyText = approve
                        ? $"Votre demande du {displayDate} a été validée."
                            + (string.IsNullOrWhiteSpace(commentaire) ? "" : $" Note : {commentaire}")
                        : $"Votre demande du {displayDate} a été refusée. Motif : {commentaire}";
                    _ = _notify.NotifyUserAsync(autoriser.Empcod, title, bodyText,
                        new { type = approve ? "overtime_request_approved" : "overtime_request_rejected", concod, soccod });
                }

                // 2. Email — best-effort, on log mais on ne fait pas échouer la réponse
                // (l'action métier est déjà persistée). Le destinataire doit avoir un
                // Empemail valide ; sinon on saute silencieusement.
                if (_email != null && !string.IsNullOrWhiteSpace(employee?.Empemail))
                {
                    try
                    {
                        var subject = approve
                            ? "Vos heures supplémentaires ont été validées"
                            : "Vos heures supplémentaires ont été refusées";
                        var html = BuildOvertimeDecisionEmail(
                            employeeName: employee.Emplib ?? autoriser.Empcod ?? "",
                            approved: approve,
                            date: displayDate,
                            depart: autoriser.Condep,
                            retour: autoriser.Conret,
                            motif: autoriser.Conmotif,
                            commentaire: commentaire);
                        await _email.SendEmailAsync(employee.Empemail!, subject, html);
                    }
                    catch (Exception ex)
                    {
                        _log.LogWarning(ex, "Email de notification heures sup. non envoyé — concod={Concod} empcod={Empcod}", concod, autoriser.Empcod);
                    }
                }

                return Ok(new
                {
                    success = true,
                    conetat = autoriser.Conetat,
                    message = approve ? "Demande d'heures supplémentaires validée." : "Demande d'heures supplémentaires refusée.",
                });
            }
            catch (Exception ex)
            {
                _log.LogError(ex, "Traitement heures sup. échec — soccod={Soccod} concod={Concod} approve={Approve}", soccod, concod, approve);
                return StatusCode(500, new { message = "Erreur interne lors du traitement de la demande." });
            }
        }

        /// <summary>Email HTML simple, aligné stylistiquement sur les autres mails RH
        /// (cf. EmailTemplates.cs). On évite d'introduire un nouveau template pour
        /// rester localisé ; à factoriser dans EmailTemplates si d'autres flux
        /// d'autorisation gagnent le même mail (refus de mission, etc.).</summary>
        private static string BuildOvertimeDecisionEmail(string employeeName, bool approved, string date, DateTime? depart, DateTime? retour, string? motif, string? commentaire)
        {
            var statusLabel = approved ? "validée" : "refusée";
            var statusColor = approved ? "#16a34a" : "#dc2626";
            var statusIcon = approved ? "✅" : "❌";
            var horaire = (depart.HasValue && retour.HasValue)
                ? $"{depart.Value:HH:mm} – {retour.Value:HH:mm}"
                : "—";
            var commentaireBlock = string.IsNullOrWhiteSpace(commentaire)
                ? ""
                : $"<p style='margin:12px 0;padding:12px;background:#f8fafc;border-left:3px solid {statusColor};border-radius:4px;'><strong>Note du validateur :</strong><br>{System.Net.WebUtility.HtmlEncode(commentaire)}</p>";

            return $@"<!DOCTYPE html>
<html><body style='font-family:Arial,Helvetica,sans-serif;color:#1e293b;max-width:560px;margin:0 auto;padding:24px;'>
  <h2 style='color:{statusColor};margin:0 0 16px;'>{statusIcon} Heures supplémentaires {statusLabel}</h2>
  <p>Bonjour {System.Net.WebUtility.HtmlEncode(employeeName)},</p>
  <p>Votre demande d'heures supplémentaires a été <strong style='color:{statusColor};'>{statusLabel}</strong>.</p>
  <table style='width:100%;border-collapse:collapse;margin:16px 0;font-size:14px;'>
    <tr><td style='padding:8px;border-bottom:1px solid #e2e8f0;color:#64748b;'>Date</td><td style='padding:8px;border-bottom:1px solid #e2e8f0;'><strong>{date}</strong></td></tr>
    <tr><td style='padding:8px;border-bottom:1px solid #e2e8f0;color:#64748b;'>Horaire</td><td style='padding:8px;border-bottom:1px solid #e2e8f0;'>{horaire}</td></tr>
    <tr><td style='padding:8px;color:#64748b;'>Motif</td><td style='padding:8px;'>{System.Net.WebUtility.HtmlEncode(motif ?? "—")}</td></tr>
  </table>
  {commentaireBlock}
  <p style='margin-top:24px;font-size:12px;color:#94a3b8;'>Concorde Workly — Notification automatique</p>
</body></html>";
        }
    }
}
