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

namespace ABRPOINT.Server.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    [Authorize]
    public class DemandeAutorisationsController : ControllerBase
    {
        private readonly IDemandeAutorisationRepository _repository;
        private readonly ApplicationDbContext _context;
        private readonly IUserNotificationService? _notify;

        public DemandeAutorisationsController(IDemandeAutorisationRepository repository, ApplicationDbContext context, IUserNotificationService? notify = null)
        {
            _repository = repository;
            _context = context;
            _notify = notify;
        }

        // A5 — Helper : un appelant qui valide/refuse une demande doit être manager/admin
        // (pas un simple employé). Sans ce check, n'importe quel utilisateur authentifié
        // peut approuver sa propre demande.
        private async Task<bool> CallerCanApproveAsync()
        {
            var caller = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (string.IsNullOrEmpty(caller)) return false;
            return await _context.Utilisateurs.AsNoTracking()
                .Where(u => u.Uticod == caller)
                .Select(u => u.Utiadm == "1" || PermissionCatalog.IsAdminRole(u.Utirole))
                .FirstOrDefaultAsync()
                || await _context.RolePermissions.AsNoTracking()
                    .AnyAsync(rp => rp.Role!.RoleName == _context.Utilisateurs
                                        .Where(u => u.Uticod == caller).Select(u => u.Utirole).FirstOrDefault()
                                    && (rp.RpModule == "Autorisations" || rp.RpModule == "Demandes")
                                    && rp.RpModify == "1");
        }

        private async Task<bool> CallerOwnsOrManagesAsync(string targetEmpcod)
        {
            var caller = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (string.IsNullOrEmpty(caller)) return false;
            if (string.Equals(caller, targetEmpcod, StringComparison.OrdinalIgnoreCase)) return true;
            return await _context.Utilisateurs.AsNoTracking()
                .Where(u => u.Uticod == caller)
                .Select(u => u.Utiadm == "1" || PermissionCatalog.IsAdminRole(u.Utirole))
                .FirstOrDefaultAsync();
        }

        // GET: api/DemandeAutorisations/get-next-concod/{soccod}
        // A16 — Permission requise pour empêcher l'énumération.
        [HttpGet("get-next-concod/{soccod}")]
        [CanAddAutSortie]
        public async Task<IActionResult> GetNextConcod(string soccod)
        {
            try
            {
                var now = DateTime.Now;
                var prefix = "A" + now.ToString("yyMM");

                var maxConcod = await _context.DemandeAutorisations
                    .Where(d => d.Soccod == soccod && d.Concod != null && d.Concod.StartsWith(prefix))
                    .OrderByDescending(d => d.Concod)
                    .Select(d => d.Concod)
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
                return StatusCode(500, "Erreur lors de la génération du numéro: " + ex.Message);
            }
        }

        // GET: api/DemandeAutorisations/get-all/{soccod}/{uticod}
        // A5 — Liste globale des demandes : restreint aux managers / admins.
        [HttpGet("get-all/{soccod}/{uticod}")]
        [CanGetAutSortie]
        public async Task<IActionResult> GetAll(string soccod, string uticod)
        {
            if (string.IsNullOrWhiteSpace(soccod) || string.IsNullOrWhiteSpace(uticod))
                return BadRequest("Veuillez remplir les champs obligatoires");
            try
            {
                var result = await _repository.GetAllBySocieteAsync(soccod, uticod);
                return Ok(result);
            }
            catch (Exception)
            {
                return StatusCode(500);
            }
        }

        // GET: api/DemandeAutorisations/get-by-employe/{soccod}/{empcod}
        // A13 — Self-service : on ne consulte ses demandes que sur soi-même, sinon manager/admin.
        [HttpGet("get-by-employe/{soccod}/{empcod}")]
        public async Task<IActionResult> GetByEmploye(string soccod, string empcod)
        {
            if (string.IsNullOrWhiteSpace(soccod) || string.IsNullOrWhiteSpace(empcod))
                return BadRequest("Veuillez remplir les champs obligatoires");
            if (!await CallerOwnsOrManagesAsync(empcod)) return Forbid();
            try
            {
                var result = await _repository.GetByEmployeAsync(soccod, empcod);
                return Ok(result);
            }
            catch (Exception)
            {
                return StatusCode(500);
            }
        }

        // GET: api/DemandeAutorisations/{id}
        // SEC AI : avant ce check, n'importe qui pouvait énumérer les IDs entiers et lire la
        // demande d'un autre employé (date, motif, statut). On charge la demande, puis on
        // vérifie que l'appelant est l'employé concerné OU manager/admin.
        [HttpGet("{id}")]
        public async Task<IActionResult> GetById(int id)
        {
            try
            {
                var result = await _repository.GetByIdAsync(id);
                if (result == null) return NotFound();
                if (!await CallerOwnsOrManagesAsync(result.Empcod ?? string.Empty)) return Forbid();
                return Ok(result);
            }
            catch (Exception)
            {
                return StatusCode(500);
            }
        }

        // POST: api/DemandeAutorisations
        // A4 — `demande.Empcod` doit être l'appelant (un manager peut soumettre pour autrui).
        [HttpPost]
        public async Task<IActionResult> Create([FromBody] DemandeAutorisation demande)
        {
            if (demande == null)
                return BadRequest("Veuillez saisir les champs obligatoires");
            try
            {
                var caller = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
                if (string.IsNullOrEmpty(caller)) return Unauthorized();
                if (string.IsNullOrEmpty(demande.Empcod))
                {
                    demande.Empcod = caller;
                }
                else if (!await CallerOwnsOrManagesAsync(demande.Empcod))
                {
                    return Forbid();
                }

                var result = await _repository.AddAsync(demande);
                if (_notify != null)
                {
                    // Récupère le nom de l'employé pour rendre la notif intelligible au manager
                    // sans qu'il ait à ouvrir l'écran ("X attend votre validation" >>> "Une demande a été soumise").
                    var who = await _context.Employes.AsNoTracking()
                        .Where(e => e.Soccod == demande.Soccod && e.Empcod == demande.Empcod)
                        .Select(e => e.Emplib)
                        .FirstOrDefaultAsync()
                        ?? demande.Empcod ?? "Un collaborateur";
                    _ = _notify.NotifyManagersAsync(
                        "⏱️ Autorisation de sortie à valider",
                        $"{who} attend votre validation.",
                        new { type = "auth_request_created", id = (result as DemandeAutorisation)?.Id, soccod = demande.Soccod });
                }
                return Ok(new { success = true, message = "Demande d'autorisation créée avec succès", data = result });
            }
            catch (Exception)
            {
                return StatusCode(500);
            }
        }

        // PUT: api/DemandeAutorisations
        // SEC AI : on revalide l'ownership sur la demande EXISTANTE (pas sur le payload — un
        // attaquant pourrait soumettre Empcod=lui pour passer le check). On lit l'enregistrement
        // par son Id puis on vérifie que l'appelant le possède ou le gère.
        [HttpPut]
        public async Task<IActionResult> Update([FromBody] DemandeAutorisation demande)
        {
            if (demande == null)
                return BadRequest("Veuillez saisir les champs obligatoires");
            try
            {
                var existing = await _repository.GetByIdAsync(demande.Id);
                if (existing == null) return NotFound(new { message = "Demande introuvable" });
                if (!await CallerOwnsOrManagesAsync(existing.Empcod ?? string.Empty)) return Forbid();

                var result = await _repository.UpdateAsync(demande);
                if (result == null)
                    return BadRequest("Demande introuvable ou déjà traitée");
                return Ok(new { success = true, message = "Demande d'autorisation modifiée avec succès" });
            }
            catch (Exception)
            {
                return StatusCode(500);
            }
        }

        // DELETE: api/DemandeAutorisations/{id}
        // SEC AI : ownership check pour éviter qu'un attaquant ne supprime les demandes
        // (et l'audit trail) d'autres employés en énumérant les Id.
        [HttpDelete("{id}")]
        public async Task<IActionResult> Delete(int id)
        {
            try
            {
                var existing = await _repository.GetByIdAsync(id);
                if (existing == null) return NotFound();
                if (!await CallerOwnsOrManagesAsync(existing.Empcod ?? string.Empty)) return Forbid();

                var deleted = await _repository.DeleteAsync(id);
                if (!deleted) return NotFound();
                return NoContent();
            }
            catch (Exception)
            {
                return StatusCode(500);
            }
        }

        // POST: api/DemandeAutorisations/approve/{id}
        // A5 — Validation réservée aux managers/admins. Sans, un employé pouvait
        // approuver sa propre demande en pointant l'id depuis l'URL.
        [HttpPost("approve/{id}")]
        public async Task<IActionResult> Approve(int id, [FromBody] DemandeAutorisationTraitementDto traitement)
        {
            if (!await CallerCanApproveAsync()) return Forbid();
            try
            {
                var result = await _repository.ApproveAsync(id, traitement.TraitePar ?? "", traitement.Commentaire);
                if (!result.Success)
                    return BadRequest(new { success = false, message = result.Message });
                if (_notify != null)
                {
                    var demande = await _context.DemandeAutorisations.AsNoTracking().FirstOrDefaultAsync(d => d.Id == id);
                    if (!string.IsNullOrEmpty(demande?.Empcod))
                    {
                        _ = _notify.NotifyUserAsync(demande.Empcod,
                            "✅ Votre autorisation est validée",
                            "Bonne nouvelle : votre demande d'autorisation est acceptée.",
                            new { type = "auth_request_accepted", id });
                    }
                }
                return Ok(new { success = true, message = result.Message });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { success = false, message = $"Erreur interne du serveur: {ex.Message}" });
            }
        }

        // POST: api/DemandeAutorisations/refuse/{id}
        // A5 — Refus réservé aux managers/admins.
        [HttpPost("refuse/{id}")]
        public async Task<IActionResult> Refuse(int id, [FromBody] DemandeAutorisationTraitementDto traitement)
        {
            if (!await CallerCanApproveAsync()) return Forbid();
            try
            {
                var result = await _repository.RefuseAsync(id, traitement.TraitePar ?? "", traitement.Commentaire);
                if (!result.Success)
                    return BadRequest(new { success = false, message = result.Message });
                if (_notify != null)
                {
                    var demande = await _context.DemandeAutorisations.AsNoTracking().FirstOrDefaultAsync(d => d.Id == id);
                    if (!string.IsNullOrEmpty(demande?.Empcod))
                    {
                        _ = _notify.NotifyUserAsync(demande.Empcod,
                            "❌ Votre autorisation est refusée",
                            "Votre demande n'a pas été acceptée. Consultez le motif dans Demandes et validations.",
                            new { type = "auth_request_refused", id });
                    }
                }
                return Ok(new { success = true, message = result.Message });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { success = false, message = $"Erreur interne du serveur: {ex.Message}" });
            }
        }
    }
}