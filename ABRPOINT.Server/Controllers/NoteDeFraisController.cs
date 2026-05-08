using ABRPOINT.Server.Authorization;
using ABRPOINT.Server.Data;
using ABRPOINT.Server.Helpers;
using ABRPOINT.Server.Interfaces;
using ABRPOINT.Server.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;

namespace ABRPOINT.Server.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    [Authorize]
    public class NoteDeFraisController : ControllerBase
    {
        private readonly INoteDeFraisRepository _repository;
        private readonly IMissionRepository _missionRepository;
        private readonly ApplicationDbContext _db;

        public NoteDeFraisController(INoteDeFraisRepository repository, IMissionRepository missionRepository, ApplicationDbContext db)
        {
            _repository = repository;
            _missionRepository = missionRepository;
            _db = db;
        }

        // SEC-08 — Helpers d'autorisation : un employé ne voit/crée que SES notes ;
        // l'approbation/suppression est réservée aux managers/admins.
        private async Task<bool> CallerIsAdminOrManagerAsync()
        {
            var caller = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (string.IsNullOrEmpty(caller)) return false;
            return await _db.Utilisateurs.AsNoTracking()
                .Where(u => u.Uticod == caller)
                .Select(u => u.Utiadm == "1"
                          || PermissionCatalog.IsAdminRole(u.Utirole)
                          || u.Utirole == PermissionCatalog.Roles.Manager)
                .FirstOrDefaultAsync();
        }

        private async Task<bool> CallerOwnsOrCanManageAsync(string targetEmpcod)
        {
            var caller = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (string.IsNullOrEmpty(caller)) return false;
            if (string.Equals(caller, targetEmpcod, StringComparison.OrdinalIgnoreCase)) return true;
            return await CallerIsAdminOrManagerAsync();
        }

        // SEC-08 — Liste globale : managers/admins uniquement.
        [HttpGet("by-soc/{soccod}")]
        public async Task<ActionResult<IEnumerable<NoteDeFrais>>> GetBySoc(string soccod)
        {
            if (!await CallerIsAdminOrManagerAsync()) return Forbid();
            try
            {
                return Ok(await _repository.GetAllBySoc(soccod));
            }
            catch (Exception)
            {
                throw;
            }
        }

        // SEC-08 — Liste par employé : self-service ou manager/admin.
        [HttpGet("by-emp/{soccod}/{empcod}")]
        public async Task<ActionResult<IEnumerable<NoteDeFrais>>> GetByEmp(string soccod, string empcod)
        {
            if (!await CallerOwnsOrCanManageAsync(empcod)) return Forbid();
            try
            {
                return Ok(await _repository.GetByEmp(soccod, empcod));
            }
            catch (Exception)
            {
                throw;
            }
        }

        // SEC-08 — Détail par ID : ownership check.
        [HttpGet("{id}")]
        public async Task<ActionResult<NoteDeFrais>> GetById(int id)
        {
            var result = await _repository.GetById(id);
            if (result == null) return NotFound();
            if (!await CallerOwnsOrCanManageAsync(result.Empcod ?? string.Empty)) return Forbid();
            return Ok(result);
        }

        // SEC-08 — Création : `request.Empcod` doit être l'appelant (ou admin/manager pour
        // saisir au nom d'un collaborateur). Sans, n'importe quel employé pouvait créer
        // une note de frais au nom d'un collègue.
        [HttpPost("add")]
        public async Task<IActionResult> Add([FromForm] NoteDeFraisRequest request)
        {
            if (request == null) return BadRequest();
            if (!await CallerOwnsOrCanManageAsync(request.Empcod ?? string.Empty)) return Forbid();

            // La note de frais doit obligatoirement être rattachée à une mission existante,
            // dont la nature d'absence est "Formation et mission" (Abscng="6"). Sans ce lien,
            // on ne pourrait pas rapprocher la dépense de la période d'absence en paie.
            if (request.MissionId <= 0)
                return BadRequest(new { message = "Une mission doit être sélectionnée." });

            var mission = await _missionRepository.GetByIdAsync(request.MissionId);
            if (mission == null)
                return BadRequest(new { message = "Mission introuvable." });
            if (!string.Equals(mission.Soccod, request.Soccod, StringComparison.OrdinalIgnoreCase)
                || !string.Equals(mission.Empcod, request.Empcod, StringComparison.OrdinalIgnoreCase))
                return BadRequest(new { message = "La mission sélectionnée n'appartient pas à ce collaborateur." });
            // On revérifie côté serveur : un manager pourrait essayer d'attacher une note
            // de frais à une mission dont la nature d'absence ne serait plus de catégorie 6.
            if (!await _missionRepository.AbsenceCodeIsFormationMissionAsync(mission.Soccod, mission.Abscod))
                return BadRequest(new { message = "La mission sélectionnée n'est pas rattachée à une nature 'Formation et mission'." });

            string? justificatifPath = null;
            if (request.File != null)
            {
                var (success, filePath, error) = await FileHelper.SaveFile(request.File);
                if (!success) return BadRequest(error);
                justificatifPath = filePath;
            }

            var notedefrais = new NoteDeFrais
            {
                Soccod = request.Soccod,
                Empcod = request.Empcod,
                Titre = request.Titre,
                Categorie = request.Categorie,
                Montant = request.Montant,
                Projet = request.Projet,
                MissionId = request.MissionId,
                DateDepense = request.DateDepense,
                Justificatif = justificatifPath,
                // Devise ISO 4217 (ex: EUR, USD, TND…) ; on tronque à 3 chars et
                // uppercase par sécurité au cas où le client envoie "tnd".
                Devise = string.IsNullOrWhiteSpace(request.Devise) ? null : request.Devise.Trim().ToUpperInvariant(),
                Etat = "Pending",
                CreatedAt = DateTime.UtcNow
            };

            await _repository.AddAsync(notedefrais);
            return Ok(notedefrais);
        }

        // SEC-08 — `update-status` permet d'approuver/refuser une note de frais.
        // Réservé aux managers/admins. Sans, un employé pouvait passer ses propres
        // notes de Pending à Approved.
        [HttpPut("update-status/{id}/{status}")]
        public async Task<IActionResult> UpdateStatus(int id, string status)
        {
            if (!await CallerIsAdminOrManagerAsync()) return Forbid();
            var item = await _repository.GetById(id);
            if (item == null) return NotFound();

            item.Etat = status;
            await _repository.UpdateAsync(item);
            return Ok(item);
        }

        // SEC-08 — Suppression : ownership ou manager/admin.
        [HttpDelete("{id}")]
        public async Task<IActionResult> Delete(int id)
        {
            var item = await _repository.GetById(id);
            if (item == null) return NotFound();
            if (!await CallerOwnsOrCanManageAsync(item.Empcod ?? string.Empty)) return Forbid();
            await _repository.DeleteAsync(id);
            return NoContent();
        }
    }

    public class NoteDeFraisRequest
    {
        public string Soccod { get; set; } = null!;
        public string Empcod { get; set; } = null!;
        public string Titre { get; set; } = null!;
        public string Categorie { get; set; } = null!;
        public double Montant { get; set; }
        public string? Projet { get; set; }
        public int MissionId { get; set; }
        public DateTime DateDepense { get; set; }
        /// <summary>Devise ISO 4217 (EUR, USD, TND…). NULL = devise tenant par défaut.</summary>
        public string? Devise { get; set; }
        public IFormFile? File { get; set; }
    }
}
