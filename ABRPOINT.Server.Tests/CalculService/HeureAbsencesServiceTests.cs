using Xunit;
using Moq;
using ABRPOINT.Server.CalculService.HeureAbsences;
using ABRPOINT.Server.Dtaos;
using ABRPOINT.Server.Interfaces;
using ABRPOINT.Server.Models;

namespace ABRPOINT.Server.Tests.CalculService
{
    /// <summary>
    /// Tests unitaires du calcul des heures d'absence (HeureAbsencesService).
    /// La règle métier :
    ///   - Pas de présence (Tothre vide ou NotPresent) → on retourne les heures journalières du poste
    ///     (réduites du crédit d'autorisation NON payée).
    ///   - Présence active avec un congé d'1 jour → 0h d'absence.
    ///   - Présence active avec un congé d'1/2 jour → max(0, demi-jour − heures travaillées − auth non payée).
    ///   - Présence active sans congé : diff = jour − heures travaillées − auth non payée.
    ///       diff > 2 → on retourne diff, sinon 0.
    /// </summary>
    public class HeureAbsencesServiceTests
    {
        private readonly Mock<IPosteRepository> _mockPosteRepository;
        private readonly Mock<ICongeRepository> _mockCongeRepository;
        private readonly HeureAbsencesService _service;

        private const string Soc = "SOC1";
        private const string Emp = "EMP001";
        private const string Pos = "POST001";
        private static readonly DateTime Day = new(2024, 1, 17);

        public HeureAbsencesServiceTests()
        {
            _mockPosteRepository = new Mock<IPosteRepository>();
            _mockCongeRepository = new Mock<ICongeRepository>();
            _service = new HeureAbsencesService(_mockPosteRepository.Object, _mockCongeRepository.Object);
        }

        private void SetupDayHours(float hours)
        {
            _mockPosteRepository
                .Setup(x => x.GetJourHeures(It.IsAny<string>(), It.IsAny<DateTime?>(), It.IsAny<string>()))
                .ReturnsAsync(hours);
        }

        private void SetupConge(Conge? conge)
        {
            _mockCongeRepository
                .Setup(x => x.GetEmpCongeByDateAsync(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<DateTime>()))
                .ReturnsAsync(conge);
        }

        private static Presence WorkingPresence(string tothre = "08:00") => new()
        {
            Empcod = Emp,
            Predat = Day,
            Tothre = tothre,
            Preentmatup = "08:00",
            Presortmatup = "12:00",
            Preentamidiup = "13:00",
            Presortamidiup = "17:00",
        };

        #region Pas de présence → heures journalières

        [Fact]
        public async Task NullPresence_ReturnsFullDayHours()
        {
            SetupDayHours(8f);

            var result = await _service.CalculateHeureAbsences(null!, Soc, Pos, Day, null, null);

            Assert.Equal(8f, result);
        }

        [Fact]
        public async Task TothreEmpty_ReturnsFullDayHours()
        {
            SetupDayHours(8f);
            var presence = new Presence { Tothre = "00:00" };

            var result = await _service.CalculateHeureAbsences(presence, Soc, Pos, Day, null, null);

            Assert.Equal(8f, result);
        }

        [Fact]
        public async Task NotPresentByConvention_ReturnsFullDayHours()
        {
            SetupDayHours(8f);
            // Tothre < 1h ET aucune plage saisie → NotPresent = true
            var presence = new Presence
            {
                Tothre = "00:30",
                Preentmatup = null,
                Presortmatup = null,
                Preentamidiup = null,
                Presortamidiup = null,
            };

            var result = await _service.CalculateHeureAbsences(presence, Soc, Pos, Day, null, null);

            Assert.Equal(8f, result);
        }

        [Fact]
        public async Task NoPresence_WithUnpaidAuthorization_SubtractsAuthHours()
        {
            // 2h d'autorisation NON payée → on retire 2h des heures d'absence dues
            SetupDayHours(8f);
            var aut = new AutDto
            {
                Condep = Day.AddHours(10),
                Conret = Day.AddHours(12),
                Abspayer = "N",
            };

            var result = await _service.CalculateHeureAbsences(null!, Soc, Pos, Day, aut, null);

            Assert.Equal(6f, result);
        }

        [Fact]
        public async Task NoPresence_WithPaidAuthorization_DoesNotSubtractAuthHours()
        {
            // Autorisation PAYÉE → déjà comptée dans Tothre par CalcHreTrav. Ne pas la déduire
            // une seconde fois ici.
            SetupDayHours(8f);
            var aut = new AutDto
            {
                Condep = Day.AddHours(10),
                Conret = Day.AddHours(12),
                Abspayer = "O",
            };

            var result = await _service.CalculateHeureAbsences(null!, Soc, Pos, Day, aut, null);

            Assert.Equal(8f, result);
        }

        #endregion

        #region Présence active + congé

        [Fact]
        public async Task ActivePresence_FullDayConge_ReturnsZero()
        {
            SetupDayHours(8f);
            SetupConge(new Conge { Connbjour = 1f });
            var presence = WorkingPresence();

            var result = await _service.CalculateHeureAbsences(presence, Soc, Pos, Day, null, hretrav: 8f);

            Assert.Equal(0f, result);
        }

        [Fact]
        public async Task ActivePresence_HalfDayConge_ReturnsHalfDayMinusWorked()
        {
            // jour = 8h ; demi-jour = 4h. Si l'employé a travaillé 3h en plus du congé matin
            // → absence = max(0, 4 − 3) = 1h.
            SetupDayHours(8f);
            SetupConge(new Conge { Connbjour = 0.5f });
            var presence = WorkingPresence();

            var result = await _service.CalculateHeureAbsences(presence, Soc, Pos, Day, null, hretrav: 3f);

            Assert.Equal(1f, result);
        }

        [Fact]
        public async Task ActivePresence_HalfDayConge_HoursOverHalf_ReturnsZero()
        {
            // jour=8h, demi=4h. Travaillé 5h → max(0, 4 − 5) = 0
            SetupDayHours(8f);
            SetupConge(new Conge { Connbjour = 0.5f });
            var presence = WorkingPresence();

            var result = await _service.CalculateHeureAbsences(presence, Soc, Pos, Day, null, hretrav: 5f);

            Assert.Equal(0f, result);
        }

        #endregion

        #region Présence active sans congé

        [Fact]
        public async Task ActivePresence_NoConge_DiffMoreThanTwo_ReturnsDiff()
        {
            // jour=8h, travaillé=3h → diff = 5 (> 2) → retourne 5
            SetupDayHours(8f);
            SetupConge(null);
            var presence = WorkingPresence();

            var result = await _service.CalculateHeureAbsences(presence, Soc, Pos, Day, null, hretrav: 3f);

            Assert.Equal(5f, result);
        }

        [Fact]
        public async Task ActivePresence_NoConge_DiffAboveToleranceReturnsDiff()
        {
            // ⚠ Tolérance changée 2h → 15min en 2026-05 (cf. HeureAbsencesService.cs:161-165).
            // Justification métier dans le code : « anciennement 2h, trop laxiste — masquait
            // des absences réelles d'1h à 2h sur des journées partielles ».
            // jour=8h, travaillé=7h → diff=1h ; 1h > 0.25h → retourne 1.
            SetupDayHours(8f);
            SetupConge(null);
            var presence = WorkingPresence();

            var result = await _service.CalculateHeureAbsences(presence, Soc, Pos, Day, null, hretrav: 7f);

            Assert.Equal(1f, result);
        }

        [Fact]
        public async Task ActivePresence_NoConge_DiffBelowToleranceReturnsZero()
        {
            // Avec tolérance 15min : diff=10min (0.166h) ≤ 0.25h → 0.
            SetupDayHours(8f);
            SetupConge(null);
            var presence = WorkingPresence();

            var result = await _service.CalculateHeureAbsences(presence, Soc, Pos, Day, null, hretrav: 7.833f);

            Assert.Equal(0f, result);
        }

        [Fact]
        public async Task ActivePresence_NoConge_NullHretrav_TreatedAsZero()
        {
            // hretrav null → traité comme 0 → diff = 8h → retourne 8
            SetupDayHours(8f);
            SetupConge(null);
            var presence = WorkingPresence();

            var result = await _service.CalculateHeureAbsences(presence, Soc, Pos, Day, null, hretrav: null);

            Assert.Equal(8f, result);
        }

        [Fact]
        public async Task ActivePresence_NoConge_WithUnpaidAuth_SubtractsAuth()
        {
            // ⚠ Comportement actualisé : nouvelle tolérance 15min, diff=8−4−2=2h > 0.25h → 2.
            // L'ancienne assertion (=0) datait de la tolérance 2h supprimée en 2026-05.
            // Note : ce test peut entrer dans la branche "détection shift manqué" (ligne 67+)
            //        si hreTravValue < maxhrejour-0.01 et que les plages poste sont remplies.
            //        Comme on n'a pas configuré GetPoste(), elle ne se déclenche pas → on
            //        retombe sur le cas général diff brute, soit 2h.
            SetupDayHours(8f);
            SetupConge(null);
            var aut = new AutDto
            {
                Condep = Day.AddHours(10),
                Conret = Day.AddHours(12),
                Abspayer = "N",
            };
            var presence = WorkingPresence();

            var result = await _service.CalculateHeureAbsences(presence, Soc, Pos, Day, aut, hretrav: 4f);

            Assert.Equal(2f, result);
        }

        [Fact]
        public async Task ActivePresence_NoConge_WithPaidAuth_DoesNotSubtractAuth()
        {
            // jour=8h, travaillé=4h (déjà inclut l'auth payée), auth payée 2h → on NE soustrait PAS
            // l'auth → diff = 8 − 4 = 4 → retourne 4
            SetupDayHours(8f);
            SetupConge(null);
            var aut = new AutDto
            {
                Condep = Day.AddHours(10),
                Conret = Day.AddHours(12),
                Abspayer = "O",
            };
            var presence = WorkingPresence();

            var result = await _service.CalculateHeureAbsences(presence, Soc, Pos, Day, aut, hretrav: 4f);

            Assert.Equal(4f, result);
        }

        #endregion
    }
}
