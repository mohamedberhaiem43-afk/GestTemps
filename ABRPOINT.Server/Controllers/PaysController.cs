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

        // GET: api/Services
        [HttpGet]
        public IActionResult Get()
        {
            try
            {
                IEnumerable<Nation> nations = _paysRepository.GetAll();
                return Ok(nations);
            }
            catch (Exception ex)
            {

                return StatusCode(500,ex);
            }
            
        }
        [HttpGet("get-natlibs")]
        public Dictionary<string,string> GetNatlibs()
        {
            return _paysRepository.GetNatlibs();
        }

        // GET api/Services/5
        [HttpGet("{natcod}")]
        public ActionResult<Nation> Get(string natcod)
        {
            var ville = _paysRepository.GetByNatcod(natcod);
            if (ville == null)
            {
                return NotFound();
            }
            return Ok(ville);
        }

        // POST api/Services
        [HttpPost]
        public IActionResult Post([FromBody] Nation nation)
        {
            if (nation != null)
            {
                _paysRepository.Add(nation);
                return CreatedAtAction(nameof(Get), new { natcod = nation.Natcod }, nation);
            }
            return BadRequest();
        }

        // PUT api/Services/5
        [HttpPut("{natcod}")]
        public IActionResult Put(string natcod, [FromBody] Nation nation)
        {
            if (nation == null || natcod != nation.Natcod)
            {
                return BadRequest();
            }

            _paysRepository.Update(nation);
            return NoContent();
        }

        // DELETE api/Services/{seccod}
        [HttpDelete("{natcod}")]

        public IActionResult Delete(string natcod)
        {
            Nation nation = _paysRepository.GetByNatcod(natcod);
            if (nation == null)
            {
                return NotFound();
            }
            _paysRepository.Delete(nation);
            return NoContent();
        }

    }
}
