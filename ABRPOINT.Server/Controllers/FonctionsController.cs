using ABRPOINT.Server.Interfaces;
using ABRPOINT.Server.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace ABRPOINT.Server.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    [Authorize]
    public class FonctionsController : ControllerBase
    {
        private readonly IFonctionRepository _fonctionRepository;
        public FonctionsController(IFonctionRepository fonctionRepository)
        {
            _fonctionRepository = fonctionRepository;
        }
        // GET: api/<DirectionsController>
        [HttpGet("{soccod}")]
        public IEnumerable<Fonction> Get(string soccod)
        {
            try
            {
                return _fonctionRepository.GetAll(soccod);
            }
            catch (Exception)
            {
                throw;
            }
        }
        [HttpGet("get-fonlibs")]
        public Dictionary<string,string> GetFonlibs()
        {
            return _fonctionRepository.GetFonLibs();
        }

     

        // POST api/<DirectionsController>
        [HttpPost]
        public void Post([FromBody] Fonction fonction)
        {
            try
            {
                _fonctionRepository.Add(fonction);
            }
            catch (Exception)
            {
                throw;
            }
        }

        // PUT api/<DirectionsController>/5
        [HttpPut("{soccod}/{foncod}")]
        public IActionResult Put(string foncod, [FromBody] Fonction fonction)
        {
            if (fonction == null || foncod != fonction.Foncod)
            {
                return BadRequest();
            }

            _fonctionRepository.Update(fonction);
            return NoContent();
        }

        // DELETE api/<DirectionsController>/5
        [HttpDelete("{soccod}/{foncod}")]
        public IActionResult Delete(string soccod, string foncod)
        {
            Fonction fonction = _fonctionRepository.GetByFonccod(soccod, foncod);
            if (fonction == null)
            {
                return NotFound();
            }
            _fonctionRepository.Delete(fonction);
            return NoContent();
        }
    }
}
