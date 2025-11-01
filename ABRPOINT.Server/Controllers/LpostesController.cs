using ABRPOINT.Server.Interfaces;
using ABRPOINT.Server.Models;
using Microsoft.AspNetCore.Mvc;

// For more information on enabling Web API for empty projects, visit https://go.microsoft.com/fwlink/?LinkID=397860

namespace ABRPOINT.Server.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class LpostesController : ControllerBase
    {
        private readonly IlposteRepository _lposteRepository;
        public LpostesController(IlposteRepository lposteRepository)
        {
            _lposteRepository = lposteRepository;
        }
        // GET: api/<LpostesController>
        [HttpGet]
        public IEnumerable<string> Get()
        {
            return new string[] { "value1", "value2" };
        }

        // GET api/<LpostesController>/id
        [HttpGet("get-lposte/{soccod}/{codposte}")]
        public IActionResult Get(string soccod,string codposte)
        {
            if (string.IsNullOrEmpty(soccod) || string.IsNullOrEmpty(codposte))
                return BadRequest("code société et code poste sont obligatoires");
            try
            {
                IEnumerable<Lposte> lposte = _lposteRepository.GetLposte(soccod, codposte);
                return Ok(lposte);
            }
            catch (Exception)
            {

                return StatusCode(500);
            }
        }

        // POST api/<LpostesController>
        [HttpPost]
        public void Post([FromBody] string value)
        {
        }

        // PUT api/<LpostesController>/5
        [HttpPut("{id}")]
        public void Put(int id, [FromBody] string value)
        {
        }

        // DELETE api/<LpostesController>/5
        [HttpDelete("{id}")]
        public void Delete(int id)
        {
        }
    }
}
