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
            try
            {
                return await _demandecongeRepository.GetDemongeWithAbsenceAsync(soccod, uticod);
            }
            catch (Exception)
            {
                throw;
            }
        }

        [HttpPost("accept-demconge/{soccod}/{concod}/{empcod}")]
        [CanAddDemConge]
        public async Task<IActionResult> AcceptDemConge(string soccod, string concod,string empcod)
        {
            try
            {
                var result = await _demandecongeRepository.AcceptDemCongeAsync(soccod, concod,empcod);

                if (!result.Success)
                {
                    return BadRequest(new
                    {
                        success = false,
                        message = result.Message
                    });
                }

                return Ok(new
                {
                    success = true,
                    message = result.Message
                });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new
                {
                    success = false,
                    message = $"Erreur interne du serveur: {ex.Message}"
                });
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
