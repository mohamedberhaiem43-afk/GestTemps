using ABRPOINT.Server.Interfaces;
using ABRPOINT.Server.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Threading.Tasks;

// For more information on enabling Web API for empty projects, visit https://go.microsoft.com/fwlink/?LinkID=397860

namespace ABRPOINT.Server.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    [Authorize]
    public class QualifsController : ControllerBase
    {
        private readonly IQualifRepository _qualifRepository;

        public QualifsController(IQualifRepository qualifRepository)
        {
            _qualifRepository = qualifRepository;
        }

        // GET: api/Services
        [HttpGet("{soccod}")]
        public async Task<IEnumerable<Qualif>> GetAll(string soccod)
        {
            return await _qualifRepository.GetAllAsync(soccod);
        }

        [HttpGet("get-qualibs/{soccod}")]
        public IActionResult GetQualibs(string soccod)
        {
            try
            {
                if (string.IsNullOrEmpty(soccod))
                {
                    return BadRequest(new { message = "Le code société (soccod) est obligatoire" });
                }
                
                var qualibs = _qualifRepository.GetQuaLibs(soccod);
                return Ok(qualibs);
            }
            catch (InvalidOperationException ex)
            {
                return StatusCode(500, new { message = ex.Message, details = ex.InnerException?.Message });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = "Erreur lors de la récupération des qualifications", details = ex.Message });
            }
        }


        // GET api/Services/5
        [HttpGet("{soccod}/{quacod}")]
        public ActionResult<Qualif> Get(string quacod)
        {
            var ville = _qualifRepository.GetByQuafcod(quacod);
            if (ville == null)
            {
                return NotFound();
            }
            return Ok(ville);
        }

        // POST api/Services
        [HttpPost]
        public IActionResult Post([FromBody] Qualif qualif)
        {
            if (qualif != null)
            {
                _qualifRepository.Add(qualif);
                return CreatedAtAction(nameof(Get), new { vilcod = qualif.Quacod }, qualif);
            }
            return BadRequest();
        }

        // PUT api/Services/5
        [HttpPut("{soccod}/{quacod}")]
        public async Task<IActionResult> Put(string soccod, string quacod, [FromBody] Qualif qualif)
        {
            if (qualif == null || quacod != qualif.Quacod)
            {
                return BadRequest();
            }

            var result = await _qualifRepository.UpdateAsync(qualif);
            return NoContent();
        }

        // DELETE api/Services/{seccod}
        [HttpDelete("{soccod}/{quacod}")]
        public IActionResult Delete(string quacod)
        {
            Qualif qualif = _qualifRepository.GetByQuafcod(quacod);
            if (qualif == null)
            {
                return NotFound();
            }
            _qualifRepository.Delete(qualif);
            return NoContent();
        }

    }
}
