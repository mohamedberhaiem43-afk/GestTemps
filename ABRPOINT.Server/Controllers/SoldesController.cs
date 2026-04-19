using ABRPOINT.Server.Interfaces;
using ABRPOINT.Server.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace ABRPOINT.Server.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    [Authorize]
    public class SoldesController : ControllerBase
    {
        private readonly ISoldeCongeRepository _soldeCongeRepository;
        public SoldesController(ISoldeCongeRepository soldeCongeRepository)
        {
            _soldeCongeRepository = soldeCongeRepository;
        }
        // GET: api/<DirectionsController>
        [HttpGet]
        public IActionResult Get()
        {
            try
            {
                IEnumerable<Solde> soldes = _soldeCongeRepository.GetAll();
                return Ok(soldes);
            }
            catch (Exception ex)
            {
                return StatusCode(500,ex);
            }
            
        }


        // POST api/<DirectionsController>
        [HttpPost]
        public IActionResult Post([FromBody] Solde solde)
        {
            if (solde == null)
                return BadRequest("Veuillez remplire les champs obligatoire");
            try
            {
                _soldeCongeRepository.Add(solde);
                return Ok(solde);
            }
            catch (Exception ex)
            {
                return StatusCode(500, ex);
            }
        }

        // PUT api/<DirectionsController>/5
        [HttpPut]
        public IActionResult Put([FromBody] Solde ferier)
        {
            if (ferier == null)
                return BadRequest("Veuillez saisie les champs obligatoires");
            try
            {
                _soldeCongeRepository.Update(ferier);
                return Ok(ferier);
            }
            catch (Exception ex)
            {
                return StatusCode(500,ex);
            }
        }

        // DELETE api/<DirectionsController>/5
        [HttpDelete("{soccod}/{empcod}")]
        public IActionResult Delete(string soccod, string empcod)
        {
            if (string.IsNullOrWhiteSpace(soccod) || string.IsNullOrWhiteSpace(empcod))
                return BadRequest("code société est code employé sont obligatoires");
            try
            {
                Solde solde = _soldeCongeRepository.GetByEmpcod(soccod, empcod);
                if (solde == null)
                {
                    return NotFound("solde non trouvé");
                }
                _soldeCongeRepository.Delete(solde);
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
                return StatusCode(500, ex.Message);
            }
        }
    }
}
