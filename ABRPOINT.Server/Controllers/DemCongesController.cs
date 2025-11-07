using ABRPOINT.Server.Annotations.CongesAttributes.DemCongeAttributes;
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
    public class DemCongesController : ControllerBase
    {
        private readonly IDemCongeRepository _demandecongeRepository;
        public DemCongesController(IDemCongeRepository demandecongeRepository)
        {
            _demandecongeRepository = demandecongeRepository;
        }
        // GET: api/<DirectionsController>
        [HttpGet("get-demconge/{soccod}/{uticod}")]
        [CanGetDemConge]
        public async Task<List<DemcongeEmpAbsDto>> GetCongeWithAbsenceAsync(string soccod, string uticod)
        {
            return await _demandecongeRepository.GetDemongeWithAbsenceAsync(soccod, uticod);
        }

        [HttpPost("accept-demconge/{soccod}/{concod}")]
        [CanAddDemConge]
        public async Task<IActionResult> AcceptDemConge(string soccod, string concod)
        {
            try
            {
                var success = await _demandecongeRepository.AcceptDemCongeAsync(soccod,concod);
                if (!success)
                {
                    return NotFound($"Demande de congé with ID {concod} not found.");
                }

                return Ok($"Demande de congé with ID {concod} has been accepted and converted to congé.");
            }
            catch (Exception ex)
            {
                return StatusCode(500, $"Internal server error: {ex.Message}");
            }
        }


        // POST api/<DirectionsController>
        [HttpPost]
        [CanAddDemConge]
        public IActionResult Post([FromBody] Demconge conge)
        {
            if (conge == null)
                return BadRequest("Veuillez saisie les champs obligatoires");
            try
            {
                _demandecongeRepository.Add(conge);
                return Ok("Demande ajouté avec succées");
            }
            catch (Exception)
            {

                return StatusCode(500);
            }
            
        }

        // PUT api/<DirectionsController>/5
        [HttpPut]
        [CanUpdateDemConge]
        public IActionResult Put([FromBody] Demconge demconge)
        {
            if (demconge == null || string.IsNullOrWhiteSpace(demconge.Concod))
                return BadRequest("Veuillez saisie les champs obligatoires");
            try
            {
                _demandecongeRepository.Update(demconge);
                return Ok("Demande de congé modifiée avec sucées");
            }
            catch (Exception)
            {

                return StatusCode(500);
            }
            
        }

        // DELETE api/<DirectionsController>/5
        [HttpDelete("{soccod}/{concod}")]
        [CanDeleteDemConge]
        public IActionResult Delete(string soccod, string concod)
        {
            Demconge demconge = _demandecongeRepository.GetByConcod(soccod, concod);
            if (demconge == null)
            {
                return NotFound();
            }
            _demandecongeRepository.Delete(demconge);
            return NoContent();
        }
    }
}
