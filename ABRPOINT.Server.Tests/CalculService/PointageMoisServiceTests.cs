using Xunit;
using Moq;
using FluentAssertions;
using ABRPOINT.Server.CalculService.HeureSupp;
using ABRPOINT.Server.Dtaos;
using ABRPOINT.Server.Interfaces;
using ABRPOINT.Server.Models;
using ABRPOINT.Server.Repository;

namespace ABRPOINT.Server.Tests.CalculService
{
    /// <summary>
    /// Tests unitaires pour <see cref="PointageMoisService"/>.
    /// On mocke <see cref="IEmployeRepository"/> et <see cref="IHeuresSupplementaireHebdomadairesService"/>.
    /// Le service ne fait pas de calcul lui-même : il dispatch entre Hebdomadaires (semaine != "0")
    /// et MultiSemaines (semaine == "0"), assemble la sortie, et saute les empcods inconnus.
    /// </summary>
    public class PointageMoisServiceTests
    {
        private readonly Mock<IEmployeRepository> _mockEmployeRepository;
        private readonly Mock<IHeuresSupplementaireHebdomadairesService> _mockHsService;
        private readonly PointageMoisService _service;

        private const string Soc = "01";
        private const string Mois = "04";
        private const string Annee = "2026";

        public PointageMoisServiceTests()
        {
            _mockEmployeRepository = new Mock<IEmployeRepository>();
            _mockHsService = new Mock<IHeuresSupplementaireHebdomadairesService>();
            _service = new PointageMoisService(_mockEmployeRepository.Object, _mockHsService.Object);
        }

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

        // ───────────────────────── Cas nominaux ─────────────────────────

        [Fact]
        public async Task GetPointageMois_OneEmployee_WeeklyMode_CallsHebdomadairesAndReturnsOneResult()
        {
            // Arrange : semaine != "0" → on attend l'appel CalculerHeuresSupplementairesHebdomadaires.
            var emp = MakeEmploye("E001");
            _mockEmployeRepository.Setup(r => r.GetByEmpcod(Soc, "E001")).ReturnsAsync(emp);
            _mockHsService
                .Setup(s => s.CalculerHeuresSupplementairesHebdomadaires(Soc, "E001", Mois, Annee, "1", "FRA", "1"))
                .ReturnsAsync(MakeResultat(2.5));

            var result = await _service.GetPointageMois(Soc, new List<string> { "E001" }, Mois, Annee, "1");

            result.Should().HaveCount(1);
            result[0].EmpCode.Should().Be("E001");
            result[0].EmpMat.Should().Be("MAT_E001");
            result[0].EmpLib.Should().Be("Lib E001");
            result[0].EmpReg.Should().Be("FRA");
            result[0].EmpSite.Should().Be("01");
            result[0].heuresSupplementairesResultats.Should().HaveCount(1);
            result[0].heuresSupplementairesResultats[0].HreSupSemaine.Should().BeApproximately(2.5f, 0.001f);
            _mockHsService.Verify(s => s.CalculerHeuresSupplementairesMultiSemaines(
                It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>(),
                It.IsAny<string>(), It.IsAny<string>()), Times.Never);
        }

        [Fact]
        public async Task GetPointageMois_OneEmployee_MonthlyMode_CallsMultiSemainesAndReturnsAllWeeks()
        {
            // Arrange : semaine == "0" → on attend MultiSemaines avec autant de résultats que de semaines.
            var emp = MakeEmploye("E001");
            _mockEmployeRepository.Setup(r => r.GetByEmpcod(Soc, "E001")).ReturnsAsync(emp);
            var weeks = new List<HeuresSupplementairesResultat>
            {
                MakeResultat(0d),
                MakeResultat(1.5d),
                MakeResultat(3d),
                MakeResultat(0d),
            };
            _mockHsService
                .Setup(s => s.CalculerHeuresSupplementairesMultiSemaines(Soc, "E001", Mois, Annee, "FRA", "1"))
                .ReturnsAsync(weeks);

            var result = await _service.GetPointageMois(Soc, new List<string> { "E001" }, Mois, Annee, "0");

            result.Should().HaveCount(1);
            result[0].heuresSupplementairesResultats.Should().HaveCount(4);
            result[0].heuresSupplementairesResultats.Sum(r => r.HreSupSemaine ?? 0f).Should().BeApproximately(4.5f, 0.001f);
            _mockHsService.Verify(s => s.CalculerHeuresSupplementairesHebdomadaires(
                It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>(),
                It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>()), Times.Never);
        }

        [Fact]
        public async Task GetPointageMois_MultipleEmployees_AggregatesResultsInOrder()
        {
            // Arrange : 3 employés en mode mensuel — chaque employé doit produire un PointageMois distinct.
            var employees = new[]
            {
                MakeEmploye("E001", niveau: "0", regime: "FRA"),
                MakeEmploye("E002", niveau: "1", regime: "FRA"),
                MakeEmploye("E003", niveau: "2", regime: "BEL"),
            };
            foreach (var e in employees)
                _mockEmployeRepository.Setup(r => r.GetByEmpcod(Soc, e.Empcod)).ReturnsAsync(e);
            _mockHsService
                .Setup(s => s.CalculerHeuresSupplementairesMultiSemaines(Soc, It.IsAny<string>(), Mois, Annee, It.IsAny<string>(), It.IsAny<string>()))
                .ReturnsAsync(new List<HeuresSupplementairesResultat> { MakeResultat(2d) });

            var result = await _service.GetPointageMois(Soc, new List<string> { "E001", "E002", "E003" }, Mois, Annee, "0");

            result.Should().HaveCount(3);
            result.Select(p => p.EmpCode).Should().ContainInOrder("E001", "E002", "E003");
            result.Should().OnlyContain(p => p.heuresSupplementairesResultats.Count == 1);
        }

        // ───────────────────────── Edge cases ─────────────────────────

        [Fact]
        public async Task GetPointageMois_EmptyEmpcodList_ReturnsEmptyList()
        {
            var result = await _service.GetPointageMois(Soc, new List<string>(), Mois, Annee, "0");

            result.Should().BeEmpty();
            _mockEmployeRepository.Verify(r => r.GetByEmpcod(It.IsAny<string>(), It.IsAny<string>()), Times.Never);
        }

        [Fact]
        public async Task GetPointageMois_UnknownEmpcod_IsSkipped()
        {
            // Arrange : E001 existe, E_GHOST renvoie null → un seul résultat retourné.
            var emp = MakeEmploye("E001");
            _mockEmployeRepository.Setup(r => r.GetByEmpcod(Soc, "E001")).ReturnsAsync(emp);
            _mockEmployeRepository.Setup(r => r.GetByEmpcod(Soc, "E_GHOST")).ReturnsAsync((Employe?)null!);
            _mockHsService
                .Setup(s => s.CalculerHeuresSupplementairesMultiSemaines(Soc, "E001", Mois, Annee, "FRA", "1"))
                .ReturnsAsync(new List<HeuresSupplementairesResultat> { MakeResultat(0d) });

            var result = await _service.GetPointageMois(Soc, new List<string> { "E001", "E_GHOST" }, Mois, Annee, "0");

            result.Should().HaveCount(1);
            result[0].EmpCode.Should().Be("E001");
            // Pas d'appel au service de calcul pour le ghost.
            _mockHsService.Verify(
                s => s.CalculerHeuresSupplementairesMultiSemaines(Soc, "E_GHOST",
                    It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>()),
                Times.Never);
        }

        [Fact]
        public async Task GetPointageMois_AllEmpcodsUnknown_ReturnsEmptyList()
        {
            _mockEmployeRepository.Setup(r => r.GetByEmpcod(It.IsAny<string>(), It.IsAny<string>()))
                                  .ReturnsAsync((Employe?)null!);

            var result = await _service.GetPointageMois(Soc, new List<string> { "X1", "X2" }, Mois, Annee, "0");

            result.Should().BeEmpty();
            _mockHsService.VerifyNoOtherCalls();
        }

        [Fact]
        public async Task GetPointageMois_PassesEmployeRegimeAndNiveauToCalculService()
        {
            // Vérifie que le service propage bien Empreg + Empniv aux dépendances.
            var emp = MakeEmploye("E001", niveau: "2", regime: "TUN");
            _mockEmployeRepository.Setup(r => r.GetByEmpcod(Soc, "E001")).ReturnsAsync(emp);
            _mockHsService
                .Setup(s => s.CalculerHeuresSupplementairesHebdomadaires(Soc, "E001", Mois, Annee, "3", "TUN", "2"))
                .ReturnsAsync(MakeResultat(0d));

            await _service.GetPointageMois(Soc, new List<string> { "E001" }, Mois, Annee, "3");

            _mockHsService.Verify(
                s => s.CalculerHeuresSupplementairesHebdomadaires(Soc, "E001", Mois, Annee, "3", "TUN", "2"),
                Times.Once);
        }

        [Fact]
        public async Task GetPointageMois_MultiSemaines_EmptyResultList_PointageStillReturned()
        {
            // Cas dégénéré : aucune semaine renvoyée par le service de calcul → on retourne quand même
            // l'enveloppe employé avec une liste de résultats vide (utile côté UI pour afficher l'employé).
            var emp = MakeEmploye("E001");
            _mockEmployeRepository.Setup(r => r.GetByEmpcod(Soc, "E001")).ReturnsAsync(emp);
            _mockHsService
                .Setup(s => s.CalculerHeuresSupplementairesMultiSemaines(Soc, "E001", Mois, Annee, "FRA", "1"))
                .ReturnsAsync(new List<HeuresSupplementairesResultat>());

            var result = await _service.GetPointageMois(Soc, new List<string> { "E001" }, Mois, Annee, "0");

            result.Should().HaveCount(1);
            result[0].heuresSupplementairesResultats.Should().BeEmpty();
        }

        [Fact]
        public async Task GetPointageMois_DuplicatedEmpcod_IsCalculatedTwice()
        {
            // Le service n'a pas de déduplication : si le même empcod est listé 2 fois, on appelle 2 fois.
            // Le test documente ce comportement (à modifier si on décide qu'il faut dédoublonner).
            var emp = MakeEmploye("E001");
            _mockEmployeRepository.Setup(r => r.GetByEmpcod(Soc, "E001")).ReturnsAsync(emp);
            _mockHsService
                .Setup(s => s.CalculerHeuresSupplementairesMultiSemaines(Soc, "E001", Mois, Annee, "FRA", "1"))
                .ReturnsAsync(new List<HeuresSupplementairesResultat> { MakeResultat(1d) });

            var result = await _service.GetPointageMois(Soc, new List<string> { "E001", "E001" }, Mois, Annee, "0");

            result.Should().HaveCount(2);
            _mockEmployeRepository.Verify(r => r.GetByEmpcod(Soc, "E001"), Times.Exactly(2));
            _mockHsService.Verify(s => s.CalculerHeuresSupplementairesMultiSemaines(
                Soc, "E001", Mois, Annee, "FRA", "1"), Times.Exactly(2));
        }

        [Fact]
        public async Task GetPointageMois_RepositoryThrows_PropagatesException()
        {
            // En cas d'erreur SQL/repo, l'exception remonte (le service ne capture pas).
            _mockEmployeRepository.Setup(r => r.GetByEmpcod(Soc, "E001"))
                                  .ThrowsAsync(new InvalidOperationException("DB down"));

            var act = async () => await _service.GetPointageMois(Soc, new List<string> { "E001" }, Mois, Annee, "0");

            await act.Should().ThrowAsync<InvalidOperationException>().WithMessage("DB down");
        }

        [Fact]
        public async Task GetPointageMois_CalculServiceThrows_PropagatesException()
        {
            var emp = MakeEmploye("E001");
            _mockEmployeRepository.Setup(r => r.GetByEmpcod(Soc, "E001")).ReturnsAsync(emp);
            _mockHsService
                .Setup(s => s.CalculerHeuresSupplementairesMultiSemaines(Soc, "E001", Mois, Annee, "FRA", "1"))
                .ThrowsAsync(new Exception("calc err"));

            var act = async () => await _service.GetPointageMois(Soc, new List<string> { "E001" }, Mois, Annee, "0");

            await act.Should().ThrowAsync<Exception>().WithMessage("calc err");
        }
    }
}
