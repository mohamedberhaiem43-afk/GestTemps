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
                return Ok(_siteRepository.GetAll(soccod));
            }
            catch (Exception)
            {

                return StatusCode(500);
            }
            
        }
        [HttpGet("get-sitlibs")]
        public async Task<IActionResult> GetSitLibs()
        {
            try
            {
                return Ok( await _siteRepository.GetSitLibs());

            }
            catch (Exception ex)
            {
                return StatusCode(500,"probléme de récupération des sites "+ex);
            }
        }
        [HttpGet("get-sitlibs/{soccod}/{uticod}")]
        public async Task<Dictionary<string, string>> GetSitLibs(string soccod, string uticod)
        {
            return await _siteRepository.GetSitLibs(soccod,uticod);
        }

        // GET api/Services/5
        [HttpGet("{soccod}/{sitcod}")]
        public ActionResult<Site> Get(string sitcod, string soccod)
        {
            var service = _siteRepository.GetBySitcod(sitcod, soccod);
            if (service == null)
            {
                return NotFound();
            }
            return Ok(service);
        }

        // POST api/Services
        [Authorize]
        [HttpPost]
        public IActionResult Post([FromBody] Site site)
        {
            try
            {
                if (site != null && !string.IsNullOrEmpty(site.Sitcod))
                {
                    _siteRepository.Add(site);
                    return Ok(new {isValid = true, message = "Site ajouté avec succés" });
                }
            }
            catch (Exception)
            {
                throw;
            }
            return BadRequest(new {isValid = false, message = "Probléme lors l'ajout du site"});
        }

        // PUT api/Services/5
        [Authorize]
        [HttpPut]
        public async Task<IActionResult> Put([FromBody] Site site)
        {
            if (site == null)
            {
                return BadRequest();
            }
            bool result = await _siteRepository.UpdateAsync(site);
            return NoContent();
        }

        // DELETE api/Services/{seccod}
        [Authorize]
        [HttpDelete("{soccod}/{sitcod}")]
        public IActionResult Delete(string soccod, string sitcod)
        {
            Site site = _siteRepository.GetBySitcod(soccod, sitcod);
            if (site == null)
            {
                return NotFound();
            }
            _siteRepository.Delete(site);
            return NoContent();
        }

    }
}
