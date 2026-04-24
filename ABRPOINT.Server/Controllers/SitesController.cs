using ABRPOINT.Server.Interfaces;
using ABRPOINT.Server.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace ABRPOINT.Server.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class SitesController : ControllerBase
    {
        private readonly ISiteRepository _siteRepository;

        public SitesController(ISiteRepository siteRepository)
        {
            _siteRepository = siteRepository;
        }

        // GET: api/Sites/SOC01
        [HttpGet("{soccod}")]
        public async Task<IActionResult> Get(string soccod)
        {
            try
            {
                if (string.IsNullOrEmpty(soccod))
                {
                    return BadRequest(new { message = "Le code société (soccod) est obligatoire" });
                }
                var sites = await _siteRepository.GetAllAsync(soccod);
                return Ok(sites);
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = "Erreur lors de la récupération des sites", details = ex.Message });
            }
        }

        [HttpGet("get-sitlibs")]
        public async Task<IActionResult> GetSitLibs()
        {
            try
            {
                var sitLibs = await _siteRepository.GetSitLibsAsync();
                return Ok(sitLibs);
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = "Erreur lors de la récupération des sites", details = ex.Message });
            }
        }

        [HttpGet("get-sitlibs/{soccod}")]
        public async Task<IActionResult> GetSitLibsBySociety(string soccod)
        {
            try
            {
                if (string.IsNullOrEmpty(soccod))
                {
                    return BadRequest(new { message = "Le code société est obligatoire" });
                }

                var sitLibs = await _siteRepository.GetSitLibsAsync(soccod);
                return Ok(sitLibs);
            }
            catch (InvalidOperationException ex)
            {
                return StatusCode(500, new { message = ex.Message, details = ex.InnerException?.Message });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = "Erreur lors de la récupération des sites", details = ex.Message });
            }
        }

        [HttpGet("get-sitlibs/{soccod}/{uticod}")]
        public async Task<IActionResult> GetSitLibsByUser(string soccod, string uticod)
        {
            try
            {
                if (string.IsNullOrEmpty(soccod) || string.IsNullOrEmpty(uticod))
                {
                    return BadRequest(new { message = "Le code société et utilisateur sont obligatoires" });
                }
                var sitLibs = await _siteRepository.GetSitLibsAsync(soccod, uticod);
                return Ok(sitLibs);
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = "Erreur lors de la récupération des sites pour l'utilisateur", details = ex.Message });
            }
        }

        // GET api/Sites/SOC01/SITE01
        [HttpGet("{soccod}/{sitcod}")]
        public async Task<ActionResult<Site>> Get(string soccod, string sitcod)
        {
            try
            {
                var site = await _siteRepository.GetBySitcodAsync(soccod, sitcod);
                if (site == null)
                {
                    return NotFound();
                }
                return Ok(site);
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = "Erreur lors de la récupération du site", details = ex.Message });
            }
        }

        // POST api/Sites
        [Authorize]
        [HttpPost]
        public async Task<IActionResult> Post([FromBody] Site site)
        {
            try
            {
                if (site == null)
                {
                    return BadRequest(new { isValid = false, message = "Les données du site sont obligatoires" });
                }

                if (string.IsNullOrEmpty(site.Sitcod) || string.IsNullOrEmpty(site.Soccod))
                {
                    return BadRequest(new { isValid = false, message = "Le code site et le code société sont obligatoires" });
                }

                await _siteRepository.AddAsync(site);
                return Ok(new { isValid = true, message = "Site ajouté avec succès" });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { isValid = false, message = "Erreur lors de l'ajout du site", details = ex.Message });
            }
        }

        // PUT api/Sites
        [Authorize]
        [HttpPut]
        public async Task<IActionResult> Put([FromBody] Site site)
        {
            try
            {
                if (site == null)
                {
                    return BadRequest(new { message = "Les données du site sont obligatoires" });
                }

                if (string.IsNullOrEmpty(site.Sitcod) || string.IsNullOrEmpty(site.Soccod))
                {
                    return BadRequest(new { message = "Le code site et le code société sont obligatoires" });
                }

                await _siteRepository.UpdateAsync(site);
                return Ok(new { message = "Site modifié avec succès" });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = "Erreur lors de la modification du site", details = ex.Message });
            }
        }

        // DELETE api/Sites/SOC01/SITE01
        [Authorize]
        [HttpDelete("{soccod}/{sitcod}")]
        public async Task<IActionResult> Delete(string soccod, string sitcod)
        {
            try
            {
                if (string.IsNullOrEmpty(soccod) || string.IsNullOrEmpty(sitcod))
                {
                    return BadRequest(new { message = "Le code société et le code site sont obligatoires" });
                }

                var site = await _siteRepository.GetBySitcodAsync(soccod, sitcod);
                if (site == null)
                {
                    return NotFound(new { message = "Site non trouvé" });
                }

                await _siteRepository.DeleteAsync(site);
                return Ok(new { message = "Site supprimé avec succès" });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = "Erreur lors de la suppression du site", details = ex.Message });
            }
        }
    }
}
