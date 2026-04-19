using ABRPOINT.Server.Dtaos;
using ABRPOINT.Server.Interfaces;
using ABRPOINT.Server.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace ABRPOINT.Server.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    [Authorize]
    public class DemandeAutorisationsController : ControllerBase
    {
        private readonly IDemandeAutorisationRepository _repository;

        public DemandeAutorisationsController(IDemandeAutorisationRepository repository)
        {
            _repository = repository;
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
                return Ok(new { success = true, message = result.Message });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { success = false, message = $"Erreur interne du serveur: {ex.Message}" });
            }
        }
    }
}