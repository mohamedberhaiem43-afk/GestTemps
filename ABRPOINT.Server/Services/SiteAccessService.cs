using ABRPOINT.Server.Data;
using Microsoft.EntityFrameworkCore;

namespace ABRPOINT.Server.Services
{
    public interface ISiteAccessService
    {
        /// <summary>
        /// Retourne la liste des sites (sitcod) auxquels un utilisateur a accès,
        /// en lisant la table Socuser. Pour les administrateurs (Utiadm='1') on
        /// renvoie *tous* les sites de la société afin que les écrans qui font
        /// `Where(e => allowedSites.Contains(e.Sitcod))` continuent de tout
        /// afficher pour eux — sinon un admin sans entrée Socuser explicite
        /// se verrait refuser l'accès, ce qui est un piège classique.
        /// </summary>
        Task<List<string>> GetAuthorizedSitesAsync(string soccod, string uticod, CancellationToken ct = default);

        /// <summary>
        /// Helper : true si l'utilisateur a accès à au moins le site donné.
        /// Utile pour les checks fins (ouvrir une fiche, valider une demande).
        /// </summary>
        Task<bool> HasAccessToSiteAsync(string soccod, string uticod, string sitcod, CancellationToken ct = default);
    }

    /// <summary>
    /// Service centralisé de résolution des sites accessibles à un utilisateur.
    /// Toute lecture qui doit être scopée par site doit passer par ce service
    /// pour rester cohérente avec la table Socuser. La logique « admin = tous
    /// les sites » est implémentée ici (plutôt qu'éparpillée dans chaque
    /// repository) pour éviter les divergences.
    /// </summary>
    public class SiteAccessService : ISiteAccessService
    {
        private readonly ApplicationDbContext _db;

        public SiteAccessService(ApplicationDbContext db)
        {
            _db = db;
        }

        public async Task<List<string>> GetAuthorizedSitesAsync(string soccod, string uticod, CancellationToken ct = default)
        {
            if (string.IsNullOrWhiteSpace(soccod) || string.IsNullOrWhiteSpace(uticod))
                return new List<string>();

            // Bypass administrateur : un Utiadm='1' n'a pas besoin d'entrée
            // Socuser pour tout voir. C'est la sémantique attendue par les
            // écrans existants. Si on retire ce bypass, il faut s'assurer
            // que chaque admin a explicitement une ligne Socuser par site.
            var isAdmin = await _db.Utilisateurs
                .AsNoTracking()
                .Where(u => u.Uticod == uticod)
                .Select(u => u.Utiadm == "1")
                .FirstOrDefaultAsync(ct);

            if (isAdmin)
            {
                return await _db.Sites
                    .AsNoTracking()
                    .Where(s => s.Soccod == soccod)
                    .Select(s => s.Sitcod!)
                    .Where(c => c != null)
                    .ToListAsync(ct);
            }

            return await _db.Socusers
                .AsNoTracking()
                .Where(s => s.Soccod == soccod && s.Uticod == uticod && s.Sitcod != null)
                .Select(s => s.Sitcod!)
                .Distinct()
                .ToListAsync(ct);
        }

        public async Task<bool> HasAccessToSiteAsync(string soccod, string uticod, string sitcod, CancellationToken ct = default)
        {
            if (string.IsNullOrWhiteSpace(soccod) || string.IsNullOrWhiteSpace(uticod) || string.IsNullOrWhiteSpace(sitcod))
                return false;

            var isAdmin = await _db.Utilisateurs
                .AsNoTracking()
                .Where(u => u.Uticod == uticod)
                .Select(u => u.Utiadm == "1")
                .FirstOrDefaultAsync(ct);
            if (isAdmin) return true;

            return await _db.Socusers
                .AsNoTracking()
                .AnyAsync(s => s.Soccod == soccod && s.Uticod == uticod && s.Sitcod == sitcod, ct);
        }
    }
}
