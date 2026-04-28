using ABRPOINT.Server.Annotations.AdminAttributes;
using ABRPOINT.Server.Dtaos;
using ABRPOINT.Server.Helpers;
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
    public class ParametresController : ControllerBase
    {
        private readonly IParametreRepository _parametreRepository;
        private readonly ISocieteRepository _societeRepository;
        public ParametresController(IParametreRepository parametreRepository, ISocieteRepository societeRepository)
        {
            _parametreRepository = parametreRepository;
            _societeRepository = societeRepository;
        }
        [HttpGet("deb-mois/{soccod}")]
        public async Task<ActionResult<ParametreMoisPointageDto>> Get(string soccod)
        {
            try
            {
                var result = await _parametreRepository.GetParametreMoisPointageAsync(soccod);
                if (result == null)
                {
                    return NotFound();
                }
                return Ok(result);
            }
            catch (Exception)
            {
                throw;
            }
        }
        [HttpGet("{soccod}")]
        public async Task<ActionResult<Parametre>> GetParametres(string soccod)
        {
            if (string.IsNullOrWhiteSpace(soccod))
                return BadRequest("veuillez préciser la société");
            try
            {
                Parametre parametres = await _parametreRepository.GetAllAsync(soccod);
                return Ok(parametres);
            }
            catch (Exception)
            {
                return StatusCode(500);
            }
        }
        [HttpGet("get-paie/{soccod}")]
        public async Task<ActionResult<Parametre>> GetPaie(string soccod)
        {
            if (string.IsNullOrWhiteSpace(soccod))
                return BadRequest("veuillez préciser la société");
            try
            {
                string paie = await _parametreRepository.GetPaieAsync(soccod);
                return Ok(paie);
            }
            catch (Exception)
            {
                return StatusCode(500);
            }
        }

        [HttpPut]
        [Admin]
        public async Task<bool> UpdateParametres(Parametre parametre)
        {
            try
            {
                //string isAdmin = Request.Cookies["admin"];
                //if(isAdmin == "1")
                    return await _parametreRepository.UpdateParametresAsync(parametre);
                return false;
            }
            catch (Exception)
            {
                return false;
            }
        }
        [Admin]
        [HttpPost("upload-logo/{soccod}")]
        public async Task<IActionResult> UploadSocieteLogo(IFormFile file, string soccod)
        {
            var (success, filePath, error) = await FileHelper.SaveFile(file);

            if (!success)
                return BadRequest(error);
            // Save filePath to the user's record in DB
            await _societeRepository.UpdateSocieteImageAsync(soccod, filePath);
            return Ok(new { filePath });
        }
    }
}
