using ABRPOINT.Server.Authorization;
using ABRPOINT.Server.Data;
using ABRPOINT.Server.Interfaces;
using ABRPOINT.Server.Models;
using ABRPOINT.Server.Tenancy;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace ABRPOINT.Server.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    // SEC AI : aucun [Authorize] → énumération anonyme des sites/établissements de chaque
    // société du tenant. Hardening : auth + soccod scopé.
    [Authorize]
    [ValidateSoccod]
    public class SitesController : ControllerBase
    {
        private readonly ISiteRepository _siteRepository;
        private readonly ICurrentTenant _currentTenant;
        private readonly ApplicationDbContext _db;

        public SitesController(ISiteRepository siteRepository, ICurrentTenant currentTenant, ApplicationDbContext db)
        {
            _siteRepository = siteRepository;
            _currentTenant = currentTenant;
            _db = db;
        }

        // GET: api/Sites/SOC01 — limité aux sites auxquels l'utilisateur est rattaché
        // (Socuser) ; admin → tous les sites de la société. Avant : tous les sites du soccod.
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

                var caller = SiteAccess.CallerUticod(HttpContext) ?? string.Empty;
                if (!await SiteAccess.IsAdminAsync(_db, caller))
                {
                    var sitcods = await SiteAccess.AccessibleSitcodsAsync(_db, soccod, caller);
                    var allowed = new HashSet<string>(sitcods, StringComparer.OrdinalIgnoreCase);
                    sites = sites.Where(s => s.Sitcod != null && allowed.Contains(s.Sitcod)).ToList();
                }
                return Ok(sites);
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = "Erreur lors de la récupération des sites", details = "Erreur interne. Consultez les logs serveur pour le détail." });
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
                return StatusCode(500, new { message = "Erreur lors de la récupération des sites", details = "Erreur interne. Consultez les logs serveur pour le détail." });
            }
        }

        // Libellés des sites pour les déroulants (sitcod → sitlib). Scopé par accès :
        // admin → tous les sites de la société ; non-admin → uniquement ses sites (Socuser).
        // Aligne le contenu des filtres (états, écrans de saisie) sur le modèle d'isolation
        // par site, comme l'endpoint Get({soccod}) ci-dessus.
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

                var caller = SiteAccess.CallerUticod(HttpContext) ?? string.Empty;
                if (!await SiteAccess.IsAdminAsync(_db, caller))
                {
                    var sitcods = await SiteAccess.AccessibleSitcodsAsync(_db, soccod, caller);
                    var allowed = new HashSet<string>(sitcods, StringComparer.OrdinalIgnoreCase);
                    sitLibs = sitLibs
                        .Where(kv => kv.Key != null && allowed.Contains(kv.Key))
                        .ToDictionary(kv => kv.Key, kv => kv.Value);
                }

                return Ok(sitLibs);
            }
            catch (InvalidOperationException ex)
            {
                return StatusCode(500, new { message = "Erreur interne. Consultez les logs serveur pour le détail.", details = ex.InnerException?.Message });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = "Erreur lors de la récupération des sites", details = "Erreur interne. Consultez les logs serveur pour le détail." });
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
                return StatusCode(500, new { message = "Erreur lors de la récupération des sites pour l'utilisateur", details = "Erreur interne. Consultez les logs serveur pour le détail." });
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
                return StatusCode(500, new { message = "Erreur lors de la récupération du site", details = "Erreur interne. Consultez les logs serveur pour le détail." });
            }
        }

        // POST api/Sites
        [Authorize]
        [RequirePermission(PermissionCatalog.Modules.DonneesDeBase, PermissionCatalog.Actions.Add)]
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

                // Quota plan : Starter = 1 site, Standard = 5 sites, Premium = illimité.
                var limits = TrialPolicy.GetLimits(_currentTenant.Current);
                if (limits.MaxSites.HasValue)
                {
                    var existing = (await _siteRepository.GetAllAsync(site.Soccod)).Count();
                    if (existing >= limits.MaxSites.Value)
                    {
                        var planLabel = TrialPolicy.IsTrialing(_currentTenant.Current)
                            ? "l'essai gratuit"
                            : $"votre plan {_currentTenant.Current?.PlanCode}";
                        // Message adapté à la progression Starter→Standard→Premium :
                        // on cite le plan supérieur réellement utile.
                        var currentPlanCode = _currentTenant.Current?.PlanCode ?? string.Empty;
                        var upgradeTarget = string.Equals(currentPlanCode, PlanCatalog.StarterCode, StringComparison.OrdinalIgnoreCase)
                            ? "Standard (jusqu'à 5 sites)"
                            : "Premium (sites et filiales illimités)";
                        var siteWord = limits.MaxSites.Value > 1 ? "sites maximum" : "site maximum";
                        return StatusCode(402, new
                        {
                            code = "plan_limit_sites",
                            isValid = false,
                            message = $"Limite de {planLabel} atteinte ({limits.MaxSites.Value} {siteWord}). Passez au plan {upgradeTarget}."
                        });
                    }
                }

                await _siteRepository.AddAsync(site);
                return Ok(new { isValid = true, message = "Site ajouté avec succès" });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { isValid = false, message = "Erreur lors de l'ajout du site", details = "Erreur interne. Consultez les logs serveur pour le détail." });
            }
        }

        // PUT api/Sites
        [Authorize]
        [RequirePermission(PermissionCatalog.Modules.DonneesDeBase, PermissionCatalog.Actions.Modify)]
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
                return StatusCode(500, new { message = "Erreur lors de la modification du site", details = "Erreur interne. Consultez les logs serveur pour le détail." });
            }
        }

        // DELETE api/Sites/SOC01/SITE01
        [Authorize]
        [RequirePermission(PermissionCatalog.Modules.DonneesDeBase, PermissionCatalog.Actions.Delete)]
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
                return StatusCode(500, new { message = "Erreur lors de la suppression du site", details = "Erreur interne. Consultez les logs serveur pour le détail." });
            }
        }
    }
}
