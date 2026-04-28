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
    public class PaysController : ControllerBase
    {
        private readonly IPaysRepoistory _paysRepository;
        private readonly ApplicationDbContext _db;

        public PaysController(IPaysRepoistory paysRepository, ApplicationDbContext db)
        {
            _paysRepository = paysRepository;
            _db = db;
        }

        // GET api/Pays/next-code — code séquentiel auto-généré (3 chiffres).
        [HttpGet("next-code")]
        public async Task<IActionResult> NextCode()
        {
            var code = await SequentialCodeGenerator.NextNationCodeAsync(_db);
            return Ok(new { code });
        }

        // GET: api/Pays
        [HttpGet]
        public async Task<IActionResult> Get()
        {
            try
            {
                var nations = await _paysRepository.GetAllAsync();
                return Ok(nations);
            }
            catch (Exception ex)
            {
                return StatusCode(500, ex.Message);
            }
        }

        [HttpGet("get-natlibs")]
        public async Task<Dictionary<string, string>> GetNatlibs()
        {
            return await _paysRepository.GetNatlibsAsync();
        }

        // GET api/Pays/FRA
        [HttpGet("{natcod}")]
        public async Task<ActionResult<Nation>> Get(string natcod)
        {
            var nation = await _paysRepository.GetByNatcodAsync(natcod);
            if (nation == null)
            {
                return NotFound();
            }
            return Ok(nation);
        }

        // POST api/Pays
        [HttpPost]
        public async Task<IActionResult> Post([FromBody] Nation nation)
        {
            if (nation == null) return BadRequest();
            if (string.IsNullOrWhiteSpace(nation.Natcod))
            {
                nation.Natcod = await SequentialCodeGenerator.NextNationCodeAsync(_db);
            }
            await _paysRepository.AddAsync(nation);
            return CreatedAtAction(nameof(Get), new { natcod = nation.Natcod }, nation);
        }

        // PUT api/Pays/FRA
        [HttpPut("{natcod}")]
        public async Task<IActionResult> Put(string natcod, [FromBody] Nation nation)
        {
            if (nation == null || natcod != nation.Natcod)
            {
                return BadRequest();
            }

            await _paysRepository.UpdateAsync(nation);
            return NoContent();
        }

        // DELETE api/Pays/FRA
        [HttpDelete("{natcod}")]
        public async Task<IActionResult> Delete(string natcod)
        {
            var nation = await _paysRepository.GetByNatcodAsync(natcod);
            if (nation == null)
            {
                return NotFound();
            }
            await _paysRepository.DeleteAsync(nation);
            return NoContent();
        }
    }
}
