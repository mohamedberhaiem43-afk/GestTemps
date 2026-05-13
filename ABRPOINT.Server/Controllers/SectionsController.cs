using ABRPOINT.Server.Authorization;
using ABRPOINT.Server.Data;
using ABRPOINT.Server.Helpers;
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
    // SEC AI : ValidateSoccod manquait — CRUD sections cross-soccod possible.
    [ValidateSoccod]
    public class SectionsController : ControllerBase
    {
        private readonly ISectionRepository _sectionRepository;
        private readonly ApplicationDbContext _db;

        public SectionsController(ISectionRepository sectionRepository, ApplicationDbContext db)
        {
            _sectionRepository = sectionRepository;
            _db = db;
        }

        // GET: api/Sections/SOC01
        [HttpGet("{soccod}")]
        public async Task<IActionResult> Get(string soccod)
        {
            if (string.IsNullOrWhiteSpace(soccod))
                return BadRequest("code société est obligatoire");
            try
            {
                var sections = await _sectionRepository.GetAllAsync(soccod);
                return Ok(sections);
            }
            catch (Exception)
            {
                return StatusCode(500, "probléme de récuperation");
            }
        }

        [HttpGet("get-seclibs/{soccod}")]
        public async Task<ActionResult<Dictionary<string, string>>> GetSecLibs(string soccod)
        {
            var seclibs = await _sectionRepository.GetSecLibsAsync(soccod);
            return Ok(seclibs);
        }

        // GET api/Sections/SOC01/SEC01
        [HttpGet("{soccod}/{seccod}")]
        public async Task<ActionResult<Section>> GetById(string soccod, string seccod)
        {
            var section = await _sectionRepository.GetBySeccodAsync(seccod, soccod);
            if (section == null)
            {
                return NotFound();
            }
            return Ok(section);
        }

        // POST api/Sections
        [HttpPost]
        public async Task<IActionResult> Post([FromBody] Section section)
        {
            if (section == null || string.IsNullOrWhiteSpace(section.Soccod))
            {
                return BadRequest(new { message = "Code société est obligatoire" });
            }
            try
            {
                if (string.IsNullOrWhiteSpace(section.Seccod))
                    section.Seccod = await SequentialCodeGenerator.NextSectionCodeAsync(_db, section.Soccod);

                await _sectionRepository.AddAsync(section);
                return CreatedAtAction(nameof(GetById), new { soccod = section.Soccod, seccod = section.Seccod }, section);
            }
            catch (Exception ex)
            {
                return BadRequest(new { message = "Erreur interne. Consultez les logs serveur pour le détail." });
            }
        }

        // GET: api/Sections/get-next-seccod/SOC01
        [HttpGet("get-next-seccod/{soccod}")]
        public async Task<IActionResult> GetNextSeccod(string soccod)
        {
            if (string.IsNullOrWhiteSpace(soccod)) return BadRequest("code société est obligatoire");
            var next = await SequentialCodeGenerator.NextSectionCodeAsync(_db, soccod);
            return Ok(new { seccod = next });
        }

        // PUT api/Sections/SOC01/SEC01
        [HttpPut("{soccod}/{seccod}")]
        public async Task<IActionResult> Put(string soccod, string seccod, [FromBody] Section section)
        {
            if (section == null || seccod != section.Seccod || soccod != section.Soccod)
            {
                return BadRequest();
            }

            var existing = await _sectionRepository.GetBySeccodAsync(seccod, soccod);
            if (existing == null)
            {
                return NotFound();
            }

            await _sectionRepository.UpdateAsync(section);
            return NoContent();
        }

        // DELETE api/Sections/SOC01/SEC01
        [HttpDelete("{soccod}/{seccod}")]
        public async Task<IActionResult> Delete(string soccod, string seccod)
        {
            var section = await _sectionRepository.GetBySeccodAsync(seccod, soccod);
            if (section == null)
            {
                return NotFound();
            }
            await _sectionRepository.DeleteAsync(section);
            return NoContent();
        }
    }
}
