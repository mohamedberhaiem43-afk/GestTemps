using ABRPOINT.Server.Data;
using ABRPOINT.Server.Helpers;
using ABRPOINT.Server.Interfaces;
using ABRPOINT.Server.Models;
using ABRPOINT.Server.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

// For more information on enabling Web API for empty projects, visit https://go.microsoft.com/fwlink/?LinkID=397860

namespace ABRPOINT.Server.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    [Authorize]
    public class VillesController : ControllerBase
    {
        private readonly IVilleRepository _villeRepository;
        private readonly ApplicationDbContext _db;
        private readonly IFrenchCitiesImportService _frenchCitiesImport;

        public VillesController(IVilleRepository villeRepository, ApplicationDbContext db, IFrenchCitiesImportService frenchCitiesImport)
        {
            _villeRepository = villeRepository;
            _db = db;
            _frenchCitiesImport = frenchCitiesImport;
        }

        // GET api/Villes/next-code — code séquentiel auto-généré (6 chiffres pour cohabiter avec INSEE).
        [HttpGet("next-code")]
        public async Task<IActionResult> NextCode()
        {
            var code = await SequentialCodeGenerator.NextVilleCodeAsync(_db);
            return Ok(new { code });
        }

        // POST api/Villes/import-france — importe les ~35k communes françaises depuis geo.api.gouv.fr.
        // Idempotent : les villes déjà présentes (par code INSEE) sont sautées.
        [HttpPost("import-france")]
        public async Task<IActionResult> ImportFrance(CancellationToken ct)
        {
            try
            {
                var report = await _frenchCitiesImport.ImportAsync(ct);
                return Ok(report);
            }
            catch (HttpRequestException ex)
            {
                return StatusCode(502, new { message = "Service externe injoignable", detail = "Erreur interne. Consultez les logs serveur pour le détail." });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = "Erreur lors de l'import", detail = "Erreur interne. Consultez les logs serveur pour le détail." });
            }
        }

        // GET: api/Villes
        [HttpGet]
        public async Task<IActionResult> Get()
        {
            try
            {
                var villes = await _villeRepository.GetAllAsync();
                return Ok(villes);
            }
            catch (Exception)
            {
                return StatusCode(500);
            }
        }

        [HttpGet("get-villibs")]
        public async Task<IActionResult> GetVillibs()
        {
            try
            {
                var villes = await _villeRepository.GetVillibsAsync();
                return Ok(villes);
            }
            catch (Exception)
            {
                return StatusCode(500);
            }
        }

        // GET api/Villes/01
        [HttpGet("{vilcod}")]
        public async Task<ActionResult<Ville>> Get(string vilcod)
        {
            var ville = await _villeRepository.GetByVilcodAsync(vilcod);
            if (ville == null)
            {
                return NotFound();
            }
            return Ok(ville);
        }

        // POST api/Villes
        [HttpPost]
        public async Task<IActionResult> Post([FromBody] Ville ville)
        {
            if (ville == null) return BadRequest();
            // S'assure que la colonne vilcod accepte 6 chars (legacy DBs avaient nvarchar(2)).
            await BaseDataSchemaMigrator.MigrateAsync(_db);
            if (string.IsNullOrWhiteSpace(ville.Vilcod))
            {
                ville.Vilcod = await SequentialCodeGenerator.NextVilleCodeAsync(_db);
            }
            await _villeRepository.AddAsync(ville);
            return CreatedAtAction(nameof(Get), new { vilcod = ville.Vilcod }, ville);
        }

        // PUT api/Villes/01
        [HttpPut("{vilcod}")]
        public async Task<IActionResult> Put(string vilcod, [FromBody] Ville ville)
        {
            if (ville == null || vilcod != ville.Vilcod)
            {
                return BadRequest();
            }

            await _villeRepository.UpdateAsync(ville);
            return NoContent();
        }

        // DELETE api/Villes/01
        [HttpDelete("{vilcod}")]
        public async Task<IActionResult> Delete(string vilcod)
        {
            var ville = await _villeRepository.GetByVilcodAsync(vilcod);
            if (ville == null)
            {
                return NotFound();
            }
            await _villeRepository.DeleteAsync(ville);
            return NoContent();
        }
    }
}
