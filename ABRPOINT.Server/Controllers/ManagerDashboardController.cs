using ABRPOINT.Server.Authorization;
using ABRPOINT.Server.Data;
using ABRPOINT.Server.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;

namespace ABRPOINT.Server.Controllers
{
    /// <summary>
    /// Endpoint léger destiné au tableau de bord manager mobile : il agrège en
    /// un seul appel les compteurs des actions « qui demandent mon attention »
    /// (validations en attente, contrats expirant bientôt, équipe en retard).
    ///
    /// Délibérément séparé du <see cref="DashboardController"/> existant qui
    /// est lourd (paramètres de filtres, dates, départements) et orienté admin
    /// web. Pour l'app mobile on veut une réponse minimale (~6 entiers) qui se
    /// charge en &lt; 200 ms même sur 4G.
    /// </summary>
    [Route("api/[controller]")]
    [ApiController]
    [Authorize]
    [ValidateSoccod]
    public class ManagerDashboardController : ControllerBase
    {
        private readonly ApplicationDbContext _db;
        private readonly ISiteAccessService _siteAccess;

        public ManagerDashboardController(ApplicationDbContext db, ISiteAccessService siteAccess)
        {
            _db = db;
            _siteAccess = siteAccess;
        }

        /// <summary>
        /// Retourne les compteurs synthétiques pour la société courante,
        /// scopés aux sites auxquels l'utilisateur a accès via Socuser.
        /// L'admin (Utiadm='1') voit tous les sites (cf. SiteAccessService).
        /// </summary>
        [HttpGet("summary/{soccod}/{uticod}")]
        public async Task<IActionResult> GetSummary(string soccod, string uticod, CancellationToken ct)
        {
            if (string.IsNullOrWhiteSpace(soccod) || string.IsNullOrWhiteSpace(uticod))
                return BadRequest(new { message = "soccod et uticod requis." });

            // SEC AI : sans ce check, n'importe quel user pouvait consulter le dashboard
            // d'un autre user en changeant uticod dans l'URL. Soit on est cet utilisateur,
            // soit on est admin tenant.
            var caller = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (string.IsNullOrEmpty(caller)) return Unauthorized();
            if (!string.Equals(caller, uticod, StringComparison.OrdinalIgnoreCase))
            {
                var callerIsAdmin = await _db.Utilisateurs.AsNoTracking()
                    .Where(u => u.Uticod == caller)
                    .Select(u => u.Utiadm == "1" || u.Utirole == PermissionCatalog.Roles.Administrator)
                    .FirstOrDefaultAsync(ct);
                if (!callerIsAdmin) return Forbid();
            }

            var today = DateTime.Today;
            var horizon = today.AddDays(30);

            // Sites accessibles. Si la liste est vide, on retourne des
            // compteurs nuls — le manager n'a accès à rien.
            var allowedSites = await _siteAccess.GetAuthorizedSitesAsync(soccod, uticod, ct);
            if (allowedSites.Count == 0)
            {
                return Ok(new
                {
                    pendingLeaves = 0, pendingAuth = 0, pendingExpenses = 0,
                    pendingMissions = 0, pendingTotal = 0,
                    contractsExpiring = 0, absentToday = 0,
                });
            }

            // PERF — Empcods autorisés matérialisés UNE FOIS. Avant, la sous-query
            // IQueryable était re-traduite dans chacun des 6 CountAsync ci-dessous →
            // SQL Server ne pouvait pas la cacher, et l'on payait son coût 5x.
            // Avec un List<string>, Contains() est expansé en IN(...) côté SQL.
            var allowedEmpcods = await _db.Employes
                .AsNoTracking()
                .Where(e => e.Soccod == soccod && allowedSites.Contains(e.Sitcod))
                .Select(e => e.Empcod)
                .ToListAsync(ct);

            // PERF — Les 6 compteurs sont agrégés dans une seule projection EF Core qui
            // se traduit en un unique SELECT avec sous-queries scalar. Avant, 6 round-trips
            // SQL séquentiels (~30-80 ms cumulés). Maintenant, 1 round-trip. Ce dashboard
            // est l'endpoint mobile cible "< 200 ms en 4G".
            var stats = await _db.Societes
                .AsNoTracking()
                .Where(s => s.Soccod == soccod)
                .Select(s => new
                {
                    // 1. Demandes de congé en attente (aucune ligne miroir dans Conges).
                    PendingLeaves = _db.Demconges.Count(d => d.Soccod == soccod
                        && allowedEmpcods.Contains(d.Empcod)
                        && !_db.Conges.Any(c => c.Soccod == d.Soccod && c.Concod == d.Concod)),

                    // 2. Demandes d'autorisation en attente.
                    PendingAuth = _db.DemandeAutorisations.Count(d => d.Soccod == soccod
                        && d.Statut == "En attente"
                        && allowedEmpcods.Contains(d.Empcod)),

                    // 3. Notes de frais en attente.
                    PendingExpenses = _db.NoteDeFrais.Count(n => n.Soccod == soccod
                        && n.Etat == "Pending"
                        && allowedEmpcods.Contains(n.Empcod)),

                    // 4. Missions en attente.
                    PendingMissions = _db.Missions.Count(m => m.Soccod == soccod
                        && m.Misetat == "Pending"
                        && allowedEmpcods.Contains(m.Empcod)),

                    // 5. Contrats expirant dans les 30 jours.
                    ContractsExpiring = _db.Employes.Count(e => e.Soccod == soccod
                        && allowedSites.Contains(e.Sitcod)
                        && e.Empsort != null
                        && e.Empsort >= today
                        && e.Empsort <= horizon
                        && e.Actif != "N"),

                    // 6. Équipe absente aujourd'hui (Distinct sur Empcod via sous-query).
                    AbsentToday = _db.Conges
                        .Where(c => c.Soccod == soccod
                            && c.Conrefus != "1"
                            && c.Condep <= today && c.Conret >= today
                            && allowedEmpcods.Contains(c.Empcod))
                        .Select(c => c.Empcod)
                        .Distinct()
                        .Count(),
                })
                .FirstOrDefaultAsync(ct);

            // Si la société n'existe pas dans la base (cas très rare puisque soccod
            // est validé par ValidateSoccod), on retourne des compteurs nuls.
            if (stats is null)
            {
                return Ok(new
                {
                    pendingLeaves = 0, pendingAuth = 0, pendingExpenses = 0,
                    pendingMissions = 0, pendingTotal = 0,
                    contractsExpiring = 0, absentToday = 0,
                });
            }

            return Ok(new
            {
                pendingLeaves = stats.PendingLeaves,
                pendingAuth = stats.PendingAuth,
                pendingExpenses = stats.PendingExpenses,
                pendingMissions = stats.PendingMissions,
                pendingTotal = stats.PendingLeaves + stats.PendingAuth + stats.PendingExpenses + stats.PendingMissions,
                contractsExpiring = stats.ContractsExpiring,
                absentToday = stats.AbsentToday,
            });
        }
    }
}
