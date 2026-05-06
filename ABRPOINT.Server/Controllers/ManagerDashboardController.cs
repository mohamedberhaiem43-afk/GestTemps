using ABRPOINT.Server.Data;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

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
    public class ManagerDashboardController : ControllerBase
    {
        private readonly ApplicationDbContext _db;

        public ManagerDashboardController(ApplicationDbContext db)
        {
            _db = db;
        }

        /// <summary>
        /// Retourne les compteurs synthétiques pour la société courante.
        /// Le manager n'est pas filtré par service ici — un seul tenant,
        /// le manager voit tout ce qui le concerne sur la société (l'ACL
        /// fine est appliquée sur les écrans détaillés via les contrôleurs
        /// dédiés).
        /// </summary>
        [HttpGet("summary/{soccod}")]
        public async Task<IActionResult> GetSummary(string soccod)
        {
            if (string.IsNullOrWhiteSpace(soccod))
                return BadRequest(new { message = "soccod requis." });

            var today = DateTime.Today;
            var horizon = today.AddDays(30);

            // 1. Demandes de congé en attente. Une demande est considérée pending
            //    tant qu'aucune ligne miroir n'a été créée dans Conges (= validation
            //    ou refus). L'absence de Conrefus/Conaccept dans Demconge nous force
            //    à vérifier l'absence de ligne dans Conges (jointure).
            var pendingLeaves = await _db.Demconges
                .AsNoTracking()
                .Where(d => d.Soccod == soccod
                    && !_db.Conges.Any(c => c.Soccod == d.Soccod && c.Concod == d.Concod))
                .CountAsync();

            // 2. Demandes d'autorisation en attente.
            var pendingAuth = await _db.DemandeAutorisations
                .AsNoTracking()
                .Where(d => d.Soccod == soccod && d.Statut == "En attente")
                .CountAsync();

            // 3. Notes de frais en attente.
            var pendingExpenses = await _db.NoteDeFrais
                .AsNoTracking()
                .Where(n => n.Soccod == soccod && n.Etat == "Pending")
                .CountAsync();

            // 4. Missions en attente.
            var pendingMissions = await _db.Missions
                .AsNoTracking()
                .Where(m => m.Soccod == soccod && m.Misetat == "Pending")
                .CountAsync();

            // 5. Contrats expirant dans les 30 jours (employés actifs).
            //    Empsort est la date de fin contractuelle ; null => CDI sans terme.
            var contractsExpiring = await _db.Employes
                .AsNoTracking()
                .Where(e => e.Soccod == soccod
                    && e.Empsort != null
                    && e.Empsort >= today
                    && e.Empsort <= horizon
                    && e.Actif != "N")
                .CountAsync();

            // 6. Équipe absente aujourd'hui (congé validé qui couvre `today`).
            var absentToday = await _db.Conges
                .AsNoTracking()
                .Where(c => c.Soccod == soccod
                    && c.Conrefus != "1"
                    && c.Condep <= today && c.Conret >= today)
                .Select(c => c.Empcod)
                .Distinct()
                .CountAsync();

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
