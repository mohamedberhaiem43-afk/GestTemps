using ABRPOINT.Server.Annotations.AdminAttributes;
using ABRPOINT.Server.Interfaces;
using ABRPOINT.Server.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace ABRPOINT.Server.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    [Authorize]
    [Admin]
    public class ModusersController : ControllerBase
    {
        private readonly IModuserRepository _moduserRepository;

        public ModusersController(IModuserRepository moduserRepository)
        {
            _moduserRepository = moduserRepository;
        }

        [HttpGet("{uticod}")]   
        public async Task<ActionResult<IEnumerable<Moduser>>> GetModusers(string uticod)
        {
            var modusers = await _moduserRepository.GetModusers(uticod);
            return Ok(modusers);
        }

        [HttpPost]
        public async Task<ActionResult> AddModuser([FromBody] Moduser moduser)
        {
            if (moduser == null)
                return BadRequest("Invalid moduser object.");

            var success = await _moduserRepository.AddModuser(moduser);
            if (!success)
                return StatusCode(500, "A problem happened while handling your request.");

            return Ok();
        }

        [HttpPut]
        public async Task<ActionResult> UpdateModuser([FromBody] Moduser moduser)
        {
            if (moduser == null)
                return BadRequest("Invalid moduser object.");

            var success = await _moduserRepository.UpdateModuser(moduser);
            if (!success)
                return NotFound("Moduser not found.");

            return Ok();
        }

        [HttpDelete("{ordre}")]
        public async Task<ActionResult> DeleteModuser(int ordre)
        {
            var success = await _moduserRepository.DeleteModuser(ordre);
            if (!success)
                return NotFound("Moduser not found or could not be deleted.");

            return Ok();
        }
    }
}
