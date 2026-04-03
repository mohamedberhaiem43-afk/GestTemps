using ABRPOINT.Server.Dtaos;
using ABRPOINT.Server.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace ABRPOINT.Server.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    [Authorize]
    public class LcategoriesController : ControllerBase
    {
        private readonly ILcategorieRepository _lcategorieRepository;
        public LcategoriesController(ILcategorieRepository lcategorieRepository)
        {
            _lcategorieRepository = lcategorieRepository;
        }
        // GET: api/<DirectionsController>
        [HttpGet("{soccod}/{catperiode}")]
        public IActionResult Get(string soccod, string catperiode)
        {
            try
            {
                var result = _lcategorieRepository.Getlcat(soccod, catperiode);
                return Ok(result);
            }
            catch (Exception)
            {
                throw;
            }
            
        }
        [HttpGet("get-horlibs/{soccod}")]
        public IActionResult  GetHorLibs(string soccod)
        {
            try
            {
                return Ok(_lcategorieRepository.GetHorLibs(soccod));
            }
            catch (Exception ex)
            {

                return StatusCode(500,"Probleme de récuperation des horarires "+ex);
            }
            
        }

        // POST api/<lcategoriesController>
        [HttpPost]
        public async Task<IActionResult> Post([FromBody] LcategorieDto lcategorie)
        {
            try
            {
                if (lcategorie == null)
                    return BadRequest("Lcategorie is null");

                if (string.IsNullOrEmpty(lcategorie.Soccod) || string.IsNullOrEmpty(lcategorie.Catcod))
                    return BadRequest("Soccod and Catcod are required");

                var existing = await _lcategorieRepository.GetcatAsync(lcategorie.Soccod, lcategorie.Catcod);

                if (existing != null && existing.Count() != 0)
                {
                    await _lcategorieRepository.UpdateAsync(lcategorie);
                    return Ok(new { message = "Classe horaire mise à jour avec succès" });
                }
                else
                {
                    await _lcategorieRepository.AddAsync(lcategorie);
                    return Ok(new { message = "Classe horaire ajoutée avec succès" });
                }
            }
            catch (Exception ex)
            {
                // optional: log ex
                return StatusCode(500, new { message = "Erreur interne du serveur", error = ex.Message });
            }
        }


        // PUT api/<categoriesController>
        [HttpPut]
        public async Task<IActionResult> Put([FromBody] LcategorieDto lcategorie)
        {
            try
            {
                await _lcategorieRepository.UpdateAsync(lcategorie);
                return Ok(new { message = "Classe horaire modifiée avec succès" });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = "Erreur interne du serveur", error = ex.Message });
            }
        }


        // DELETE api/<DirectionsController>/5
        [HttpDelete]
        public async Task<IActionResult> Delete(LcategorieDto lcategorie)
        {
            try
            {
                if (lcategorie == null)
                {
                    return NotFound();
                }
                await _lcategorieRepository.DeleteAsync(lcategorie);
                return NoContent();
            }
            catch (Exception)
            {
                throw;
            }
        }
    }
}
