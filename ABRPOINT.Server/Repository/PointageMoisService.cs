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

            // ── 2️⃣ Paralléliser les calculs par employé ──────────────────────
            // Chaque employé a 6 semaines de calculs indépendants. En séquentiel,
            // 50 employés × ~30 requêtes = ~1 500 requêtes qui s'exécutent l'une
            // après l'autre. En parallèle (MaxDegreeOfPartitioning limité pour
            // ne pas saturer le pool de connexions SQL), on divise le temps par ~4.
            var tasks = empcods
                .Where(empcod => employees.ContainsKey(empcod ?? string.Empty))
                .Select(empcod => Task.Run(async () =>
                {
                    var employe = employees[empcod ?? string.Empty];
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

                    return pointageMois;
                }));

            var pointages = await Task.WhenAll(tasks);
            return pointages.ToList();
        }
    }
}