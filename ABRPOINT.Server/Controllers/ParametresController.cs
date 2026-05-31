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
            // Bug log #1 — Avant : retournait 404 quand aucun Parametre n'existe pour la
            // société, ce qui cassait silencieusement le filtre par défaut sur les pages
            // cahier-conge, etat-des-absences, etat-de-retard, etat-periodique et préparation
            // paie (toutes ces pages utilisaient les dates pour initialiser leur range).
            // On retombe désormais sur un default 01→30 / mois courant qui est exactement le
            // fallback déjà implémenté côté front, mais sans la console error et le 404 dans
            // les logs serveur.
            var result = await _parametreRepository.GetParametreMoisPointageAsync(soccod);
            if (result == null)
            {
                result = new ParametreMoisPointageDto
                {
                    Joudeb = "01",
                    Joufin = "30",
                    Moisdeb = "C",
                    Moisfin = "C",
                    Nbhconge = null,
                    Socpresence = null,
                    Sochsup = null,
                };
            }
            return Ok(result);
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
            // Gating « Custom Branding » : le logo société est réservé aux tenants éligibles
            // (Premium, OU un autre pack ayant souscrit l'option branding → GetEffectiveFeatures
            // mergé avec les addons, cohérent avec /me planAllows('customBranding') côté front et
            // avec SocietesController.Put). Pendant l'essai gratuit, tout est déverrouillé pour test.
            var planAllowsBranding = PlanCatalog
                .GetEffectiveFeatures(_currentTenant.Current?.PlanCode, _currentTenant.Current?.Addons)
                .CustomBranding;
            if (!planAllowsBranding && !TrialPolicy.IsTrialing(_currentTenant.Current))
            {
                return StatusCode(402, new
                {
                    code = "plan_feature_locked",
                    feature = "CustomBranding",
                    message = "La personnalisation du logo est réservée aux abonnements avec l'option Branding personnalisé (incluse dans Premium). Passez au pack supérieur ou ajoutez l'option pour l'activer."
                });
            }

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

        // PUT api/Parametres/branding/{soccod} — enregistre les couleurs de base personnalisées
        // (option « Branding personnalisé »). Gated identiquement à l'upload-logo : Premium OU
        // addon branding (GetEffectiveFeatures), bypass en essai. Le front applique ces couleurs
        // à tout le tenant via /me → AuthProvider → thème MUI.
        [Admin]
        [HttpPut("branding/{soccod}")]
        public async Task<IActionResult> UpdateBranding(string soccod, [FromBody] BrandingDto branding, CancellationToken ct)
        {
            var planAllowsBranding = PlanCatalog
                .GetEffectiveFeatures(_currentTenant.Current?.PlanCode, _currentTenant.Current?.Addons)
                .CustomBranding;
            if (!planAllowsBranding && !TrialPolicy.IsTrialing(_currentTenant.Current))
            {
                return StatusCode(402, new
                {
                    code = "plan_feature_locked",
                    feature = "CustomBranding",
                    message = "La personnalisation des couleurs est réservée aux abonnements avec l'option Branding personnalisé (incluse dans Premium)."
                });
            }

            // Validation hex (#RGB ou #RRGGBB). Une couleur invalide → 400 explicite plutôt que
            // de stocker une valeur qui casserait le thème de tous les utilisateurs du tenant.
            static bool IsHex(string? c) => c is null || System.Text.RegularExpressions.Regex.IsMatch(c, "^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$");
            if (!IsHex(branding?.Primary) || !IsHex(branding?.Background) || !IsHex(branding?.Title))
                return BadRequest(new { code = "invalid_color", message = "Couleur invalide : utilisez un format hexadécimal (#RRGGBB)." });

            // Toutes les couleurs nulles/vides → reset au thème par défaut (NULL en base).
            var hasAny = !string.IsNullOrWhiteSpace(branding?.Primary)
                      || !string.IsNullOrWhiteSpace(branding?.Background)
                      || !string.IsNullOrWhiteSpace(branding?.Title);
            string? json = null;
            if (hasAny)
            {
                json = System.Text.Json.JsonSerializer.Serialize(new
                {
                    primary = string.IsNullOrWhiteSpace(branding?.Primary) ? null : branding!.Primary,
                    background = string.IsNullOrWhiteSpace(branding?.Background) ? null : branding!.Background,
                    title = string.IsNullOrWhiteSpace(branding?.Title) ? null : branding!.Title,
                });
            }

            await _societeRepository.UpdateSocieteBrandingAsync(soccod, json);
            return Ok(new { branding = json });
        }

        // PUT api/Parametres/geofence-policy/{soccod} — politique de pointage hors zone :
        // acceptOutsideZone=true → accepter (avec notification employeur) ; false → refuser (défaut).
        // Réservé admin. Gated Geolocation (la zone géo est une feature de géolocalisation).
        [Admin]
        [Tenancy.RequirePlanFeature(nameof(Tenancy.PlanFeatures.Geolocation))]
        [HttpPut("geofence-policy/{soccod}")]
        public async Task<IActionResult> UpdateGeofencePolicy(string soccod, [FromBody] GeofencePolicyDto dto, CancellationToken ct)
        {
            await _societeRepository.UpdateSocieteGeofencePolicyAsync(soccod, dto?.AcceptOutsideZone == true ? "1" : "0");
            return Ok(new { acceptOutsideZone = dto?.AcceptOutsideZone == true });
        }
    }

    /// <summary>Politique de pointage hors zone geofence.</summary>
    public sealed class GeofencePolicyDto
    {
        public bool AcceptOutsideZone { get; set; }
    }

    /// <summary>Couleurs de base personnalisées (option Branding personnalisé).</summary>
    public sealed class BrandingDto
    {
        public string? Primary { get; set; }
        public string? Background { get; set; }
        public string? Title { get; set; }
    }
}
