using ABRPOINT.Server.Authorization;
using ABRPOINT.Server.Data;
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
    [Tenancy.RequirePlanFeature(nameof(Tenancy.PlanFeatures.Missions))]
    public class MissionsController : ControllerBase
    {
        private readonly IMissionRepository _repository;
        private readonly ApplicationDbContext _db;
        private readonly ILogger<MissionsController> _log;

        public MissionsController(IMissionRepository repository, ApplicationDbContext db, ILogger<MissionsController> log)
        {
            _repository = repository;
            _db = db;
            _log = log;
        }

        // SEC-09 — Helpers (même pattern que NoteDeFraisController) : self-service pour
        // un employé ; création / modification / suppression réservées aux managers/admins.
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

        /// <summary>Liste les natures d'absence "Formation et mission" (Abscng="6"), pour la combo box.</summary>
        [HttpGet("natures-formation-mission/{soccod}")]
        public async Task<IActionResult> GetFormationMissionNatures(string soccod)
        {
            var natures = await _db.Absences
                .AsNoTracking()
                .Where(a => a.Soccod == soccod && a.Abscng == "6")
                .Select(a => new { abscod = a.Abscod, abslib = a.Abslib })
                .ToListAsync();
            return Ok(natures);
        }

        // SEC-09 — Vue globale : manager/admin uniquement.
        [HttpGet("by-soc/{soccod}")]
        public async Task<IActionResult> GetBySoc(string soccod)
        {
            if (!await CallerIsAdminOrManagerAsync()) return Forbid();
            return Ok(await _repository.GetBySocAsync(soccod));
        }

        // SEC-09 — Vue par employé : self-service ou manager/admin.
        [HttpGet("by-emp/{soccod}/{empcod}")]
        public async Task<IActionResult> GetByEmp(string soccod, string empcod)
        {
            if (!await CallerOwnsOrCanManageAsync(empcod)) return Forbid();
            return Ok(await _repository.GetByEmpAsync(soccod, empcod));
        }

        // SEC-09 — Détail : ownership.
        [HttpGet("{id:int}")]
        public async Task<IActionResult> GetById(int id)
        {
            var mission = await _repository.GetByIdAsync(id);
            if (mission == null) return NotFound();
            if (!await CallerOwnsOrCanManageAsync(mission.Empcod ?? string.Empty)) return Forbid();
            return Ok(mission);
        }

        [HttpPost]
        public async Task<IActionResult> Create([FromBody] MissionUpsertRequest req)
        {
            var validation = await ValidateAsync(req);
            if (validation != null) return validation;
            // SEC-09 — Création réservée à un caller qui peut couvrir l'empcod cible.
            if (!await CallerOwnsOrCanManageAsync(req.Empcod ?? string.Empty)) return Forbid();

            var mission = new Mission
            {
                Soccod = req.Soccod!,
                Empcod = req.Empcod!,
                Misobj = req.Misobj!,
                Misdest = req.Misdest,
                Misdatedeb = req.Misdatedeb!.Value,
                Misdatefin = req.Misdatefin!.Value,
                Misnote = req.Misnote,
                Misetat = string.IsNullOrWhiteSpace(req.Misetat) ? "Pending" : req.Misetat!,
                Misbudget = req.Misbudget,
                // Devise ISO 4217 (3 chars max). NULL = devise tenant par défaut.
                Misdevise = string.IsNullOrWhiteSpace(req.Misdevise) ? null : req.Misdevise.Trim().ToUpperInvariant(),
                Abscod = req.Abscod!,
            };
            await _repository.AddAsync(mission);
            return CreatedAtAction(nameof(GetById), new { id = mission.Id }, mission);
        }

        [HttpPut("{id:int}")]
        public async Task<IActionResult> Update(int id, [FromBody] MissionUpsertRequest req)
        {
            var existing = await _repository.GetByIdAsync(id);
            if (existing == null) return NotFound();

            var validation = await ValidateAsync(req);
            if (validation != null) return validation;
            // SEC-09 — On vérifie l'ownership sur l'objet *existant* (pas sur le payload),
            // sinon un user pouvait passer son propre empcod dans le body pour valider le check.
            if (!await CallerOwnsOrCanManageAsync(existing.Empcod ?? string.Empty)) return Forbid();

            // Self-service : un salarié (non manager) ne peut modifier QUE sa mission encore
            // « Pending ». Une fois Approved/InProgress/Completed, seule la hiérarchie peut la
            // changer — important car une mission validée ouvre le bypass geofence du pointage
            // (cf. PresencesController). On empêche donc le salarié d'éditer dates/objet a posteriori.
            if (!await CallerIsAdminOrManagerAsync())
            {
                if (!string.Equals(existing.Misetat, "Pending", StringComparison.OrdinalIgnoreCase))
                    return Conflict(new { message = "Cette mission a déjà été traitée : elle ne peut plus être modifiée." });
                // L'employé ne décide pas de l'état : on conserve « Pending » quoi qu'il envoie.
                req.Misetat = "Pending";
            }

            existing.Soccod = req.Soccod!;
            existing.Empcod = req.Empcod!;
            existing.Misobj = req.Misobj!;
            existing.Misdest = req.Misdest;
            existing.Misdatedeb = req.Misdatedeb!.Value;
            existing.Misdatefin = req.Misdatefin!.Value;
            existing.Misnote = req.Misnote;
            existing.Misetat = string.IsNullOrWhiteSpace(req.Misetat) ? existing.Misetat : req.Misetat!;
            existing.Misbudget = req.Misbudget;
            existing.Misdevise = string.IsNullOrWhiteSpace(req.Misdevise) ? null : req.Misdevise.Trim().ToUpperInvariant();
            existing.Abscod = req.Abscod!;
            await _repository.UpdateAsync(existing);
            return Ok(existing);
        }

        [HttpDelete("{id:int}")]
        public async Task<IActionResult> Delete(int id)
        {
            // SEC-09 — Suppression : ownership.
            var existing = await _repository.GetByIdAsync(id);
            if (existing == null) return NotFound();
            if (!await CallerOwnsOrCanManageAsync(existing.Empcod ?? string.Empty)) return Forbid();
            // Self-service : un salarié non manager ne supprime que sa mission encore « Pending »
            // (une mission validée a pu ouvrir le bypass geofence / générer des absences paie).
            if (!await CallerIsAdminOrManagerAsync()
                && !string.Equals(existing.Misetat, "Pending", StringComparison.OrdinalIgnoreCase))
                return Conflict(new { message = "Cette mission a déjà été traitée : elle ne peut plus être supprimée." });
            await _repository.DeleteAsync(id);
            return NoContent();
        }

        private async Task<IActionResult?> ValidateAsync(MissionUpsertRequest? req)
        {
            if (req == null) return BadRequest(new { message = "Payload manquant." });
            if (string.IsNullOrWhiteSpace(req.Soccod)) return BadRequest(new { message = "Soccod requis." });
            if (string.IsNullOrWhiteSpace(req.Empcod)) return BadRequest(new { message = "Empcod requis." });
            if (string.IsNullOrWhiteSpace(req.Misobj)) return BadRequest(new { message = "L'objet de la mission est requis." });
            if (string.IsNullOrWhiteSpace(req.Abscod)) return BadRequest(new { message = "La nature d'absence est requise." });
            if (req.Misdatedeb is null || req.Misdatefin is null) return BadRequest(new { message = "Dates de début et fin requises." });
            if (req.Misdatefin < req.Misdatedeb) return BadRequest(new { message = "La date de fin doit être postérieure à la date de début." });

            // Garde-fou métier : la nature d'absence rattachée doit être Abscng = "6"
            // (Formation et mission). Sans ça, le rapprochement paie ne fonctionnera pas.
            if (!await _repository.AbsenceCodeIsFormationMissionAsync(req.Soccod!, req.Abscod!))
                return BadRequest(new { message = "La nature d'absence sélectionnée doit être de catégorie 'Formation et mission' (abscng=6)." });

            return null;
        }
    }

    public sealed class MissionUpsertRequest
    {
        public string? Soccod { get; set; }
        public string? Empcod { get; set; }
        public string? Misobj { get; set; }
        public string? Misdest { get; set; }
        public DateTime? Misdatedeb { get; set; }
        public DateTime? Misdatefin { get; set; }
        public string? Misnote { get; set; }
        public string? Misetat { get; set; }
        public double? Misbudget { get; set; }
        /// <summary>Devise ISO 4217 du budget (EUR, USD, TND…). NULL = devise tenant par défaut.</summary>
        public string? Misdevise { get; set; }
        public string? Abscod { get; set; }
    }
}
