using Xunit;
using Moq;
using FluentAssertions;
using ABRPOINT.Server.CalculService.HeureSupp;
using ABRPOINT.Server.Data;
using ABRPOINT.Server.Dtaos;
using ABRPOINT.Server.Interfaces;
using ABRPOINT.Server.Models;
using ABRPOINT.Server.Repository;
using Microsoft.EntityFrameworkCore;

namespace ABRPOINT.Server.Tests.CalculService
{
    /// <summary>
    /// Tests unitaires pour <see cref="PointageMoisService"/>.
    ///
    /// ⚠ Refactor majeur observé dans PointageMoisService.cs : la résolution des employés
    /// ne passe PLUS par IEmployeRepository.GetByEmpcod. Le service charge maintenant
    /// les Employes en BATCH directement via _dbContext.Employes (cf. lignes 31-34) pour
    /// éviter N+1 queries. Les anciens tests qui mockaient IEmployeRepository sont
    /// devenus inopérants : on seed désormais le DbContext InMemory.
    ///
    /// Couverture :
    ///   • dispatch hebdomadaire vs mensuel
    ///   • saut silencieux des empcods inconnus (= absents du batch)
    ///   • propagation Empreg / Empniv aux services de calcul
    ///   • cas dégénérés : liste vide, doublons, résultats vides
    /// </summary>
    public class PointageMoisServiceTests
    {
        private const string Soc = "01";
        private const string Mois = "04";
        private const string Annee = "2026";

        private static ApplicationDbContext NewContext()
            => new(new DbContextOptionsBuilder<ApplicationDbContext>()
                .UseInMemoryDatabase($"pointage-mois-{Guid.NewGuid()}").Options);

        private static Employe MakeEmploye(string empcod, string? niveau = "1", string? regime = "FRA")
        {
            return new Employe
            {
                Empcod = empcod,
                Soccod = Soc,
                Sitcod = "01",
                Empmat = $"MAT_{empcod}",
                Emplib = $"Lib {empcod}",
                Empreg = regime,
                Empniv = niveau,
            };
        }

        private static HeuresSupplementairesResultat MakeResultat(double hreSupSem = 0d)
        {
            return new HeuresSupplementairesResultat
            {
                HreSupSemaine = (float)hreSupSem,
                HeuresNormales = 35f,
            };
        }

        private static (PointageMoisService svc, Mock<IHeuresSupplementaireHebdomadairesService> hs,
                        Mock<IEmployeRepository> empRepo, ApplicationDbContext db) Build(params Employe[] employes)
        {
            var db = NewContext();
            if (employes.Length > 0)
            {
                db.Employes.AddRange(employes);
                db.SaveChanges();
            }
            var hs = new Mock<IHeuresSupplementaireHebdomadairesService>();
            var empRepo = new Mock<IEmployeRepository>();
            var svc = new PointageMoisService(db, empRepo.Object, hs.Object);
            return (svc, hs, empRepo, db);
        }

        // ───────────────────────── Cas nominaux ─────────────────────────

        [Fact]
        public async Task GetPointageMois_OneEmployee_WeeklyMode_CallsHebdomadairesAndReturnsOneResult()
        {
            var (svc, hs, _, db) = Build(MakeEmploye("E001"));
            await using var _ = db;
            hs.Setup(s => s.CalculerHeuresSupplementairesHebdomadaires(Soc, "E001", Mois, Annee, "1", "FRA", "1"))
              .ReturnsAsync(MakeResultat(2.5));

            var result = await svc.GetPointageMois(Soc, new List<string> { "E001" }, Mois, Annee, "1");

            result.Should().HaveCount(1);
            result[0].EmpCode.Should().Be("E001");
            result[0].EmpMat.Should().Be("MAT_E001");
            result[0].EmpLib.Should().Be("Lib E001");
            result[0].EmpReg.Should().Be("FRA");
            result[0].EmpSite.Should().Be("01");
            result[0].heuresSupplementairesResultats.Should().HaveCount(1);
            result[0].heuresSupplementairesResultats[0].HreSupSemaine.Should().BeApproximately(2.5f, 0.001f);
            hs.Verify(s => s.CalculerHeuresSupplementairesMultiSemaines(
                It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>(),
                It.IsAny<string>(), It.IsAny<string>()), Times.Never);
        }

        [Fact]
        public async Task GetPointageMois_OneEmployee_MonthlyMode_CallsMultiSemainesAndReturnsAllWeeks()
        {
            var (svc, hs, _, db) = Build(MakeEmploye("E001"));
            await using var _ = db;
            var weeks = new List<HeuresSupplementairesResultat>
            {
                MakeResultat(0d), MakeResultat(1.5d), MakeResultat(3d), MakeResultat(0d),
            };
            hs.Setup(s => s.CalculerHeuresSupplementairesMultiSemaines(Soc, "E001", Mois, Annee, "FRA", "1"))
              .ReturnsAsync(weeks);

            var result = await svc.GetPointageMois(Soc, new List<string> { "E001" }, Mois, Annee, "0");

            result.Should().HaveCount(1);
            result[0].heuresSupplementairesResultats.Should().HaveCount(4);
            result[0].heuresSupplementairesResultats.Sum(r => r.HreSupSemaine ?? 0f).Should().BeApproximately(4.5f, 0.001f);
            hs.Verify(s => s.CalculerHeuresSupplementairesHebdomadaires(
                It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>(),
                It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>()), Times.Never);
        }

        [Fact]
        public async Task GetPointageMois_MultipleEmployees_AggregatesResultsInOrder()
        {
            var (svc, hs, _, db) = Build(
                MakeEmploye("E001", niveau: "0", regime: "FRA"),
                MakeEmploye("E002", niveau: "1", regime: "FRA"),
                MakeEmploye("E003", niveau: "2", regime: "BEL"));
            await using var _ = db;
            hs.Setup(s => s.CalculerHeuresSupplementairesMultiSemaines(Soc, It.IsAny<string>(), Mois, Annee, It.IsAny<string>(), It.IsAny<string>()))
              .ReturnsAsync(new List<HeuresSupplementairesResultat> { MakeResultat(2d) });

            var result = await svc.GetPointageMois(Soc, new List<string> { "E001", "E002", "E003" }, Mois, Annee, "0");

            result.Should().HaveCount(3);
            result.Select(p => p.EmpCode).Should().ContainInOrder("E001", "E002", "E003");
            result.Should().OnlyContain(p => p.heuresSupplementairesResultats.Count == 1);
        }

        // ───────────────────────── Edge cases ─────────────────────────

        [Fact]
        public async Task GetPointageMois_EmptyEmpcodList_ReturnsEmptyList()
        {
            var (svc, hs, _, db) = Build();
            await using var _ = db;

            var result = await svc.GetPointageMois(Soc, new List<string>(), Mois, Annee, "0");

            result.Should().BeEmpty();
            hs.VerifyNoOtherCalls();
        }

        [Fact]
        public async Task GetPointageMois_UnknownEmpcod_IsSkipped()
        {
            // E001 existe, E_GHOST n'est pas en base → seul E001 doit ressortir.
            var (svc, hs, _, db) = Build(MakeEmploye("E001"));
            await using var _ = db;
            hs.Setup(s => s.CalculerHeuresSupplementairesMultiSemaines(Soc, "E001", Mois, Annee, "FRA", "1"))
              .ReturnsAsync(new List<HeuresSupplementairesResultat> { MakeResultat(0d) });

            var result = await svc.GetPointageMois(Soc, new List<string> { "E001", "E_GHOST" }, Mois, Annee, "0");

            result.Should().HaveCount(1);
            result[0].EmpCode.Should().Be("E001");
            hs.Verify(
                s => s.CalculerHeuresSupplementairesMultiSemaines(Soc, "E_GHOST",
                    It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>()),
                Times.Never);
        }

        [Fact]
        public async Task GetPointageMois_AllEmpcodsUnknown_ReturnsEmptyList()
        {
            // Aucun employé seedé → tous les empcods demandés sont "inconnus" et sautés.
            var (svc, hs, _, db) = Build();
            await using var _ = db;

            var result = await svc.GetPointageMois(Soc, new List<string> { "X1", "X2" }, Mois, Annee, "0");

            result.Should().BeEmpty();
            hs.VerifyNoOtherCalls();
        }

        [Fact]
        public async Task GetPointageMois_PassesEmployeRegimeAndNiveauToCalculService()
        {
            var (svc, hs, _, db) = Build(MakeEmploye("E001", niveau: "2", regime: "TUN"));
            await using var _ = db;
            hs.Setup(s => s.CalculerHeuresSupplementairesHebdomadaires(Soc, "E001", Mois, Annee, "3", "TUN", "2"))
              .ReturnsAsync(MakeResultat(0d));

            await svc.GetPointageMois(Soc, new List<string> { "E001" }, Mois, Annee, "3");

            hs.Verify(
                s => s.CalculerHeuresSupplementairesHebdomadaires(Soc, "E001", Mois, Annee, "3", "TUN", "2"),
                Times.Once);
        }

        [Fact]
        public async Task GetPointageMois_MultiSemaines_EmptyResultList_PointageStillReturned()
        {
            var (svc, hs, _, db) = Build(MakeEmploye("E001"));
            await using var _ = db;
            hs.Setup(s => s.CalculerHeuresSupplementairesMultiSemaines(Soc, "E001", Mois, Annee, "FRA", "1"))
              .ReturnsAsync(new List<HeuresSupplementairesResultat>());

            var result = await svc.GetPointageMois(Soc, new List<string> { "E001" }, Mois, Annee, "0");

            result.Should().HaveCount(1);
            result[0].heuresSupplementairesResultats.Should().BeEmpty();
        }

        [Fact]
        public async Task GetPointageMois_DuplicatedEmpcod_IsCalculatedTwice()
        {
            // Le service n'a pas de déduplication : si le même empcod est listé 2 fois,
            // on appelle le service de calcul 2 fois (à modifier si on décide de dédoublonner).
            var (svc, hs, _, db) = Build(MakeEmploye("E001"));
            await using var _ = db;
            hs.Setup(s => s.CalculerHeuresSupplementairesMultiSemaines(Soc, "E001", Mois, Annee, "FRA", "1"))
              .ReturnsAsync(new List<HeuresSupplementairesResultat> { MakeResultat(1d) });

            var result = await svc.GetPointageMois(Soc, new List<string> { "E001", "E001" }, Mois, Annee, "0");

            result.Should().HaveCount(2);
            hs.Verify(s => s.CalculerHeuresSupplementairesMultiSemaines(
                Soc, "E001", Mois, Annee, "FRA", "1"), Times.Exactly(2));
        }

        [Fact]
        public async Task GetPointageMois_CalculServiceThrows_PropagatesException()
        {
            // Si le service de calcul jette, l'exception remonte (pas de try/catch global).
            var (svc, hs, _, db) = Build(MakeEmploye("E001"));
            await using var _ = db;
            hs.Setup(s => s.CalculerHeuresSupplementairesMultiSemaines(Soc, "E001", Mois, Annee, "FRA", "1"))
              .ThrowsAsync(new Exception("calc err"));

            var act = async () => await svc.GetPointageMois(Soc, new List<string> { "E001" }, Mois, Annee, "0");

            await act.Should().ThrowAsync<Exception>().WithMessage("calc err");
        }
    }
}
