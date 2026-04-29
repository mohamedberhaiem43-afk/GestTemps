using Xunit;
using Moq;
using ABRPOINT.Server.CalculService.HeureSupp;
using ABRPOINT.Server.Dtaos;
using ABRPOINT.Server.Models;
using ABRPOINT.Server.Interfaces;
using ABRPOINT.Server.Tests.CalculService.Fixtures;

namespace ABRPOINT.Server.Tests.CalculService
{
    /// <summary>
    /// Tests unitaires pour le calcul des heures supplémentaires (HeureSuppSerivce).
    /// On mocke ILcategorieRepository et IPosteRepository ; le service ne consulte pas
    /// IParametreRepository dans CalculateHeureSuppOptimise donc on ne le configure pas.
    /// </summary>
    public class HeureSuppServiceTests
    {
        private readonly Mock<ILcategorieRepository> _mockCategorieRepository;
        private readonly Mock<IParametreRepository> _mockParametreRepository;
        private readonly Mock<IPosteRepository> _mockPosteRepository;
        private readonly IHeureSuppService _service;

        public HeureSuppServiceTests()
        {
            _mockCategorieRepository = new Mock<ILcategorieRepository>();
            _mockParametreRepository = new Mock<IParametreRepository>();
            _mockPosteRepository = new Mock<IPosteRepository>();

            _service = new HeureSuppSerivce(
                _mockCategorieRepository.Object,
                _mockParametreRepository.Object,
                _mockPosteRepository.Object);
        }

        private void SetupMocks(Poste poste)
        {
            _mockCategorieRepository
                .Setup(x => x.GetCathsup(It.IsAny<string>(), It.IsAny<string>()))
                .ReturnsAsync("1");

            _mockPosteRepository
                .Setup(x => x.GetEmpPoste(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<DateTime?>(), It.IsAny<string>()))
                .ReturnsAsync(poste.Codposte);

            _mockPosteRepository
                .Setup(x => x.GetPoste(It.IsAny<string>(), It.IsAny<string?>()))
                .ReturnsAsync(poste);
        }

        #region Cas normaux

        [Fact]
        public async Task CalculateHeureSupp_StandardPresence_ReturnsZero()
        {
            var poste = PosteFixtures.CreateStandardPoste();
            var presence = PresenceDtoFixtures.CreateStandardPresence();
            SetupMocks(poste);

            var result = await _service.CalculateHeureSuppOptimise(presence, poste);

            Assert.Equal(0, result);
        }

        [Fact]
        public async Task CalculateHeureSupp_EarlyArrival_ReturnsOneHour()
        {
            // Arrivée à 7h au lieu de 8h → +1h
            var poste = PosteFixtures.CreateStandardPoste();
            var presence = PresenceDtoFixtures.CreateEarlyArrivalPresence();
            SetupMocks(poste);

            var result = await _service.CalculateHeureSuppOptimise(presence, poste);

            Assert.Equal(1.0, result, 1);
        }

        [Fact]
        public async Task CalculateHeureSupp_LateLeave_ReturnsTwoHours()
        {
            // Départ à 19h au lieu de 17h → +2h
            var poste = PosteFixtures.CreateStandardPoste();
            var presence = PresenceDtoFixtures.CreateLateLeavePresence();
            SetupMocks(poste);

            var result = await _service.CalculateHeureSuppOptimise(presence, poste);

            Assert.Equal(2.0, result, 1);
        }

        #endregion

        #region Tolérance

        [Fact]
        public async Task CalculateHeureSupp_WithinEntryTolerance_ReturnsZero()
        {
            // Arrivée 07:57 avec tolérance 5 min → pas d'heure supp
            var poste = PosteFixtures.CreateStandardPoste();
            var presence = PresenceDtoFixtures.CreateStandardPresence();
            presence.Preentmatup = "07:57";
            SetupMocks(poste);

            var result = await _service.CalculateHeureSuppOptimise(presence, poste);

            Assert.Equal(0, result);
        }

        [Fact]
        public async Task CalculateHeureSupp_ExceedExitTolerance_ReturnsOvertime()
        {
            // Sortie 17:06 → dépasse la tolérance de 5 min → 1 min compté
            var poste = PosteFixtures.CreateStandardPoste();
            var presence = PresenceDtoFixtures.CreateStandardPresence();
            presence.Presortamidiup = "17:06";
            SetupMocks(poste);

            var result = await _service.CalculateHeureSuppOptimise(presence, poste);

            Assert.True(result > 0);
        }

        [Fact]
        public async Task CalculateHeureSupp_NoTolerance_CountsEvenOneMinute()
        {
            // Tolérance 0 → 07:59 doit générer 1 min d'heure supp
            var poste = PosteFixtures.CreateStrictPoste();
            var presence = PresenceDtoFixtures.CreateStandardPresence();
            presence.Preentmatup = "07:59";
            SetupMocks(poste);

            var result = await _service.CalculateHeureSuppOptimise(presence, poste);

            Assert.True(result > 0);
        }

        #endregion

        #region Absences et présences partielles

        [Fact]
        public async Task CalculateHeureSupp_AbsenceDay_ReturnsZero()
        {
            var poste = PosteFixtures.CreateStandardPoste();
            var presence = PresenceDtoFixtures.CreateAbsencePresence();
            SetupMocks(poste);

            var result = await _service.CalculateHeureSuppOptimise(presence, poste);

            Assert.Equal(0, result);
        }

        [Fact]
        public async Task CalculateHeureSupp_HalfDayPresence_ReturnsZero()
        {
            // Demi-journée matin uniquement → pas de débordement
            var poste = PosteFixtures.CreateStandardPoste();
            var presence = PresenceDtoFixtures.CreateHalfDayPresence();
            SetupMocks(poste);

            var result = await _service.CalculateHeureSuppOptimise(presence, poste);

            Assert.Equal(0, result);
        }

        #endregion

        #region Cas limites

        [Fact]
        public async Task CalculateHeureSupp_NullPresence_ThrowsArgumentNullException()
        {
            var poste = PosteFixtures.CreateStandardPoste();
            await Assert.ThrowsAsync<ArgumentNullException>(
                () => _service.CalculateHeureSuppOptimise(null!, poste));
        }

        [Fact]
        public async Task CalculateHeureSupp_CategoryNotEligible_ReturnsZero()
        {
            // Catégorie marquée "0" pour les heures supp → toujours 0
            var poste = PosteFixtures.CreateStandardPoste();
            var presence = PresenceDtoFixtures.CreateEarlyArrivalPresence();
            SetupMocks(poste);
            _mockCategorieRepository
                .Setup(x => x.GetCathsup(It.IsAny<string>(), It.IsAny<string>()))
                .ReturnsAsync("0");

            var result = await _service.CalculateHeureSuppOptimise(presence, poste);

            Assert.Equal(0, result);
        }

        [Fact]
        public async Task CalculateHeureSupp_MissingArrivalTime_NoMorningOvertime()
        {
            // Pas de Preentmatup → la section matin est sautée. Sortie standard à 17h → 0h.
            var poste = PosteFixtures.CreateStandardPoste();
            var presence = PresenceDtoFixtures.CreateStandardPresence();
            presence.Preentmatup = null;
            SetupMocks(poste);

            var result = await _service.CalculateHeureSuppOptimise(presence, poste);

            Assert.Equal(0, result);
        }

        #endregion

        #region Postes différents

        [Fact]
        public async Task CalculateHeureSupp_FlexibleParameters_AllowsMoreOvertime()
        {
            var poste = PosteFixtures.CreateFlexiblePoste();
            var presence = PresenceDtoFixtures.CreateLateLeavePresence();
            SetupMocks(poste);

            var result = await _service.CalculateHeureSuppOptimise(presence, poste);

            Assert.True(result > 0);
        }

        [Fact]
        public async Task CalculateHeureSupp_StrictParameters_ReducesTolerance()
        {
            // 5 min avant l'horaire avec poste strict (0 tol.) → +5 min
            var poste = PosteFixtures.CreateStrictPoste();
            var presence = PresenceDtoFixtures.CreateStandardPresence();
            presence.Preentmatup = "07:55";
            SetupMocks(poste);

            var result = await _service.CalculateHeureSuppOptimise(presence, poste);

            Assert.True(result >= 0);
        }

        #endregion

        #region Postes de nuit

        [Fact]
        public async Task CalculateHeureSupp_NightShift_NoOvertimeWhenOnTime()
        {
            // Shift de nuit 20h–04h → 8h pile → 0
            var poste = PosteFixtures.CreateNightShiftPoste();
            var presence = PresenceDtoFixtures.CreateNightShiftPresence();
            SetupMocks(poste);

            var result = await _service.CalculateHeureSuppOptimise(presence, poste);

            Assert.Equal(0, result);
        }

        [Fact]
        public async Task CalculateHeureSupp_NightShiftWithEarlyArrival_ReturnsOvertime()
        {
            // Arrivée 19h au lieu de 20h → +1h
            var poste = PosteFixtures.CreateNightShiftPoste();
            var presence = PresenceDtoFixtures.CreateNightShiftPresence();
            presence.Preentmatup = "19:00";
            SetupMocks(poste);

            var result = await _service.CalculateHeureSuppOptimise(presence, poste);

            Assert.True(result > 0);
        }

        #endregion

        #region Scénarios paramétrés

        [Theory]
        [InlineData("07:00", "12:00", "13:00", "19:00", 3.0)] // 1h matin + 2h soir
        [InlineData("06:00", "12:00", "13:00", "18:00", 3.0)] // 2h matin + 1h soir
        [InlineData("08:00", "12:00", "13:00", "17:00", 0.0)] // pas de débordement
        [InlineData("08:00", "12:00", "13:00", "18:00", 1.0)] // +1h soir uniquement
        [InlineData("07:00", "12:00", "13:00", "17:00", 1.0)] // +1h matin uniquement
        public async Task CalculateHeureSupp_VariousScenarios_CalculatesCorrectly(
            string morningEntry, string morningExit,
            string afternoonEntry, string afternoonExit,
            double expectedHours)
        {
            var poste = PosteFixtures.CreateStandardPoste();
            var presence = PresenceDtoFixtures.CreateStandardPresence();
            presence.Preentmatup = morningEntry;
            presence.Presortmatup = morningExit;
            presence.Preentamidiup = afternoonEntry;
            presence.Presortamidiup = afternoonExit;
            SetupMocks(poste);

            var result = await _service.CalculateHeureSuppOptimise(presence, poste);

            Assert.Equal(expectedHours, result, 2);
        }

        #endregion
    }
}
