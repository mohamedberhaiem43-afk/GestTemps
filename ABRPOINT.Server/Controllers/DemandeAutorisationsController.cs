using ABRPOINT.Server.Data;
using ABRPOINT.Server.Dtaos;
using ABRPOINT.Server.Interfaces;
using ABRPOINT.Server.Models;
using ABRPOINT.Server.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

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

        // GET: api/DemandeAutorisations/get-next-concod/{soccod}
        [HttpGet("get-next-concod/{soccod}")]
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
        [HttpGet("get-all/{soccod}/{uticod}")]
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
        [HttpGet("get-by-employe/{soccod}/{empcod}")]
        public async Task<IActionResult> GetByEmploye(string soccod, string empcod)
        {
            if (string.IsNullOrWhiteSpace(soccod) || string.IsNullOrWhiteSpace(empcod))
                return BadRequest("Veuillez remplir les champs obligatoires");
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
        [HttpGet("{id}")]
        public async Task<IActionResult> GetById(int id)
        {
            try
            {
                var result = await _repository.GetByIdAsync(id);
                if (result == null) return NotFound();
                return Ok(result);
            }
            catch (Exception)
            {
                return StatusCode(500);
            }
        }

        // POST: api/DemandeAutorisations
        [HttpPost]
        public async Task<IActionResult> Create([FromBody] DemandeAutorisation demande)
        {
            if (demande == null)
                return BadRequest("Veuillez saisir les champs obligatoires");
            try
            {
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
        [HttpPut]
        public async Task<IActionResult> Update([FromBody] DemandeAutorisation demande)
        {
            if (demande == null)
                return BadRequest("Veuillez saisir les champs obligatoires");
            try
            {
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
        [HttpDelete("{id}")]
        public async Task<IActionResult> Delete(int id)
        {
            try
            {
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
        [HttpPost("approve/{id}")]
        public async Task<IActionResult> Approve(int id, [FromBody] DemandeAutorisationTraitementDto traitement)
        {
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
        [HttpPost("refuse/{id}")]
        public async Task<IActionResult> Refuse(int id, [FromBody] DemandeAutorisationTraitementDto traitement)
        {
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