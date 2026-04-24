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
    public class DirectionsController : ControllerBase
    {
        private readonly IDirectionRepository _directionRepository;
        public DirectionsController(IDirectionRepository directionRepository)
        {
            _directionRepository = directionRepository;
        }

        // GET: api/Directions/get-directions/SOC01
        [HttpGet("get-directions/{soccod}")]
        public async Task<ActionResult<IEnumerable<Direction>>> Get(string soccod)
        {
            var directions = await _directionRepository.GetAllAsync(soccod);
            return Ok(directions);
        }

        [HttpGet("get-dirlibs/{soccod}")]
        public async Task<ActionResult<Dictionary<string, string>>> GetDirLibs(string soccod)
        {
            var dirlibs = await _directionRepository.GetDirLibsAsync(soccod);
            return Ok(dirlibs);
        }

        // POST api/Directions
        [HttpPost]
        public async Task<ActionResult<Direction>> Post([FromBody] Direction direction)
        {
            if (direction == null) return BadRequest();
            await _directionRepository.AddAsync(direction);
            return Ok(direction);
        }

        // PUT api/Directions
        [HttpPut]
        public async Task<IActionResult> Put([FromBody] Direction direction)
        {
            if (direction == null) return BadRequest();
            await _directionRepository.UpdateAsync(direction);
            return NoContent();
        }

        // DELETE api/Directions/SOC01/D01
        [HttpDelete("{soccod}/{dircod}")]
        public async Task<IActionResult> Delete(string soccod, string dircod)
        {
            var direction = await _directionRepository.GetAsync(soccod, dircod);
            if (direction == null) return NotFound();
            await _directionRepository.DeleteAsync(direction);
            return NoContent();
        }
    }
}
