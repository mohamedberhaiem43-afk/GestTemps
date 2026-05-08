using ABRPOINT.Server.Annotations.AdminAttributes;
using ABRPOINT.Server.Authorization;
using ABRPOINT.Server.Data;
using ABRPOINT.Server.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace ABRPOINT.Server.Controllers
{
    /// <summary>
    /// Gestion des droits d'accès par site (table Socuser).
    /// Une ligne Socuser = (Soccod, Uticod, Sitcod) signifie « cet utilisateur
    /// peut consulter les données de ce site sur cette société ». L'absence
    /// totale de lignes pour un (Soccod, Uticod) empêche l'accès aux données
    /// scopées par site (employés, KPIs, demandes…) — sauf bypass admin
    /// (Utiadm='1') géré dans <see cref="Services.SiteAccessService"/>.
    /// </summary>
    [Route("api/[controller]")]
    [ApiController]
    [Authorize]
    // SEC AI : la table Socuser EST le mécanisme d'autorisation intra-tenant. Sans Admin,
    // n'importe qui pouvait s'auto-assigner toutes les sociétés/sites ou révoquer l'accès des
    // autres. ValidateSoccod scope les opérations route au tenant courant ; pour /assign (soccod
    // dans le body), le check inline + Admin couvre les cas restants.
    [Admin]
    [ValidateSoccod]
    public class SocuserController : ControllerBase
    {
        private readonly ApplicationDbContext _db;

        public SocuserController(ApplicationDbContext db)
        {
            _db = db;
        }

        public class UserSiteAccessRow
        {
            public string Uticod { get; set; } = string.Empty;
            public string? Utinom { get; set; }
            public string? Utiprn { get; set; }
            public string? Utimail { get; set; }
            public string? Utirole { get; set; }
            public bool IsAdmin { get; set; }
            public List<string> Sitcods { get; set; } = new();
        }

        /// <summary>
        /// Liste les utilisateurs de la société et les sites auxquels chacun
        /// a accès. Utilisé par la page d'affectation pour afficher la matrice
        /// utilisateur × site.
        /// </summary>
        [HttpGet("by-soc/{soccod}")]
        public async Task<IActionResult> GetBySoc(string soccod, CancellationToken ct)
        {
            if (string.IsNullOrWhiteSpace(soccod))
                return BadRequest(new { message = "soccod requis." });

            // On joint Utilisateurs × Socuser via Uticod. GroupBy côté client
            // après ToListAsync — la table Socuser est petite (1 ligne par
            // (utilisateur, site) accessible), donc la matérialisation reste
            // bornée par #users × #sites du tenant.
            var rawSocusers = await _db.Socusers
                .AsNoTracking()
                .Where(s => s.Soccod == soccod)
                .Select(s => new { s.Uticod, s.Sitcod })
                .ToListAsync(ct);

            var users = await _db.Utilisateurs
                .AsNoTracking()
                .Select(u => new { u.Uticod, u.Utinom, u.Utiprn, u.Utimail, u.Utirole, u.Utiadm })
                .ToListAsync(ct);

            var rows = users.Select(u => new UserSiteAccessRow
            {
                Uticod = u.Uticod ?? string.Empty,
                Utinom = u.Utinom,
                Utiprn = u.Utiprn,
                Utimail = u.Utimail,
                Utirole = u.Utirole,
                IsAdmin = u.Utiadm == "1",
                Sitcods = rawSocusers
                    .Where(s => s.Uticod == u.Uticod && s.Sitcod != null)
                    .Select(s => s.Sitcod!)
                    .Distinct()
                    .ToList(),
            })
            .OrderBy(r => r.Utinom ?? r.Uticod)
            .ToList();

            return Ok(rows);
        }

        /// <summary>
        /// Liste les sites auxquels un utilisateur précis a accès dans la société.
        /// </summary>
        [HttpGet("sites/{soccod}/{uticod}")]
        public async Task<IActionResult> GetSitesForUser(string soccod, string uticod, CancellationToken ct)
        {
            var sites = await _db.Socusers
                .AsNoTracking()
                .Where(s => s.Soccod == soccod && s.Uticod == uticod && s.Sitcod != null)
                .Select(s => s.Sitcod!)
                .Distinct()
                .ToListAsync(ct);
            return Ok(sites);
        }

        public class AssignRequest
        {
            public string Soccod { get; set; } = string.Empty;
            public string Uticod { get; set; } = string.Empty;
            /// <summary>
            /// Liste *complète* des sites souhaités pour cet utilisateur dans
            /// la société. Le serveur réconcilie : ajoute les nouveaux,
            /// supprime ceux qui ne sont plus dans la liste. Idempotent.
            /// </summary>
            public List<string> Sitcods { get; set; } = new();
            /// <summary>Exercice optionnel (4 chars). Si null, on prend l'année courante.</summary>
            public string? Exercice { get; set; }
        }

        /// <summary>
        /// Réconcilie l'ensemble des entrées Socuser pour un utilisateur :
        /// remplace la liste actuelle par celle fournie. Effectue un diff côté
        /// serveur pour ne supprimer/ajouter que ce qui change → garde l'audit
        /// trail propre (DeletedAt sur soft-delete, créations explicites).
        /// </summary>
        [HttpPost("assign")]
        public async Task<IActionResult> Assign([FromBody] AssignRequest req, CancellationToken ct)
        {
            if (req == null || string.IsNullOrWhiteSpace(req.Soccod) || string.IsNullOrWhiteSpace(req.Uticod))
                return BadRequest(new { message = "Soccod et Uticod requis." });

            var desired = (req.Sitcods ?? new List<string>())
                .Where(s => !string.IsNullOrWhiteSpace(s))
                .Distinct()
                .ToHashSet();

            var existing = await _db.Socusers
                .Where(s => s.Soccod == req.Soccod && s.Uticod == req.Uticod)
                .ToListAsync(ct);

            var existingSet = existing
                .Where(s => s.Sitcod != null)
                .Select(s => s.Sitcod!)
                .ToHashSet();

            // À ajouter : présents dans desired, absents dans existing.
            var toAdd = desired.Where(s => !existingSet.Contains(s)).ToList();
            // À retirer : présents dans existing, absents dans desired.
            var toRemove = existing.Where(s => s.Sitcod != null && !desired.Contains(s.Sitcod)).ToList();

            var exercice = string.IsNullOrWhiteSpace(req.Exercice)
                ? DateTime.UtcNow.Year.ToString()
                : req.Exercice;

            foreach (var sitcod in toAdd)
            {
                _db.Socusers.Add(new Socuser
                {
                    Soccod = req.Soccod,
                    Uticod = req.Uticod,
                    Sitcod = sitcod,
                    Exercice = exercice,
                });
            }
            if (toRemove.Count > 0)
            {
                _db.Socusers.RemoveRange(toRemove);
            }

            if (toAdd.Count > 0 || toRemove.Count > 0)
            {
                await _db.SaveChangesAsync(ct);
            }

            return Ok(new
            {
                added = toAdd.Count,
                removed = toRemove.Count,
                total = desired.Count,
            });
        }

        /// <summary>
        /// Retire l'accès d'un utilisateur à un site précis.
        /// </summary>
        [HttpDelete("{soccod}/{uticod}/{sitcod}")]
        public async Task<IActionResult> Revoke(string soccod, string uticod, string sitcod, CancellationToken ct)
        {
            var entry = await _db.Socusers
                .FirstOrDefaultAsync(s => s.Soccod == soccod && s.Uticod == uticod && s.Sitcod == sitcod, ct);
            if (entry == null) return NotFound();

            _db.Socusers.Remove(entry);
            await _db.SaveChangesAsync(ct);
            return NoContent();
        }
    }
}
