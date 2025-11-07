using ABRPOINT.Server.Dtaos;
using ABRPOINT.Server.Interfaces;
using ABRPOINT.Server.Models;
using ABRPOINT.Server.Repository;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace ABRPOINT.Server.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    [Authorize]
    public class ParametresController : ControllerBase
    {
        private readonly IParametreRepository _parametreRepository;
        public ParametresController(IParametreRepository parametreRepository)
        {
            _parametreRepository= parametreRepository;
        }
        [HttpGet("deb-mois/{soccod}")]
        public async Task<ActionResult<ParametreMoisPointageDto>> Get(string soccod)
        {
            try
            {
                var result = await _parametreRepository.GetParametreMoisPointage(soccod);
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
        public ActionResult<Parametre> GetParametres(string soccod)
        {
            if (string.IsNullOrWhiteSpace(soccod))
                return BadRequest("veuillez préciser la société");
            try
            {
                Parametre parametres = _parametreRepository.GetAll(soccod);
                return Ok(parametres);
            }
            catch (Exception)
            {
                return StatusCode(500);
            }
        }

        [HttpPut]
        public async Task<bool> UpdateParametres(Parametre parametre)
        {
            try
            {
                string isAdmin = Request.Cookies["admin"];
                if(isAdmin == "1")
                    return await _parametreRepository.UpdateParametres(parametre);
                return false;
            }
            catch (Exception)
            {
                return false;
            }
        }
        [HttpPost("upload-logo")]
        public async Task<IActionResult> UploadSocieteLogo(IFormFile file)
        {
            try
            {
                if (file == null || file.Length == 0)
                    return BadRequest("No file uploaded.");

                var uploads = Path.Combine(Directory.GetCurrentDirectory(), "../abrpoint.client/src/assets");
                var filePath = Path.Combine(uploads, file.FileName);
                using (var stream = new FileStream(filePath, FileMode.Create))
                {
                    await file.CopyToAsync(stream);
                }

                return Ok(new { filePath = "/Images/Profile/" + file.FileName });
            }
            catch (Exception)
            {
                throw;
            }
        }

    }
}
