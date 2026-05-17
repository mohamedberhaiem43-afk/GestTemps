using ABRPOINT.Server.Annotations.AdminAttributes;
using ABRPOINT.Server.Billing;
using ABRPOINT.Server.Dtaos;
using ABRPOINT.Server.Helpers;
using ABRPOINT.Server.Interfaces;
using ABRPOINT.Server.Models;
using ABRPOINT.Server.Tenancy;
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
        private readonly IStorageQuotaGuard _quotaGuard;
        private readonly ICurrentTenant _currentTenant;
        public ParametresController(
            IParametreRepository parametreRepository,
            ISocieteRepository societeRepository,
            IStorageQuotaGuard quotaGuard,
            ICurrentTenant currentTenant)
        {
            _parametreRepository = parametreRepository;
            _societeRepository = societeRepository;
            _quotaGuard = quotaGuard;
            _currentTenant = currentTenant;
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
        // SEC-12 — Les paramètres complets contiennent la configuration de paie
        // (taux de majoration, règles métier). Restreint aux admins.
        [HttpGet("{soccod}")]
        [Admin]
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
        // SEC-12 — Lecture du paramètre "paie" : admin uniquement.
        [HttpGet("get-paie/{soccod}")]
        [Admin]
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
        public async Task<IActionResult> UploadSocieteLogo(IFormFile file, string soccod, CancellationToken ct)
        {
            // Garde quota — logo en théorie petit (< 1 Mo) mais on garde la check pour
            // un tenant qui aurait déjà saturé son stockage avec des bulletins de paie.
            if (file is not null && file.Length > 0 && _currentTenant.Current is { } tenant)
            {
                var snap = await _quotaGuard.CheckAsync(tenant.Id, file.Length, ct);
                if (snap.WouldExceed)
                {
                    return StatusCode(507, new
                    {
                        code = "storage_quota_exceeded",
                        message = $"Quota de stockage atteint ({snap.UsedMb} Mo / {snap.QuotaMb} Mo).",
                        usedMb = snap.UsedMb,
                        quotaMb = snap.QuotaMb,
                        percentUsed = snap.PercentUsed,
                    });
                }
            }
            var (success, filePath, error) = await FileHelper.SaveFile(file, _currentTenant.Current?.Slug);

            if (!success)
                return BadRequest(error);
            // Save filePath to the user's record in DB
            await _societeRepository.UpdateSocieteImageAsync(soccod, filePath);
            return Ok(new { filePath });
        }
    }
}
