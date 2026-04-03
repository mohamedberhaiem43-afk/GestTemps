using ABRPOINT.Server.Annotations.AllaitementAttributes;
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
    public class AllaitementsController : ControllerBase
    {
        private readonly IAllaitementRepository _allaitementRepository;
        public AllaitementsController(IAllaitementRepository allaitementRepository)
        {
            _allaitementRepository = allaitementRepository;
        }
        // GET: api/<DirectionsController>
        [HttpGet("get-allaitements/{soccod}/{uticod}")]
        [CanGetAllaitement]
        public async Task<IEnumerable<AllaitementDto>> GetAllaitements(string soccod, string uticod)
        {
            try
            {
                var allaitements = await _allaitementRepository.GetAll(soccod,uticod);
                return allaitements;
            }
            catch (Exception)
            {
                throw;
            }
        }

        [HttpGet("{soccod}/{concod}")]
        [CanGetAllaitement]
        public async Task<Allaitement> Get(string soccod,string concod)
        {
            return await _allaitementRepository.Get(soccod,concod);
        }

        [HttpPost]
        [CanAddAllaitement]
        public IActionResult Post([FromBody] Allaitement allaitement)
        {
            try
            {
                _allaitementRepository.Add(allaitement);
                return Ok(new { message = "Allaitement ajouté avec succès" });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = "Erreur lors de l'ajout d'allaitement ", details = ex.Message });
            }
        }

        [HttpPut]
        [CanUpdateAllaitement]
        public IActionResult Put([FromBody] Allaitement allaitement)
        {
            try
            {
                _allaitementRepository.Update(allaitement);
                return Ok(new { message = "Allaitement modifié avec succès" });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = "Erreur lors de modification d'allaitement ", details = ex.Message });

            }
            
        }

        [HttpDelete("{soccod}/{concod}")]
        [CanDeleteAllaitement]
        public async Task<IActionResult> Delete(string soccod, string concod)
        {
            if (string.IsNullOrWhiteSpace(soccod) || string.IsNullOrWhiteSpace(concod))
                return BadRequest("Veuillez remplir les champs obligatoires");
            try
            {
                Allaitement employe = await _allaitementRepository.GetByEmpcod(soccod, concod);
                if (employe == null)
                    return NotFound("employé non trouvé");

                _allaitementRepository.Delete(employe);
                return Ok("allaitement supprimée avec sucées");
            }
            catch (Exception)
            {
                return StatusCode(500);
            }
           
        }
    }
}
