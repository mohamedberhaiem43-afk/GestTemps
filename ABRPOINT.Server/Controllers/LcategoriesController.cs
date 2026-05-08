using ABRPOINT.Server.Authorization;
using ABRPOINT.Server.Data;
using ABRPOINT.Server.Dtaos;
using ABRPOINT.Server.Helpers;
using ABRPOINT.Server.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Threading.Tasks;

namespace ABRPOINT.Server.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    [Authorize]
    // SEC AI : ValidateSoccod manquait — création/modification de catégories horaires
    // cross-soccod possible.
    [ValidateSoccod]
    public class LcategoriesController : ControllerBase
    {
        private readonly ILcategorieRepository _lcategorieRepository;
        private readonly ApplicationDbContext _db;
        public LcategoriesController(ILcategorieRepository lcategorieRepository, ApplicationDbContext db)
        {
            _lcategorieRepository = lcategorieRepository;
            _db = db;
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
        public async Task<IActionResult>  GetHorLibs(string soccod)
        {
            try
            {
                var cats = await _lcategorieRepository.GetHorLibs(soccod);
                return Ok(cats);
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

                if (string.IsNullOrEmpty(lcategorie.Soccod))
                    return BadRequest("Soccod requis");

                // Auto-génération du Catcod (sur 2 caractères) si vide à la création.
                if (string.IsNullOrWhiteSpace(lcategorie.Catcod))
                    lcategorie.Catcod = await SequentialCodeGenerator.NextCatcodAsync(_db, lcategorie.Soccod);

                // POST = "ajout d'une période". Si Ordre est fourni (>0), on est en édition d'une
                // période existante → UpdateAsync. Sinon, AddAsync upsert la classe (Categorie) si
                // elle n'existe pas et insère une nouvelle Lcategorie pour la période courante.
                if (lcategorie.Ordre.HasValue && lcategorie.Ordre.Value > 0)
                {
                    await _lcategorieRepository.UpdateAsync(lcategorie);
                    return Ok(new { message = "Classe horaire mise à jour avec succès", catcod = lcategorie.Catcod });
                }
                else
                {
                    await _lcategorieRepository.AddAsync(lcategorie);
                    return Ok(new { message = "Classe horaire ajoutée avec succès", catcod = lcategorie.Catcod });
                }
            }
            catch (Exception ex)
            {
                // optional: log ex
                return StatusCode(500, new { message = "Erreur interne du serveur", error = ex.Message });
            }
        }

        // GET: api/Lcategories/get-next-catcod/SOC01
        [HttpGet("get-next-catcod/{soccod}")]
        public async Task<IActionResult> GetNextCatcod(string soccod)
        {
            if (string.IsNullOrWhiteSpace(soccod)) return BadRequest("soccod requis");
            var next = await SequentialCodeGenerator.NextCatcodAsync(_db, soccod);
            return Ok(new { catcod = next });
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
