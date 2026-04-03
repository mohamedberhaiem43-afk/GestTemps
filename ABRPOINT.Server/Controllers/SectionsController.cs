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
    public class SectionsController : ControllerBase
    {
        private readonly ISectionRepository _sectionRepository;

        public SectionsController(ISectionRepository sectionRepository)
        {
            _sectionRepository = sectionRepository;
        }

        // GET: api/Services
        [HttpGet("{soccod}")]
        public IActionResult Get(string soccod)
        {
            if (string.IsNullOrWhiteSpace(soccod))
                return BadRequest("code société est obligatoire");
            try
            {
                IEnumerable<Section> sections = _sectionRepository.GetAll(soccod);
                return Ok(sections);
            }
            catch (Exception ex)
            {

               return StatusCode(500,"probléme de récuperation");
            }
            
        }
        [HttpGet("get-seclibs/{soccod}")]
        public Dictionary<string, string> GetSecLibs(string soccod)
        {
            return _sectionRepository.GetSecLibs(soccod);
        }

        // GET api/Sections/{soccod}/{seccod}
        [HttpGet("{soccod}/{seccod}")]
        public ActionResult<Section> GetById(string soccod, string seccod)
        {
            var section = _sectionRepository.GetBySeccod(seccod, soccod);
            if (section == null)
            {
                return NotFound();
            }
            return Ok(section);
        }

        // POST api/Sections
        [HttpPost]
        public IActionResult Post([FromBody] Section section)
        {
            if (section == null || string.IsNullOrWhiteSpace(section.Seccod) || string.IsNullOrWhiteSpace(section.Soccod))
            {
                return BadRequest(new { message = "Code section et code société sont obligatoires" });
            }
            try
            {
                _sectionRepository.Add(section);
                return CreatedAtAction(nameof(GetById), new { soccod = section.Soccod, seccod = section.Seccod }, section);
            }
            catch (Exception ex)
            {
                return BadRequest(new { message = ex.Message });
            }
        }

        // PUT api/Sections/{soccod}/{seccod}
        [HttpPut("{soccod}/{seccod}")]
        public IActionResult Put(string soccod, string seccod, [FromBody] Section section)
        {
            if (section == null || seccod != section.Seccod || soccod != section.Soccod)
            {
                return BadRequest();
            }

            var existing = _sectionRepository.GetBySeccod(seccod, soccod);
            if (existing == null)
            {
                return NotFound();
            }

            _sectionRepository.Update(section);
            return NoContent();
        }

        // DELETE api/Services/{seccod}
        [HttpDelete("{soccod}/{seccod}")]

        public IActionResult Delete(string seccod, string soccod)
        {
            var section = _sectionRepository.GetBySeccod(seccod, soccod);
            if (section == null)
            {
                return NotFound();
            }
            _sectionRepository.Delete(section);
            return NoContent();
        }

    }
}
