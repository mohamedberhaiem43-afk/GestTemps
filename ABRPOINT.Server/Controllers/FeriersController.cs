using ABRPOINT.Server.Annotations.FerierAttributes;
using ABRPOINT.Server.Interfaces;
using ABRPOINT.Server.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Threading.Tasks;

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
        public async Task<IEnumerable<Ferier>> Get()
        {
            return await _ferierRepository.GetAllAsync();
        }

        // POST api/<DirectionsController>
        [HttpPost]
        [CanAddFerie]
        public async Task Post([FromBody] Ferier ferier)
        {
            await _ferierRepository.AddAsync(ferier);
        }

        [HttpPut]
        [CanUpdateFerie]
        public async Task<IActionResult> Put([FromBody] Ferier ferier)
        {
            if (ferier == null)
               return BadRequest("Veuillez remplir les champs obligatoires");
            try
            {
                await _ferierRepository.UpdateAsync(ferier);
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
            await _ferierRepository.DeleteAsync(ferier);
            return NoContent();
        }
    }
}
