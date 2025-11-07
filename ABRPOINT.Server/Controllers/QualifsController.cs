using ABRPOINT.Server.Interfaces;
using ABRPOINT.Server.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

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
        [HttpGet]
        public IEnumerable<Qualif> Get()
        {
            return _qualifRepository.GetAll();
        }

        [HttpGet("get-qualibs")]
        public Dictionary<string, string> GetQualibs()
        {
            return _qualifRepository.GetQuaLibs();
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
        public IActionResult Put(string quacod, [FromBody] Qualif qualif)
        {
            if (qualif == null || quacod != qualif.Quacod)
            {
                return BadRequest();
            }

            _qualifRepository.Update(qualif);
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
