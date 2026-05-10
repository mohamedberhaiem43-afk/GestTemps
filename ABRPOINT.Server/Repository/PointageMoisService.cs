using ABRPOINT.Server.CalculService.HeureSupp;
using ABRPOINT.Server.Data;
using ABRPOINT.Server.Dtaos;
using ABRPOINT.Server.Interfaces;
using Microsoft.EntityFrameworkCore;

namespace ABRPOINT.Server.Repository
{
    public class PointageMoisService : IPointageMoisService
    {
        private readonly ApplicationDbContext _dbContext;
        private readonly IEmployeRepository _employeRepository;
        private readonly IHeuresSupplementaireHebdomadairesService _heuresSupplementairesService;

        public PointageMoisService(
            ApplicationDbContext dbContext,
            IEmployeRepository employeRepository,
            IHeuresSupplementaireHebdomadairesService heuresSupplementairesService)
        {
            _dbContext = dbContext;
            _employeRepository = employeRepository;
            _heuresSupplementairesService = heuresSupplementairesService;
        }

        public async Task<List<PointageMois>> GetPointageMois(string soccod, List<string> empcods, string mois, string annee, string semaine)
        {
            if (empcods == null || empcods.Count == 0)
                return new List<PointageMois>();

            // ── 1️⃣ Batch load : tous les employés en UNE SEULE requête ────────
            var employees = await _dbContext.Employes
                .AsNoTracking()
                .Where(e => e.Soccod == soccod && empcods.Contains(e.Empcod))
                .ToDictionaryAsync(e => e.Empcod ?? string.Empty);

            // ── 2️⃣ Boucle séquentielle : ApplicationDbContext n'est PAS thread-safe.
            // L'ancienne version utilisait Task.WhenAll + Task.Run → toutes les tâches
            // partageaient le même DbContext scoped via _heuresSupplementairesService et
            // EF Core levait `InvalidOperationException: A second operation was started
            // on this context instance...` (HTTP 500 aléatoire selon l'interleaving).
            // Pour un vrai parallélisme il faudrait IDbContextFactory et instancier un
            // context par tâche — refactor plus large laissé pour V1.1.
            var pointages = new List<PointageMois>();
            foreach (var empcod in empcods)
            {
                if (!employees.TryGetValue(empcod ?? string.Empty, out var employe))
                    continue;

                var pointageMois = new PointageMois
                {
                    EmpCode = empcod,
                    EmpMat = employe.Empmat,
                    EmpLib = employe.Emplib,
                    EmpReg = employe.Empreg,
                    EmpSite = employe.Sitcod
                };

                if (semaine == "0")
                {
                    var resultats = await _heuresSupplementairesService
                        .CalculerHeuresSupplementairesMultiSemaines(
                            soccod, empcod, mois, annee,
                            employe.Empreg, employe.Empniv);
                    pointageMois.heuresSupplementairesResultats.AddRange(resultats);
                }
                else
                {
                    var resultat = await _heuresSupplementairesService
                        .CalculerHeuresSupplementairesHebdomadaires(
                            soccod, empcod, mois, annee, semaine,
                            employe.Empreg, employe.Empniv);
                    pointageMois.heuresSupplementairesResultats.Add(resultat);
                }

                pointages.Add(pointageMois);
            }
            return pointages;
        }
    }
}