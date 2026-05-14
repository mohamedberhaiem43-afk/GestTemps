using ABRPOINT.Server.Annotations.CongesAttributes.DemCongeAttributes;
using ABRPOINT.Server.Data;
using ABRPOINT.Server.Dtaos;
using ABRPOINT.Server.Interfaces;
using ABRPOINT.Server.Models;
using ABRPOINT.Server.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Threading.Tasks;

namespace ABRPOINT.Server.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    [Authorize]
    [Tenancy.RequirePlanFeature(nameof(Tenancy.PlanFeatures.LeaveManagement))]
    public class DemCongesController : ControllerBase
    {
        private readonly IDemCongeRepository _demandecongeRepository;
        private readonly ApplicationDbContext _context;
        private readonly IUserNotificationService? _notify;
        public DemCongesController(IDemCongeRepository demandecongeRepository, ApplicationDbContext context, IUserNotificationService? notify = null)
        {
            _demandecongeRepository = demandecongeRepository;
            _context = context;
            _notify = notify;
        }

        // GET: api/DemConges/get-next-concod/{soccod}
        // A16 — Permission requise (créer une demande de congé).
        [HttpGet("get-next-concod/{soccod}")]
        [CanAddDemConge]
        public async Task<IActionResult> GetNextConcod(string soccod)
        {
            try
            {
                var now = DateTime.Now;
                var prefix = "D" + now.ToString("yyMM");

                var maxConcod = await _context.Demconges
                    .Where(c => c.Soccod == soccod && c.Concod.StartsWith(prefix))
                    .OrderByDescending(c => c.Concod)
                    .Select(c => c.Concod)
                    .FirstOrDefaultAsync();

                int nextSeq = 1;
                if (!string.IsNullOrEmpty(maxConcod) && maxConcod.Length >= 7)
                {
                    if (int.TryParse(maxConcod.Substring(5), out int lastSeq))
                        nextSeq = lastSeq + 1;
                }

                var nextConcod = prefix + nextSeq.ToString("D2");
                return Ok(new { concod = nextConcod });
            }
            catch (Exception ex)
            {
                return StatusCode(500, "Erreur lors de la génération du numéro: ");
            }
        }
        // GET: api/<DirectionsController>
        [HttpGet("get-demconge/{soccod}/{uticod}")]
        [CanGetDemConge]
        public async Task<List<DemcongeEmpAbsDto>> GetCongeWithAbsenceAsync(string soccod, string uticod)
        {
            try
            {
                return await _demandecongeRepository.GetDemongeWithAbsenceAsync(soccod, uticod);
            }
            catch (Exception)
            {
                throw;
            }
        }
        // A12 — Self-service : un employé voit ses propres demandes ; sinon permission consult requise.
        // Avant, n'importe quel user pouvait lister les demandes de congés d'un autre via cet endpoint.
        [HttpGet("get-emp-demconge/{soccod}/{empcod}")]
        public async Task<IActionResult> GetEmpDemconge(string soccod, string empcod)
        {
            try
            {
                var caller = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;
                if (string.IsNullOrEmpty(caller)) return Unauthorized();
                if (!string.Equals(caller, empcod, StringComparison.OrdinalIgnoreCase))
                {
                    var isPrivileged = await _context.Utilisateurs.AsNoTracking()
                        .Where(u => u.Uticod == caller)
                        .Select(u => u.Utiadm == "1" || ABRPOINT.Server.Authorization.PermissionCatalog.IsAdminRole(u.Utirole))
                        .FirstOrDefaultAsync();
                    if (!isPrivileged) return Forbid();
                }

                var result = await _demandecongeRepository.GetEmpDemcongeAsync(soccod, empcod);
                return Ok(result);
            }
            catch (Exception)
            {
                throw;
            }
        }

        [HttpGet("get-demconge-by-periode/{soccod}/{uticod}/{datedebut}/{datefin}")]
        [CanGetDemConge]
        public async Task<List<DemcongeDto>> GetCongeWithAbsenceAsync(string soccod, string uticod,DateTime datedebut,DateTime datefin)
        {
            try
            {
                datedebut = datedebut.Date;
                datefin = datefin.Date;
                    var result =  await _demandecongeRepository.GetAllByPeriodAsync(soccod, uticod,datedebut,datefin);
                return result;
            }
            catch (Exception)
            {
                throw;
            }
        }
        [HttpGet("get-pending-demconge-by-periode/{soccod}/{uticod}/{datedebut}/{datefin}")]
        [CanGetDemConge]
        public async Task<List<Demconge>> GetPendingCongeWithAbsenceAsync(string soccod, string uticod,DateTime datedebut,DateTime datefin)
        {
            try
            {
                datedebut = datedebut.Date;
                datefin = datefin.Date;
                    var result =  await _demandecongeRepository.GetAllEnAttenteByPeriodAsync(soccod, uticod,datedebut,datefin);
                return result;
            }
            catch (Exception)
            {
                throw;
            }
        }

        [HttpPost("accept-demconge/{soccod}/{concod}/{empcod}")]
        [CanAddDemConge]
        public async Task<IActionResult> AcceptDemConge(string soccod, string concod,string empcod)
        {
            try
            {
                var result = await _demandecongeRepository.AcceptDemCongeAsync(soccod, concod,empcod);

                if (!result.Success)
                {
                    return BadRequest(new
                    {
                        success = false,
                        message = result.Message
                    });
                }

                // Notifie l'employé que sa demande est validée.
                if (_notify != null)
                {
                    _ = _notify.NotifyUserAsync(
                        empcod,
                        "✅ Votre congé est validé",
                        "Bonne nouvelle : votre demande de congé est acceptée.",
                        new { type = "leave_request_accepted", concod, soccod });
                }

                return Ok(new
                {
                    success = true,
                    message = result.Message
                });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new
                {
                    success = false,
                    message = $"Erreur interne du serveur: erreur interne"
                });
            }
        }

        [HttpPost("refuse-demconge/{soccod}/{concod}/{empcod}")]
        [CanAddDemConge]
        public async Task<IActionResult> RefuseDemConge(string soccod, string concod,string empcod)
        {
            try
            {
                var result = await _demandecongeRepository.RefuseDemCongeAsync(soccod, concod,empcod);

                if (!result.Success)
                {
                    return BadRequest(new
                    {
                        success = false,
                        message = result.Message
                    });
                }

                if (_notify != null)
                {
                    _ = _notify.NotifyUserAsync(
                        empcod,
                        "❌ Votre congé est refusé",
                        "Votre demande n'a pas été acceptée. Consultez le motif dans Demandes et validations.",
                        new { type = "leave_request_refused", concod, soccod });
                }

                return Ok(new
                {
                    success = true,
                    message = result.Message
                });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new
                {
                    success = false,
                    message = $"Erreur interne du serveur: erreur interne"
                });
            }
        }


        // POST api/<DirectionsController>
        [HttpPost]
        [CanAddDemConge]
        public async Task<IActionResult> Post([FromBody] Demconge conge)
        {
            if (conge == null)
                return BadRequest("Veuillez saisie les champs obligatoires");
            try
            {
                await _demandecongeRepository.AddAsync(conge);
            }
            catch (Exception)
            {
                return StatusCode(500);
            }

            // Best-effort : un échec de notification (DbContext concurrent, employé
            // introuvable, push provider down…) NE DOIT PAS faire retomber le client
            // sur "Impossible d'ajouter" alors que la demande est bien persistée.
            try
            {
                if (_notify != null)
                {
                    var who = await _context.Employes.AsNoTracking()
                        .Where(e => e.Soccod == conge.Soccod && e.Empcod == conge.Empcod)
                        .Select(e => e.Emplib)
                        .FirstOrDefaultAsync()
                        ?? conge.Empcod ?? "Un employé";
                    _ = _notify.NotifyManagersAsync(
                        "🗓️ Demande de congé à valider",
                        $"{who} attend votre validation.",
                        new { type = "leave_request_created", concod = conge.Concod, soccod = conge.Soccod });
                }
            }
            catch (Exception notifyEx)
            {
                Console.WriteLine($"[DemConges.Post] Notification side-effect failed (ignored, record was saved): {notifyEx.Message}");
            }

            return Ok("Demande ajouté avec succées");
        }

        // PUT api/<DirectionsController>/5
        [HttpPut]
        [CanUpdateDemConge]
        public async Task<IActionResult> Put([FromBody] Demconge demconge)
        {
            if (demconge == null || string.IsNullOrWhiteSpace(demconge.Concod))
                return BadRequest("Veuillez saisie les champs obligatoires");
            try
            {
                await _demandecongeRepository.UpdateAsync(demconge);
                return Ok("Demande de congé modifiée avec sucées");
            }
            catch (Exception)
            {

                return StatusCode(500);
            }
            
        }

        // DELETE api/<DirectionsController>/5
        [HttpDelete("{soccod}/{concod}")]
        [CanDeleteDemConge]
        public async Task<IActionResult> Delete(string soccod, string concod)
        {
            Demconge? demconge = await _demandecongeRepository.GetByConcodAsync(soccod, concod);
            if (demconge == null)
            {
                return NotFound();
            }
            await _demandecongeRepository.DeleteAsync(demconge);
            return NoContent();
        }
    }
}
