using ABRPOINT.Server.Annotations.AutSortieAttributes;
using ABRPOINT.Server.Authorization;
using ABRPOINT.Server.Data;
using ABRPOINT.Server.Dtaos;
using ABRPOINT.Server.Interfaces;
using ABRPOINT.Server.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;
using System.Threading.Tasks;

namespace ABRPOINT.Server.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    [Authorize]
    public class AutorisersController : ControllerBase
    {
        private readonly IautoriserRepository _autoriserRepository;
        private readonly IReportsGenerationService _reportsGenerationService;
        private readonly ApplicationDbContext _db;
        public AutorisersController(IautoriserRepository autoriserRepository, IReportsGenerationService reportsGenerationService, ApplicationDbContext db)
        {
            _autoriserRepository = autoriserRepository;
            _reportsGenerationService = reportsGenerationService;
            _db = db;
        }

        // A4 / A13 — l'utilisateur doit consulter / créer SES propres autorisations.
        // Accepté aussi pour un appelant admin/privilégié (manager/RH).
        private async Task<bool> CallerOwnsOrCanManageAsync(string targetEmpcod)
        {
            var caller = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (string.IsNullOrEmpty(caller)) return false;
            if (string.Equals(caller, targetEmpcod, StringComparison.OrdinalIgnoreCase)) return true;
            return await _db.Utilisateurs.AsNoTracking()
                .Where(u => u.Uticod == caller)
                .Select(u => u.Utiadm == "1" || PermissionCatalog.IsAdminRole(u.Utirole))
                .FirstOrDefaultAsync();
        }

        // GET: api/Autorisers/my-auths/{soccod}/{empcod} - Employee self-service (no special permission needed)
        [HttpGet("my-auths/{soccod}/{empcod}")]
        public async Task<IActionResult> GetMyAuthorizations(string soccod, string empcod)
        {
            if (string.IsNullOrWhiteSpace(soccod) || string.IsNullOrWhiteSpace(empcod))
                return BadRequest("Veuillez remplir les champs obligatoires");
            // A13 — un employé ne peut consulter QUE ses propres autorisations.
            if (!await CallerOwnsOrCanManageAsync(empcod)) return Forbid();
            try
            {
                List<AutoriserEmployeDto> result = await _autoriserRepository.GetAutoriserWithAbsenceAsync(soccod, empcod);
                return Ok(result ?? new List<AutoriserEmployeDto>());
            }
            catch (Exception)
            {
                return StatusCode(500);
            }
        }

        // GET: api/<DirectionsController>
        [HttpGet("{soccod}/{uticod}")]
        [CanGetAutSortie]
        public async Task<IActionResult> Get(string soccod, string uticod)
        {
            if (string.IsNullOrWhiteSpace(soccod)|| string.IsNullOrWhiteSpace(uticod))
                return BadRequest("Veuillez remplir les champs obligatoires");
            try
            {
                List<AutoriserEmployeDto> result = await _autoriserRepository.GetAutoriserWithAbsenceAsync(soccod, uticod);

                if (result == null)
                {
                    return NotFound();
                }

                return Ok(result);
            }
            catch (Exception)
            {

                return StatusCode(500);
            }
            
        }

        [HttpGet("get-autorisation/{soccod}/{concod}")]
        [CanGetAutSortie]
        public async Task<IActionResult> GetAutoriser(string soccod,string concod)
        {
            if (string.IsNullOrWhiteSpace(soccod) || string.IsNullOrWhiteSpace(concod))
                return BadRequest("Veuillez saisie les champs obligatoires");
            try
            {
                Autoriser autoriser = await _autoriserRepository.GetByConcodAsync(soccod, concod);
                return Ok(autoriser);
            }
            catch (Exception)
            {

                return StatusCode(500);
            }
        }
        [HttpGet("get-autorisation-report/{soccod}/{concod}")]
        [CanGetAutSortie]
        public IActionResult GetAutoriserReport(string soccod,string concod)
        {
            if (string.IsNullOrWhiteSpace(soccod) || string.IsNullOrWhiteSpace(concod))
                return BadRequest("Veuillez saisie les champs obligatoires");
            try
            {
                byte[] pdfBytes = _reportsGenerationService.GenerateAutorisationSortieReport(soccod, concod);
                return File(pdfBytes, "application/pdf", "AutorisationSortie.pdf");
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = "Erreur lors de récupérer des contrats", details = ex.Message });
            }
        }


        // POST api/Autorisers/my-auth - Employee self-service create (no special permission)
        // A4 — `autoriser.Empcod` doit correspondre à l'appelant. Sinon n'importe quel
        // employé peut créer une autorisation au nom de n'importe quel collègue.
        [HttpPost("my-auth")]
        public async Task<IActionResult> PostMyAuthorization([FromBody] Autoriser autoriser)
        {
            if (autoriser == null)
                return BadRequest("Veuillez saisir les champs obligatoires");
            try
            {
                var caller = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
                if (string.IsNullOrEmpty(caller)) return Unauthorized();
                if (string.IsNullOrEmpty(autoriser.Empcod))
                {
                    // Permissif : on aligne sur l'appelant si le client n'a pas posé l'empcod.
                    autoriser.Empcod = caller;
                }
                else if (!await CallerOwnsOrCanManageAsync(autoriser.Empcod))
                {
                    return Forbid();
                }

                await _autoriserRepository.AddAsync(autoriser);
                return Ok(new { message = "Autorisation de sortie envoyée avec succès", concod = autoriser.Concod });
            }
            catch (Exception)
            {
                return StatusCode(500);
            }
        }

        // POST api/<DirectionsController>
        [HttpPost]
        [CanAddAutSortie]
        public async Task Post([FromBody] Autoriser autoriser)
        {
            try
            {
                await _autoriserRepository.AddAsync(autoriser);
            }
            catch (Exception)
            {
                throw;
            }
        }
        [HttpPut("bulk")]
        [CanAddAutSortieGeneral]
        public async Task BulkPost([FromBody] List<Autoriser> autorisers)
        {
            try
            {
                await _autoriserRepository.AddMultipleAutorisation(autorisers);
            }
            catch (Exception)
            {
                throw;
            }
        }

        // PUT api/<DirectionsController>/5
        [HttpPut]
        [CanUpdateAutSortie]
        public async Task<IActionResult> Put([FromBody] Autoriser autoriser)
        {
            if (autoriser == null)
                return BadRequest("Veuillez saisie les champs obligatoires");
            try
            {
                await _autoriserRepository.UpdateAsync(autoriser);
                return Ok("Autorisation de sortie modifiée avec succées");
            }
            catch (Exception)
            {

                return StatusCode(500);
            }
            
        }

        // DELETE api/<DirectionsController>/5
        [HttpDelete("{soccod}/{concod}")]
        [CanDeleteAutSortie]
        public async Task<IActionResult> Delete(string soccod,string concod)
        {
            Autoriser autoriser = await _autoriserRepository.GetByConcodAsync(soccod,concod);
            if (autoriser == null)
            {
                return NotFound();
            }
            await _autoriserRepository.DeleteAsync(autoriser);
            return NoContent();
        }
    }
}
