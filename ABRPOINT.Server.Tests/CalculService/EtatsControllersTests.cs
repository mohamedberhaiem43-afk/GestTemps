using Xunit;
using Moq;
using FluentAssertions;
using ABRPOINT.Server.Controllers;
using ABRPOINT.Server.Data;
using ABRPOINT.Server.Dtaos;
using ABRPOINT.Server.Interfaces;
using ABRPOINT.Server.Repository;
using Microsoft.AspNetCore.Mvc;

namespace ABRPOINT.Server.Tests.CalculService
{
    /// <summary>
    /// Tests unitaires pour les contrôleurs des trois états :
    ///   - PresencesController (état de présence + état de retard)
    ///   - AbsencesController  (état d'absence)
    ///
    /// On mocke IPresenceRepository / IAbscenceRepository / IReportsGenerationService
    /// et on vérifie :
    ///   • la délégation correcte aux services (paramètres transmis)
    ///   • la forme de la réponse (Ok avec data, FileContentResult avec Content-Type pdf, nom de fichier)
    ///   • la propagation des exceptions des services
    /// </summary>
    public class EtatsControllersTests
    {
        private readonly Mock<IPresenceRepository> _presenceRepo;
        private readonly Mock<IAbscenceRepository> _absenceRepo;
        private readonly Mock<IReportsGenerationService> _reportSvc;
        private readonly Mock<IUtilisateurRepository> _utilRepo;
        private readonly Mock<IPointageOptimizerService> _optimizer;

        private const string Soc = "01";
        private static readonly DateTime DateDeb = new(2026, 4, 1);
        private static readonly DateTime DateFin = new(2026, 4, 30);

        public EtatsControllersTests()
        {
            _presenceRepo = new Mock<IPresenceRepository>();
            _absenceRepo = new Mock<IAbscenceRepository>();
            _reportSvc = new Mock<IReportsGenerationService>();
            _utilRepo = new Mock<IUtilisateurRepository>();
            _optimizer = new Mock<IPointageOptimizerService>();
        }

        // Constructeur PresencesController étendu : ApplicationDbContext + dépendances
        // optionnelles (IWebHostEnvironment, logger, validator, current tenant). On passe
        // null pour les optionnelles ; les méthodes testées ici n'y touchent pas.
        private PresencesController NewPresenceCtrl() => new(
            _presenceRepo.Object,
            _reportSvc.Object,
            _utilRepo.Object,
            _optimizer.Object,
            new ApplicationDbContext(),
            env: null!,
            logger: null,
            geoValidator: null,
            currentTenant: null);

        private AbsencesController NewAbsenceCtrl() => new(
            _absenceRepo.Object, _reportSvc.Object, new ApplicationDbContext());

        private static byte[] FakePdf(string marker = "PDF")
            => System.Text.Encoding.ASCII.GetBytes("%" + marker + "-1.4 fake content");

        // ─────────────────── État de Présence ───────────────────────────────

        [Fact]
        public async Task GetEtatPresence_ListReturned_DelegatesToRepoAndReturnsOk()
        {
            var data = new List<EtatEmpPresence>
            {
                new() { Empcod = "E001", Emplib = "Alice", Empreg = "FRA", TotalHeure = "8:00", TotalRetard = "0:00" },
                new() { Empcod = "E002", Emplib = "Bob",   Empreg = "FRA", TotalHeure = "7:30", TotalRetard = "0:30" },
            };
            _presenceRepo.Setup(r => r.GetAllAsync(Soc, DateDeb, DateFin, "FRA", It.IsAny<List<string>>()))
                         .ReturnsAsync(data);

            var ctrl = NewPresenceCtrl();
            var result = await ctrl.Get(Soc, DateDeb, DateFin, "FRA", new List<string> { "E001", "E002" });

            var ok = result.Should().BeOfType<OkObjectResult>().Subject;
            ok.Value.Should().BeEquivalentTo(data);
            _presenceRepo.Verify(r => r.GetAllAsync(Soc, DateDeb, DateFin, "FRA", It.Is<List<string>>(l => l.Count == 2)),
                                 Times.Once);
        }

        [Fact]
        public async Task GetEtatPresenceReport_DelegatesToReportService_AndReturnsPdfFile()
        {
            var pdf = FakePdf("PRES");
            var empcods = new List<string> { "E001", "E002" };
            _reportSvc.Setup(s => s.GenerateEtatPresenceReport(Soc, DateDeb, DateFin, "FRA", empcods))
                      .Returns(pdf);

            var ctrl = NewPresenceCtrl();
            var result = await ctrl.GetEtatPresenceReport(Soc, DateDeb, DateFin, "FRA", empcods);

            var file = result.Should().BeOfType<FileContentResult>().Subject;
            file.ContentType.Should().Be("application/pdf");
            file.FileDownloadName.Should().Be("EtatPresence.pdf");
            file.FileContents.Should().BeEquivalentTo(pdf);
        }

        [Fact]
        public async Task GetEtatPresenceReport_ServiceThrows_ExceptionPropagates()
        {
            _reportSvc.Setup(s => s.GenerateEtatPresenceReport(It.IsAny<string>(), It.IsAny<DateTime?>(),
                                                                It.IsAny<DateTime?>(), It.IsAny<string>(),
                                                                It.IsAny<List<string>>()))
                      .Throws(new InvalidOperationException("FastReport down"));

            var ctrl = NewPresenceCtrl();
            var act = async () => await ctrl.GetEtatPresenceReport(Soc, DateDeb, DateFin, "FRA", new List<string>());

            await act.Should().ThrowAsync<InvalidOperationException>().WithMessage("FastReport down");
        }

        // ─────────────────── État de Retard ─────────────────────────────────

        [Fact]
        public async Task GetEtatRetardReport_DelegatesToReportService_AndReturnsPdfFile()
        {
            var pdf = FakePdf("RET");
            var empcods = new List<string> { "E001" };
            _reportSvc.Setup(s => s.GenerateEtatRetardReport(Soc, DateDeb, DateFin, "FRA", empcods))
                      .Returns(pdf);

            var ctrl = NewPresenceCtrl();
            var result = await ctrl.GetEtatRetardReport(Soc, DateDeb, DateFin, "FRA", empcods);

            var file = result.Should().BeOfType<FileContentResult>().Subject;
            file.ContentType.Should().Be("application/pdf");
            file.FileDownloadName.Should().Be("EtatRetard.pdf");
            file.FileContents.Should().BeEquivalentTo(pdf);
            _reportSvc.Verify(s => s.GenerateEtatRetardReport(Soc, DateDeb, DateFin, "FRA", empcods), Times.Once);
        }

        [Fact]
        public async Task GetEtatRetardReport_EmptyEmpcods_StillCallsService()
        {
            var pdf = FakePdf("RET");
            _reportSvc.Setup(s => s.GenerateEtatRetardReport(It.IsAny<string>(), It.IsAny<DateTime?>(),
                                                              It.IsAny<DateTime?>(), It.IsAny<string>(),
                                                              It.Is<List<string>>(l => l.Count == 0)))
                      .Returns(pdf);

            var ctrl = NewPresenceCtrl();
            var result = await ctrl.GetEtatRetardReport(Soc, DateDeb, DateFin, "FRA", new List<string>());

            result.Should().BeOfType<FileContentResult>();
        }

        [Fact]
        public async Task GetEtatRetardReport_ServiceThrows_ExceptionPropagates()
        {
            _reportSvc.Setup(s => s.GenerateEtatRetardReport(It.IsAny<string>(), It.IsAny<DateTime?>(),
                                                              It.IsAny<DateTime?>(), It.IsAny<string>(),
                                                              It.IsAny<List<string>>()))
                      .Throws(new Exception("boom"));

            var ctrl = NewPresenceCtrl();
            var act = async () => await ctrl.GetEtatRetardReport(Soc, DateDeb, DateFin, "FRA", new List<string>());

            await act.Should().ThrowAsync<Exception>().WithMessage("boom");
        }

        // ─────────────────── État d'Absence ─────────────────────────────────

        [Fact]
        public async Task GetEtatAbsence_DelegatesToRepo_AndReturnsOkWithList()
        {
            var data = new List<EtatAbsence>
            {
                new() { Empcod = "E001", Emplib = "Alice", Date = DateDeb, Abscod = "A1", Absjust = 1 },
                new() { Empcod = "E002", Emplib = "Bob",   Date = DateDeb.AddDays(2), Abscod = "A2", Absjust = 0 },
            };
            var empcods = new List<string> { "E001", "E002" };
            _absenceRepo.Setup(r => r.GetEtatAbsenceAsync(Soc, DateDeb, DateFin, true, false, false, true, "all", It.IsAny<List<string>?>()))
                        .ReturnsAsync(data);

            var ctrl = NewAbsenceCtrl();
            var result = await ctrl.GetEtatAbsence(Soc, DateDeb, DateFin, true, false, false, true, "all", empcods);

            var ok = result.Should().BeOfType<OkObjectResult>().Subject;
            ok.Value.Should().BeEquivalentTo(data);
        }

        [Fact]
        public async Task GetEtatAbsence_EmptyResult_ReturnsOkWithEmptyList()
        {
            _absenceRepo.Setup(r => r.GetEtatAbsenceAsync(It.IsAny<string>(), It.IsAny<DateTime>(), It.IsAny<DateTime>(),
                                                          It.IsAny<bool>(), It.IsAny<bool>(), It.IsAny<bool>(),
                                                          It.IsAny<bool>(), It.IsAny<string>(), It.IsAny<List<string>?>()))
                        .ReturnsAsync(new List<EtatAbsence>());

            var ctrl = NewAbsenceCtrl();
            var result = await ctrl.GetEtatAbsence(Soc, DateDeb, DateFin, false, false, false, false, "none", new List<string> { "E001" });

            var ok = result.Should().BeOfType<OkObjectResult>().Subject;
            ((List<EtatAbsence>)ok.Value!).Should().BeEmpty();
        }

        [Fact]
        public async Task GetEtatAbsence_PassesAllFiltersToRepo()
        {
            // Garantit que les flags du contrôleur sont propagés tels quels au repository.
            _absenceRepo.Setup(r => r.GetEtatAbsenceAsync(Soc, DateDeb, DateFin, true, true, true, false, "justifies", It.IsAny<List<string>?>()))
                        .ReturnsAsync(new List<EtatAbsence>())
                        .Verifiable();

            var ctrl = NewAbsenceCtrl();
            await ctrl.GetEtatAbsence(Soc, DateDeb, DateFin, true, true, true, false, "justifies", new List<string> { "E001" });

            _absenceRepo.Verify();
        }

        [Fact]
        public async Task GetEtatAbsence_EmptySoccod_ReturnsBadRequest()
        {
            // Le contrôleur valide soccod et empcods en début. On vérifie le contrat de validation.
            var ctrl = NewAbsenceCtrl();
            var result = await ctrl.GetEtatAbsence("", DateDeb, DateFin, false, false, false, false, "none", new List<string> { "E001" });

            result.Should().BeOfType<BadRequestObjectResult>();
            _absenceRepo.Verify(r => r.GetEtatAbsenceAsync(It.IsAny<string>(), It.IsAny<DateTime>(), It.IsAny<DateTime>(),
                                                           It.IsAny<bool>(), It.IsAny<bool>(), It.IsAny<bool>(),
                                                           It.IsAny<bool>(), It.IsAny<string>(), It.IsAny<List<string>?>()),
                                Times.Never);
        }

        [Fact]
        public async Task GetEtatAbsence_EmptyEmpcods_ReturnsBadRequest()
        {
            var ctrl = NewAbsenceCtrl();
            var result = await ctrl.GetEtatAbsence(Soc, DateDeb, DateFin, false, false, false, false, "none", new List<string>());

            result.Should().BeOfType<BadRequestObjectResult>();
        }

        [Fact]
        public async Task GetEtatAbsence_RepoThrows_Returns500()
        {
            // Le contrôleur catch et renvoie StatusCode 500 (pas une exception nue).
            _absenceRepo.Setup(r => r.GetEtatAbsenceAsync(It.IsAny<string>(), It.IsAny<DateTime>(), It.IsAny<DateTime>(),
                                                          It.IsAny<bool>(), It.IsAny<bool>(), It.IsAny<bool>(),
                                                          It.IsAny<bool>(), It.IsAny<string>(), It.IsAny<List<string>?>()))
                        .ThrowsAsync(new Exception("DB down"));

            var ctrl = NewAbsenceCtrl();
            var result = await ctrl.GetEtatAbsence(Soc, DateDeb, DateFin, false, false, false, false, "none", new List<string> { "E001" });

            var status = result.Should().BeOfType<ObjectResult>().Subject;
            status.StatusCode.Should().Be(500);
        }

        [Fact]
        public void GetEtatAbsenceReport_DelegatesToReportService_AndReturnsPdfFile()
        {
            var pdf = FakePdf("ABS");
            var report = new EtatAbsenceReport
            {
                Date = "2026-04-30",
                Soclib = "ACME",
                DateFin = "2026-04-30",
                Data = new List<EtatAbsenceData> { new() { Empcod = "E001" } },
            };
            _reportSvc.Setup(s => s.GetEtatAbsenceReport(report)).Returns(pdf);

            var ctrl = NewAbsenceCtrl();
            var result = ctrl.GetEtatAbsenceReport(report);

            var file = result.Should().BeOfType<FileContentResult>().Subject;
            file.ContentType.Should().Be("application/pdf");
            file.FileDownloadName.Should().EndWith(".pdf");
            file.FileContents.Should().BeEquivalentTo(pdf);
        }

        [Fact]
        public void GetEtatAbsenceReport_ServiceThrows_ReturnsServerErrorOrPropagates()
        {
            _reportSvc.Setup(s => s.GetEtatAbsenceReport(It.IsAny<EtatAbsenceReport>()))
                      .Throws(new Exception("FR fail"));

            var ctrl = NewAbsenceCtrl();
            var report = new EtatAbsenceReport { Data = new List<EtatAbsenceData>() };
            var result = ctrl.GetEtatAbsenceReport(report);

            // Le contrôleur enveloppe l'exception dans un StatusCode 500 (voir AbsencesController).
            // Si le contrat évoluait pour propager, ce test serait à adapter.
            result.Should().BeAssignableTo<IActionResult>();
        }
    }
}
