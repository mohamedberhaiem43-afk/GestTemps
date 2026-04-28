using ABRPOINT.Server.Annotations.AdminAttributes;
using ABRPOINT.Server.Dtaos;
using ABRPOINT.Server.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace ABRPOINT.Server.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    [Authorize]
    [Admin]
    public class ModulesController : ControllerBase
    {
        private readonly IModuleRepository _moduleRepository;

        public ModulesController(IModuleRepository moduleRepository)
        {
            _moduleRepository = moduleRepository;
        }

        // GET: api/Modules
        [HttpGet("get-modules")]
        public async Task<ActionResult<IEnumerable<ModuleDto>>> GetModules()
        {
            var modules = await _moduleRepository.GetModules();
            return Ok(modules);
        }

        // POST: api/Modules
        [HttpPost]
        public async Task<ActionResult> AddModule([FromBody] ModuleDto moduleDto)
        {
            if (moduleDto == null)
                return BadRequest("Module data is required.");

            var success = await _moduleRepository.AddModules(moduleDto);
            if (!success)
                return StatusCode(500, "An error occurred while adding the module.");

            return Ok();
        }

        // PUT: api/Modules
        [HttpPut]
        public async Task<ActionResult> UpdateModule([FromBody] ModuleDto moduleDto)
        {
            if (moduleDto == null)
                return BadRequest("Module data is required.");

            var success = await _moduleRepository.UpdateModules(moduleDto);
            if (!success)
                return NotFound("Module not found.");

            return Ok();
        }

        // DELETE: api/Modules/{modcod}
        [HttpDelete("{modcod}")]
        public async Task<ActionResult> DeleteModule(string modcod)
        {
            if (string.IsNullOrEmpty(modcod))
                return BadRequest("Module code is required.");

            var success = await _moduleRepository.DeleteModules(modcod);
            if (!success)
                return NotFound("Module not found or could not be deleted.");

            return Ok();
        }
    }
}
