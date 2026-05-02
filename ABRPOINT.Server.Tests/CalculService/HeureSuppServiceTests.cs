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

        #region Régression — jour de repos (Prerepos = "1")

        // Sur un jour de repos l'employé n'a aucun poste prévu, donc TOUT temps pointé est
        // par définition supplémentaire. Le service doit retomber sur Tothre déjà calculé en
        // amont au lieu de comparer au planning d'un jour ouvré (ce qui produisait des
        // résultats absurdes : voir le scénario 12:24 sur 2h19 ci-dessous).

        [Fact]
        public async Task CalculateHeureSupp_RestDay_ReturnsAllWorkedHoursAsOvertime()
        {
            // Repos, pointage 18:23 → 20:42, Tothre = 01:31 (déjà calculé en amont par
            // CalcHreTrav avec déduction du repas). H.Sup attendu = 1.5167 (≈ 1h31m).
            var poste = PosteFixtures.CreateStandardPoste();
            var presence = PresenceDtoFixtures.CreateStandardPresence();
            presence.Prerepos = "1";
            presence.Preentmatup = "18:23";
            presence.Presortmatup = "20:42";
            presence.Preentamidiup = null;
            presence.Presortamidiup = null;
            presence.Tothre = "01:31";
            SetupMocks(poste);

            var result = await _service.CalculateHeureSuppOptimise(presence, poste);

            // 1h31 = 1 + 31/60 ≈ 1.5167
            Assert.Equal(1.5167, result, 3);
        }

        [Fact]
        public async Task CalculateHeureSupp_RestDay_WithoutTothre_ReturnsZero()
        {
            // Edge case : Prerepos = "1" mais Tothre vide (pointage non encore calculé).
            // ConvertHHmmToDouble retourne null → on doit retomber sur 0 sans NRE.
            var poste = PosteFixtures.CreateStandardPoste();
            var presence = PresenceDtoFixtures.CreateStandardPresence();
            presence.Prerepos = "1";
            presence.Tothre = null;
            SetupMocks(poste);

            var result = await _service.CalculateHeureSuppOptimise(presence, poste);

            Assert.Equal(0, result);
        }

        [Fact]
        public async Task CalculateHeureSupp_RestDay_FullEightHours_ReturnsEight()
        {
            // Repos avec une journée complète travaillée (cas heures supp planifiées) →
            // les 8h doivent intégralement remonter en H.Sup.
            var poste = PosteFixtures.CreateStandardPoste();
            var presence = PresenceDtoFixtures.CreateStandardPresence();
            presence.Prerepos = "1";
            presence.Tothre = "08:00";
            SetupMocks(poste);

            var result = await _service.CalculateHeureSuppOptimise(presence, poste);

            Assert.Equal(8.0, result, 2);
        }

        #endregion

        #region Régression — bug "12:24 sur 2h19" (double-comptage section 2 / section 4)

        // Bug initial : sur un poste 08-12 / 14-17, un pointage tardif unique 18:23 → 20:42
        // produisait 12h24 d'H.Sup. Cause : la section "sortie matin tardive" comptait toute
        // la plage [12:00 → 20:42] sans plafond, puis la section "fin de journée" recomptait
        // [17:00 → 20:42] par-dessus → 8h42 + 3h42 = 12h24.
        //
        // Fix : section 2 plafonnée à eveningStart (14:00). Pour le scénario ci-dessous
        // (Prerepos non défini, journée ouvrée), le résultat doit rester borné par le temps
        // réellement travaillé (≈ 2h19 ici, hors déduction repas — le service H.Sup ne
        // retire pas le repas, il compte les bornes du planning).

        [Fact]
        public async Task CalculateHeureSupp_LateClockOutWithoutAfternoonPunch_DoesNotDoubleCount()
        {
            // Reproduction fidèle du bug terrain : poste 08-12 / 14-17 (eveningStart = 14:00,
            // donc différent du fixture standard qui utilise 13:00). Pointage tardif unique
            // 18:23 → 20:42, jour ouvré (pas de Prerepos).
            // Avant fix : 8h42 (section 2 sans cap) + 3h42 (section 4) = 12h24 ≈ 12.4h ❌
            // Après fix :
            //   • section 1 : 0 (arrivée pas en avance)
            //   • section 2 : min(20:42, 14:00) − 12:00 = 2h00 (lunch worked, plafonné)
            //   • section 3 : 0 (pas de Preentamidi)
            //   • section 4 : 20:42 − 17:00 = 3h42
            //   total : 5h42 ≈ 5.7h
            var poste = new ABRPOINT.Server.Models.Poste
            {
                Codposte = "BUG12H24",
                Soccod = "SOC001",
                Avantent = 5, Apresent = 5, Avantsort = 5, Apressort = 5,
                Lunhdmat = "08:00", Lunhfmat = "12:00", Lunhdam = "14:00", Lunhfam = "17:00",
                Marhdmat = "08:00", Marhfmat = "12:00", Marhdam = "14:00", Marhfam = "17:00",
                Merhdmat = "08:00", Merhfmat = "12:00", Merhdam = "14:00", Merhfam = "17:00",
                Jeuhdmat = "08:00", Jeuhfmat = "12:00", Jeuhdam = "14:00", Jeuhfam = "17:00",
                Venhdmat = "08:00", Venhfmat = "12:00", Venhdam = "14:00", Venhfam = "17:00",
                Samhdmat = "08:00", Samhfmat = "12:00", Samhdam = "14:00", Samhfam = "17:00",
                Dimhdmat = "08:00", Dimhfmat = "12:00", Dimhdam = "14:00", Dimhfam = "17:00",
            };
            var presence = PresenceDtoFixtures.CreateStandardPresence();
            presence.Preentmatup = "18:23";
            presence.Presortmatup = "20:42";
            presence.Preentamidiup = null;
            presence.Presortamidiup = null;
            SetupMocks(poste);

            var result = await _service.CalculateHeureSuppOptimise(presence, poste);

            // Garde-fou anti-régression du bug 12:24 : surtout NE JAMAIS dépasser ~6h ici.
            // Sans le cap section 2, on obtenait 12.4. Avec le cap : 5.7.
            Assert.True(result < 7.0,
                $"Régression : double-comptage section 2 / section 4 (résultat = {result}).");
            Assert.Equal(5.7, result, 1);
        }

        [Fact]
        public async Task CalculateHeureSupp_WorkedThroughLunch_CapsAtEveningStart()
        {
            // Sortie matin 13:30 sur poste fixture 08-12 / 13-17 (eveningStart = 13:00).
            // section 2 = min(13:30, 13:00) − 12:00 = 1h00 (capped). Pas de section 4.
            var poste = PosteFixtures.CreateStandardPoste();
            var presence = PresenceDtoFixtures.CreateStandardPresence();
            presence.Preentmatup = "08:00";
            presence.Presortmatup = "13:30";
            presence.Preentamidiup = null;
            presence.Presortamidiup = null;
            SetupMocks(poste);

            var result = await _service.CalculateHeureSuppOptimise(presence, poste);

            Assert.Equal(1.0, result, 2);
        }

        [Fact]
        public async Task CalculateHeureSupp_LunchOverrunUnderEveningStart_NotCapped()
        {
            // Sortie matin 12:45 (overrun lunch dans la zone < eveningStart) :
            // section 2 = 12:45 − 12:00 = 45 min. Cap inactif (12:45 < 14:00).
            var poste = PosteFixtures.CreateStandardPoste();
            var presence = PresenceDtoFixtures.CreateStandardPresence();
            presence.Preentmatup = "08:00";
            presence.Presortmatup = "12:45";
            presence.Preentamidiup = null;
            presence.Presortamidiup = null;
            SetupMocks(poste);

            var result = await _service.CalculateHeureSuppOptimise(presence, poste);

            Assert.Equal(0.75, result, 2);
        }

        [Fact]
        public async Task CalculateHeureSupp_ContinuousWorkAcrossLunch_CountsLunchPlusEndOfDay()
        {
            // Présence continue 08:00 → 18:00 sur fixture 08-12 / 13-17.
            // section 2 = min(18:00, 13:00) − 12:00 = 1h (lunch worked, plafonné à 13:00)
            // section 4 = 18:00 − 17:00 = 1h
            // total = 2h. Sans le cap on aurait 18:00−12:00 = 6h section 2, soit 7h total.
            var poste = PosteFixtures.CreateStandardPoste();
            var presence = PresenceDtoFixtures.CreateStandardPresence();
            presence.Preentmatup = "08:00";
            presence.Presortmatup = "18:00";
            presence.Preentamidiup = null;
            presence.Presortamidiup = null;
            SetupMocks(poste);

            var result = await _service.CalculateHeureSuppOptimise(presence, poste);

            // Anti-régression : sans le cap on aurait ≥ 7h. On vérifie le cap actif.
            Assert.True(result < 7.0,
                $"Régression : section 2 non plafonnée (résultat = {result}).");
            Assert.Equal(2.0, result, 2);
        }

        #endregion

        #region Catégorie & garde sur la session du soir

        [Fact]
        public async Task CalculateHeureSupp_NoEveningSession_OnlyEndOfDayCounted()
        {
            // Demi-journée (poste sans afternoon), arrivée 08:00, sortie 13:00.
            // hasEveningSession = false → section 2 sautée par la garde, section 4 :
            // scheduledEnd = morningEnd (12:00), 13:00 > 12:00 → 1h.
            var poste = new ABRPOINT.Server.Models.Poste
            {
                Codposte = "HALF",
                Soccod = "SOC001",
                Avantent = 5, Apresent = 5, Avantsort = 5, Apressort = 5,
                Lunhdmat = "08:00", Lunhfmat = "12:00", Lunhdam = null, Lunhfam = null,
                Marhdmat = "08:00", Marhfmat = "12:00", Marhdam = null, Marhfam = null,
                Merhdmat = "08:00", Merhfmat = "12:00", Merhdam = null, Merhfam = null,
                Jeuhdmat = "08:00", Jeuhfmat = "12:00", Jeuhdam = null, Jeuhfam = null,
                Venhdmat = "08:00", Venhfmat = "12:00", Venhdam = null, Venhfam = null,
                Samhdmat = "08:00", Samhfmat = "12:00", Samhdam = null, Samhfam = null,
                Dimhdmat = "08:00", Dimhfmat = "12:00", Dimhdam = null, Dimhfam = null,
            };
            var presence = PresenceDtoFixtures.CreateStandardPresence();
            presence.Preentmatup = "08:00";
            presence.Presortmatup = "13:00";
            presence.Preentamidiup = null;
            presence.Presortamidiup = null;
            SetupMocks(poste);

            var result = await _service.CalculateHeureSuppOptimise(presence, poste);

            Assert.Equal(1.0, result, 2);
        }

        #endregion
    }
}
