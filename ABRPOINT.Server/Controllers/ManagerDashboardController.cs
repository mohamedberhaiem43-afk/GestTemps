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

            // Sous-requête : empcods autorisés (ceux du soccod dont le sitcod
            // est dans la liste). Réutilisé pour scoper toutes les autres
            // entités qui n'ont pas de Sitcod direct mais référencent Empcod.
            var allowedEmpcodsQuery = _db.Employes
                .AsNoTracking()
                .Where(e => e.Soccod == soccod && allowedSites.Contains(e.Sitcod))
                .Select(e => e.Empcod);

            // 1. Demandes de congé en attente. Une demande est considérée pending
            //    tant qu'aucune ligne miroir n'a été créée dans Conges (= validation
            //    ou refus).
            var pendingLeaves = await _db.Demconges
                .AsNoTracking()
                .Where(d => d.Soccod == soccod
                    && allowedEmpcodsQuery.Contains(d.Empcod)
                    && !_db.Conges.Any(c => c.Soccod == d.Soccod && c.Concod == d.Concod))
                .CountAsync(ct);

            // 2. Demandes d'autorisation en attente.
            var pendingAuth = await _db.DemandeAutorisations
                .AsNoTracking()
                .Where(d => d.Soccod == soccod
                    && d.Statut == "En attente"
                    && allowedEmpcodsQuery.Contains(d.Empcod))
                .CountAsync(ct);

            // 3. Notes de frais en attente.
            var pendingExpenses = await _db.NoteDeFrais
                .AsNoTracking()
                .Where(n => n.Soccod == soccod
                    && n.Etat == "Pending"
                    && allowedEmpcodsQuery.Contains(n.Empcod))
                .CountAsync(ct);

            // 4. Missions en attente.
            var pendingMissions = await _db.Missions
                .AsNoTracking()
                .Where(m => m.Soccod == soccod
                    && m.Misetat == "Pending"
                    && allowedEmpcodsQuery.Contains(m.Empcod))
                .CountAsync(ct);

            // 5. Contrats expirant dans les 30 jours (employés actifs sur sites autorisés).
            var contractsExpiring = await _db.Employes
                .AsNoTracking()
                .Where(e => e.Soccod == soccod
                    && allowedSites.Contains(e.Sitcod)
                    && e.Empsort != null
                    && e.Empsort >= today
                    && e.Empsort <= horizon
                    && e.Actif != "N")
                .CountAsync(ct);

            // 6. Équipe absente aujourd'hui sur les sites autorisés.
            var absentToday = await _db.Conges
                .AsNoTracking()
                .Where(c => c.Soccod == soccod
                    && c.Conrefus != "1"
                    && c.Condep <= today && c.Conret >= today
                    && allowedEmpcodsQuery.Contains(c.Empcod))
                .Select(c => c.Empcod)
                .Distinct()
                .CountAsync(ct);

            return Ok(new
            {
                pendingLeaves,
                pendingAuth,
                pendingExpenses,
                pendingMissions,
                pendingTotal = pendingLeaves + pendingAuth + pendingExpenses + pendingMissions,
                contractsExpiring,
                absentToday,
            });
        }
    }
}
