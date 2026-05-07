using ABRPOINT.Server.Data;
using ABRPOINT.Server.Interfaces;
using ABRPOINT.Server.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace ABRPOINT.Server.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    [Authorize]
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

        [HttpGet("by-soc/{soccod}")]
        public async Task<IActionResult> GetBySoc(string soccod)
            => Ok(await _repository.GetBySocAsync(soccod));

        [HttpGet("by-emp/{soccod}/{empcod}")]
        public async Task<IActionResult> GetByEmp(string soccod, string empcod)
            => Ok(await _repository.GetByEmpAsync(soccod, empcod));

        [HttpGet("{id:int}")]
        public async Task<IActionResult> GetById(int id)
        {
            var mission = await _repository.GetByIdAsync(id);
            if (mission == null) return NotFound();
            return Ok(mission);
        }

        [HttpPost]
        public async Task<IActionResult> Create([FromBody] MissionUpsertRequest req)
        {
            var validation = await ValidateAsync(req);
            if (validation != null) return validation;

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
