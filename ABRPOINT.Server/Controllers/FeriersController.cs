using ABRPOINT.Server.Annotations.FerierAttributes;
using ABRPOINT.Server.Interfaces;
using ABRPOINT.Server.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace ABRPOINT.Server.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    [Authorize]
    public class FeriersController : ControllerBase
    {
        private readonly IJourFerieRepository _ferierRepository;
        public FeriersController(IJourFerieRepository ferierRepository)
        {
            _ferierRepository = ferierRepository;
        }
        // GET: api/<DirectionsController>
        [HttpGet]
        public IEnumerable<Ferier> Get()
        {
            return _ferierRepository.GetAll();
        }

        // POST api/<DirectionsController>
        [HttpPost]
        [CanAddFerie]
        public void Post([FromBody] Ferier ferier)
        {
            _ferierRepository.Add(ferier);
        }

        [HttpPut]
        [CanUpdateFerie]
        public IActionResult Put([FromBody] Ferier ferier)
        {
            if (ferier == null)
               return BadRequest("Veuillez remplir les champs obligatoires");
            try
            {
                _ferierRepository.Update(ferier);
                return Ok("Jour de repos modifé avec succées");
            }
            catch (Exception)
            {

                return StatusCode(500);
            }
            
        }

        // DELETE api/<DirectionsController>/5
        [HttpDelete("{soccod}/{ferdate}")]
        [CanDeleteFerier]
        public async Task<IActionResult> Delete(string soccod, DateTime ferdate)
        {
            Ferier ferier = await _ferierRepository.GetByFerdate(soccod, ferdate);
            if (ferier == null)
            {
                return NotFound();
            }
            _ferierRepository.Delete(ferier);
            return NoContent();
        }
    }
}
