using ABRPOINT.Server.Interfaces;
using ABRPOINT.Server.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Threading.Tasks;

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

        // GET: api/Sites
        [HttpGet("{soccod}")]
        public IActionResult Get(string soccod)
        {
            try
            {
                if (string.IsNullOrEmpty(soccod))
                {
                    return BadRequest(new { message = "Le code société (soccod) est obligatoire" });
                }
                var sites = _siteRepository.GetAll(soccod);
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
                var sitLibs = await _siteRepository.GetSitLibs();
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
                
                var sitLibs = await _siteRepository.GetSitLibs(soccod);
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
        public async Task<IActionResult> GetSitLibsByUser(string soccod, string uticod)
        {
            try
            {
                if (string.IsNullOrEmpty(soccod) || string.IsNullOrEmpty(uticod))
                {
                    return BadRequest(new { message = "Le code société et utilisateur sont obligatoires" });
                }
                var sitLibs = await _siteRepository.GetSitLibs(soccod, uticod);
                return Ok(sitLibs);
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = "Erreur lors de la récupération des sites pour l'utilisateur", details = ex.Message });
            }
        }

        // GET api/Services/5
        [HttpGet("{soccod}/{sitcod}")]
        public ActionResult<Site> Get(string soccod, string sitcod)
        {
            try
            {
                var site = _siteRepository.GetBySitcod(soccod, sitcod);
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

        // POST api/Services
        [Authorize]
        [HttpPost]
        public IActionResult Post([FromBody] Site site)
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
                
                _siteRepository.Add(site);
                return Ok(new { isValid = true, message = "Site ajouté avec succès" });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { isValid = false, message = "Erreur lors de l'ajout du site", details = ex.Message });
            }
        }

        // PUT api/Services/5
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
                
                bool result = await _siteRepository.UpdateAsync(site);
                if (!result)
                {
                    return NotFound(new { message = "Site non trouvé" });
                }
                return Ok(new { message = "Site modifié avec succès" });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = "Erreur lors de la modification du site", details = ex.Message });
            }
        }

        // DELETE api/Services/{soccod}/{sitcod}
        [Authorize]
        [HttpDelete("{soccod}/{sitcod}")]
        public IActionResult Delete(string soccod, string sitcod)
        {
            try
            {
                if (string.IsNullOrEmpty(soccod) || string.IsNullOrEmpty(sitcod))
                {
                    return BadRequest(new { message = "Le code société et le code site sont obligatoires" });
                }
                
                Site site = _siteRepository.GetBySitcod(soccod, sitcod);
                if (site == null)
                {
                    return NotFound(new { message = "Site non trouvé" });
                }
                
                _siteRepository.Delete(site);
                return Ok(new { message = "Site supprimé avec succès" });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = "Erreur lors de la suppression du site", details = ex.Message });
            }
        }

    }
}
