using ABRPOINT.Server.Annotations.CongesAttributes.DemCongeAttributes;
using ABRPOINT.Server.Dtaos;
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
        [HttpGet("get-emp-demconge/{soccod}/{empcod}")]
        public async Task<List<DemcongeDto>> GetEmpDemconge(string soccod, string empcod)
        {
            try
            {
                var result =  await _demandecongeRepository.GetEmpDemcongeAsync(soccod, empcod);
                return result;
            }
            catch (Exception)
            {
                throw;
            }
        }

        [HttpGet("get-demconge-by-periode/{soccod}/{uticod}/{datedebut}/{datefin}")]
        [CanGetDemConge]
        public async Task<List<DemcongeDto>> GetCongeWithAbsenceAsync(string soccod, string uticod,DateTime datedebut,DateTime datefin)
        {
            try
            {
                datedebut = datedebut.Date;
                datefin = datefin.Date;
                    var result =  await _demandecongeRepository.GetAllByPeriodAsync(soccod, uticod,datedebut,datefin);
                return result;
            }
            catch (Exception)
            {
                throw;
            }
        }
        [HttpGet("get-pending-demconge-by-periode/{soccod}/{uticod}/{datedebut}/{datefin}")]
        [CanGetDemConge]
        public async Task<List<Demconge>> GetPendingCongeWithAbsenceAsync(string soccod, string uticod,DateTime datedebut,DateTime datefin)
        {
            try
            {
                datedebut = datedebut.Date;
                datefin = datefin.Date;
                    var result =  await _demandecongeRepository.GetAllEnAttenteByPeriodAsync(soccod, uticod,datedebut,datefin);
                return result;
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

        [HttpPost("refuse-demconge/{soccod}/{concod}/{empcod}")]
        [CanAddDemConge]
        public async Task<IActionResult> RefuseDemConge(string soccod, string concod,string empcod)
        {
            try
            {
                var result = await _demandecongeRepository.RefuseDemCongeAsync(soccod, concod,empcod);

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
        public async Task<IActionResult> Post([FromBody] Demconge conge)
        {
            if (conge == null)
                return BadRequest("Veuillez saisie les champs obligatoires");
            try
            {
                await _demandecongeRepository.AddAsync(conge);
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
        public async Task<IActionResult> Put([FromBody] Demconge demconge)
        {
            if (demconge == null || string.IsNullOrWhiteSpace(demconge.Concod))
                return BadRequest("Veuillez saisie les champs obligatoires");
            try
            {
                await _demandecongeRepository.UpdateAsync(demconge);
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
        public async Task<IActionResult> Delete(string soccod, string concod)
        {
            Demconge? demconge = await _demandecongeRepository.GetByConcodAsync(soccod, concod);
            if (demconge == null)
            {
                return NotFound();
            }
            await _demandecongeRepository.DeleteAsync(demconge);
            return NoContent();
        }
    }
}
