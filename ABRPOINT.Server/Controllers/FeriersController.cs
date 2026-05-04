using ABRPOINT.Server.Annotations.FerierAttributes;
using ABRPOINT.Server.Interfaces;
using ABRPOINT.Server.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Threading.Tasks;

namespace ABRPOINT.Server.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    [Authorize]
    public class FeriersController : ControllerBase
    {
        private readonly IJourFerieRepository _ferierRepository;
        public FeriersController(IJourFerieRepository ferierRepository)
        {
            _ferierRepository = ferierRepository;
        }
        // GET: api/<DirectionsController>
        [HttpGet]
        public async Task<IEnumerable<Ferier>> Get()
        {
            return await _ferierRepository.GetAllAsync();
        }

        // Liste des prochains jours fériés (ferdate >= today) pour la société + année.
        // Utilisé par l'app mobile pour afficher la prochaine semaine de repos sans
        // donner accès à toute la table.
        [HttpGet("upcoming/{soccod}")]
        public async Task<IActionResult> GetUpcoming(string soccod, [FromQuery] int? year = null)
        {
            var today = DateTime.Today;
            var targetYear = year ?? today.Year;
            var startDate = today.Year == targetYear ? today : new DateTime(targetYear, 1, 1);
            var endDate = new DateTime(targetYear, 12, 31);

            var feriers = await _ferierRepository.GetFeriersByPeriod(soccod, startDate, endDate);
            var ordered = feriers
                .Where(f => f.Ferdate.HasValue)
                .OrderBy(f => f.Ferdate!.Value)
                .ToList();
            return Ok(ordered);
        }

        // POST api/<DirectionsController>
        [HttpPost]
        [CanAddFerie]
        public async Task Post([FromBody] Ferier ferier)
        {
            await _ferierRepository.AddAsync(ferier);
        }

        [HttpPut]
        [CanUpdateFerie]
        public async Task<IActionResult> Put([FromBody] Ferier ferier, [FromQuery] DateTime? originalFerdate)
        {
            if (ferier == null)
               return BadRequest("Veuillez remplir les champs obligatoires");
            try
            {
                // Quand le front envoie originalFerdate, on autorise le changement de date sans
                // créer un doublon — la mise à jour cible la ligne identifiée par l'ancienne clé.
                if (originalFerdate.HasValue && !string.IsNullOrEmpty(ferier.Soccod))
                {
                    await _ferierRepository.UpdateByOriginalKeyAsync(ferier.Soccod, originalFerdate.Value, ferier);
                }
                else
                {
                    await _ferierRepository.UpdateAsync(ferier);
                }
                return Ok("Jour de repos modifé avec succées");
            }
            catch (Exception)
            {

                return StatusCode(500);
            }

        }

        // DELETE api/<DirectionsController>/5
        [HttpDelete("{soccod}/{ferdate}")]
        [CanDeleteFerier]
        public async Task<IActionResult> Delete(string soccod, DateTime ferdate)
        {
            Ferier ferier = await _ferierRepository.GetByFerdate(soccod, ferdate);
            if (ferier == null)
            {
                return NotFound();
            }
            await _ferierRepository.DeleteAsync(ferier);
            return NoContent();
        }
    }
}
