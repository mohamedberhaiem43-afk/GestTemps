using ABRPOINT.Server.Interfaces;
using ABRPOINT.Server.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace ABRPOINT.Server.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class SocietesController : ControllerBase
    {
        private readonly ISocieteRepository _societeRepository;

        public SocietesController(ISocieteRepository societeRepository)
        {
            _societeRepository = societeRepository;
        }

        // GET: api/Services
        [HttpGet]
        public IEnumerable<Societe> Get()
        {
            return _societeRepository.GetAll();
        }
        [HttpGet("get-soclibs")]
        public async Task<IActionResult> GetSoclibs()
        {
            try
            {
                return Ok(await _societeRepository.GetSoclibs());
            }
            catch (Exception ex)
            {
                return StatusCode(500, "probléme de récuperation sociétés" + ex);
            }
        }

        // GET api/Services/5
        [HttpGet("{soccod}")]
        public ActionResult<Societe> Get(string soccod)
        {
            var service = _societeRepository.GetBySoccod(soccod);
            if (service == null)
            {
                return NotFound();
            }
            return Ok(service);
        }

        // POST api/Services
        [Authorize]
        [HttpPost]
        public IActionResult Post([FromBody] Societe societe)
        {
            if (societe == null)
            {
                return BadRequest();
            }

            try
            {
                _societeRepository.Add(societe);
                return CreatedAtAction(nameof(Get), new { id = societe.Soccod }, societe);
            }
            catch (Exception ex)
            {
                return StatusCode(500, $"Internal server error: {ex.Message}");
            }
        }


        // PUT api/Services/5
        [Authorize]
        [HttpPut("{soccod}")]
        public IActionResult Put(string soccod, [FromBody] Societe societe)
        {
            if (societe == null || soccod != societe.Soccod)
            {
                return BadRequest();
            }

            _societeRepository.Update(societe);
            return NoContent();
        }

        // DELETE api/Services/{seccod}
        [Authorize]
        [HttpDelete("{soccod}")]
        public IActionResult Delete(string soccod)
        {
            var section = _societeRepository.GetBySoccod(soccod);
            if (section == null)
            {
                return NotFound();
            }
            _societeRepository.Delete(section);
            return NoContent();
        }
    }
}
