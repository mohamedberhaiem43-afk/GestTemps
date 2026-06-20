using ABRPOINT.Server.Authorization;
using ABRPOINT.Server.Data;
using ABRPOINT.Server.Interfaces;
using ABRPOINT.Server.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace ABRPOINT.Server.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    [Authorize]
    // SEC AI : ValidateSoccod manquait — un user de la société A pouvait lire/supprimer les
    // soldes congés des employés de la société B en changeant le paramètre URL.
    [ValidateSoccod]
    public class SoldesController : ControllerBase
    {
        private readonly ISoldeCongeRepository _soldeCongeRepository;
        private readonly ApplicationDbContext _db;
        public SoldesController(ISoldeCongeRepository soldeCongeRepository, ApplicationDbContext db)
        {
            _soldeCongeRepository = soldeCongeRepository;
            _db = db;
        }
        // GET: api/<DirectionsController>
        [HttpGet]
        public async Task<IActionResult> Get()
        {
            try
            {
                // ⚠ GetAllAsync() retourne TOUS les soldes (aucun filtre soccod/site). Sans
                // restriction, un simple employé dumpait les soldes congé/RTT/CET de tout le
                // tenant. On filtre donc par site accessible (admin = tout) — IDOR/BOLA.
                var soldes = (await _soldeCongeRepository.GetAllAsync()).ToList();
                var uticod = SiteAccess.CallerUticod(HttpContext) ?? string.Empty;
                if (!string.IsNullOrEmpty(uticod) && !await SiteAccess.IsAdminAsync(_db, uticod))
                {
                    var allowed = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
                    foreach (var soc in soldes.Select(s => s.Soccod).Where(s => !string.IsNullOrEmpty(s)).Distinct())
                    {
                        var sitcods = await SiteAccess.AccessibleSitcodsAsync(_db, soc!, uticod);
                        if (sitcods.Count == 0) continue;
                        var emps = await _db.Employes.AsNoTracking()
                            .Where(e => e.Soccod == soc && e.Sitcod != null && sitcods.Contains(e.Sitcod))
                            .Select(e => e.Empcod)
                            .ToListAsync();
                        foreach (var e in emps) allowed.Add(soc + "|" + e);
                    }
                    soldes = soldes.Where(s => allowed.Contains(s.Soccod + "|" + s.Empcod)).ToList();
                }
                return Ok(soldes);
            }
            catch (Exception ex)
            {
                return StatusCode(500,ex);
            }

        }


        // POST api/<DirectionsController>
        [HttpPost]
        public async Task<IActionResult> Post([FromBody] Solde solde)
        {
            if (solde == null)
                return BadRequest("Veuillez remplire les champs obligatoire");
            try
            {
                await _soldeCongeRepository.AddAsync(solde);
                return Ok(solde);
            }
            catch (Exception ex)
            {
                return StatusCode(500, ex);
            }
        }

        // PUT api/<DirectionsController>/5
        [HttpPut]
        public async Task<IActionResult> Put([FromBody] Solde ferier)
        {
            if (ferier == null)
                return BadRequest("Veuillez saisie les champs obligatoires");
            try
            {
                await _soldeCongeRepository.UpdateAsync(ferier);
                return Ok(ferier);
            }
            catch (Exception ex)
            {
                return StatusCode(500,ex);
            }
        }

        // DELETE api/<DirectionsController>/5
        [HttpDelete("{soccod}/{empcod}")]
        public async Task<IActionResult> Delete(string soccod, string empcod)
        {
            if (string.IsNullOrWhiteSpace(soccod) || string.IsNullOrWhiteSpace(empcod))
                return BadRequest("code société est code employé sont obligatoires");
            // Isolation par site (IDOR) — opération destructive : allowSelf=false (un salarié ne
            // supprime pas son propre solde). Seuls admin/manager du site de l'employé.
            if (!await SiteAccess.CallerCanAccessEmployeeAsync(_db, soccod, empcod, SiteAccess.CallerUticod(HttpContext), allowSelf: false))
                return Forbid();
            try
            {
                Solde solde = await _soldeCongeRepository.GetByEmpcodAsync(soccod, empcod);
                if (solde == null)
                {
                    return NotFound("solde non trouvé");
                }
                _soldeCongeRepository.DeleteAsync(solde);
                return Ok("solde supprimé avec succées");
            }
            catch (Exception ex )
            {
                return StatusCode(500,ex);
            }
            
        }

        [HttpGet("by-emp/{soccod}/{empcod}")]
        public async Task<IActionResult> GetByEmp(string soccod, string empcod)
        {
            // Isolation par site (IDOR) : un salarié ne lit que son propre solde (allowSelf),
            // un manager ceux de ses sites, l'admin tout.
            if (!await SiteAccess.CallerCanAccessEmployeeAsync(_db, soccod, empcod, SiteAccess.CallerUticod(HttpContext)))
                return Forbid();
            try
            {
                var solde = await _soldeCongeRepository.GetByEmpCalculatedAsync(soccod, empcod);
                return Ok(solde);
            }
            catch (Exception ex)
            {
                return StatusCode(500, "Erreur interne. Consultez les logs serveur pour le détail.");
            }
        }
    }
}
