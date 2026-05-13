using ABRPOINT.Server.Authorization;
using ABRPOINT.Server.Interfaces;
using ABRPOINT.Server.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace ABRPOINT.Server.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    [Authorize]
    // SEC AI : ValidateSoccod manquait — un user de la société A pouvait lire/supprimer les
    // soldes congés des employés de la société B en changeant le paramètre URL.
    [ValidateSoccod]
    public class SoldesController : ControllerBase
    {
        private readonly ISoldeCongeRepository _soldeCongeRepository;
        public SoldesController(ISoldeCongeRepository soldeCongeRepository)
        {
            _soldeCongeRepository = soldeCongeRepository;
        }
        // GET: api/<DirectionsController>
        [HttpGet]
        public async Task<IActionResult> Get()
        {
            try
            {
                IEnumerable<Solde> soldes = await _soldeCongeRepository.GetAllAsync();
                return Ok(soldes);
            }
            catch (Exception ex)
            {
                return StatusCode(500,ex);
            }
            
        }


        // POST api/<DirectionsController>
        [HttpPost]
        public async Task<IActionResult> Post([FromBody] Solde solde)
        {
            if (solde == null)
                return BadRequest("Veuillez remplire les champs obligatoire");
            try
            {
                await _soldeCongeRepository.AddAsync(solde);
                return Ok(solde);
            }
            catch (Exception ex)
            {
                return StatusCode(500, ex);
            }
        }

        // PUT api/<DirectionsController>/5
        [HttpPut]
        public async Task<IActionResult> Put([FromBody] Solde ferier)
        {
            if (ferier == null)
                return BadRequest("Veuillez saisie les champs obligatoires");
            try
            {
                await _soldeCongeRepository.UpdateAsync(ferier);
                return Ok(ferier);
            }
            catch (Exception ex)
            {
                return StatusCode(500,ex);
            }
        }

        // DELETE api/<DirectionsController>/5
        [HttpDelete("{soccod}/{empcod}")]
        public async Task<IActionResult> Delete(string soccod, string empcod)
        {
            if (string.IsNullOrWhiteSpace(soccod) || string.IsNullOrWhiteSpace(empcod))
                return BadRequest("code société est code employé sont obligatoires");
            try
            {
                Solde solde = await _soldeCongeRepository.GetByEmpcodAsync(soccod, empcod);
                if (solde == null)
                {
                    return NotFound("solde non trouvé");
                }
                _soldeCongeRepository.DeleteAsync(solde);
                return Ok("solde supprimé avec succées");
            }
            catch (Exception ex )
            {
                return StatusCode(500,ex);
            }
            
        }

        [HttpGet("by-emp/{soccod}/{empcod}")]
        public async Task<IActionResult> GetByEmp(string soccod, string empcod)
        {
            try
            {
                var solde = await _soldeCongeRepository.GetByEmpCalculatedAsync(soccod, empcod);
                return Ok(solde);
            }
            catch (Exception ex)
            {
                return StatusCode(500, "Erreur interne. Consultez les logs serveur pour le détail.");
            }
        }
    }
}
