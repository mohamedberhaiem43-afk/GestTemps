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

        public PaysController(IPaysRepoistory paysRepository)
        {
            _paysRepository = paysRepository;
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
            if (nation != null)
            {
                await _paysRepository.AddAsync(nation);
                return CreatedAtAction(nameof(Get), new { natcod = nation.Natcod }, nation);
            }
            return BadRequest();
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
