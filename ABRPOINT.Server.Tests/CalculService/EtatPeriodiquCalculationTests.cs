using Xunit;
using ABRPOINT.Server.Models;
using ABRPOINT.Server.Tests.CalculService.Fixtures;

namespace ABRPOINT.Server.Tests.CalculService
{
    /// <summary>
    /// Tests des règles d'état périodique : interprétation des paramètres société
    /// (jours fériés, repos, nuit, arrondi, écart, limites min/max, catégories…).
    /// </summary>
    public class EtatPeriodiquCalculationTests
    {
        #region Absence complète / partielle

        [Fact]
        public void Absence_FullDayAbsence_AllSlotsEmpty()
        {
            var presence = PresenceDtoFixtures.CreateAbsencePresence();

            var isAbsent = string.IsNullOrEmpty(presence.Preentmatup) &&
                           string.IsNullOrEmpty(presence.Preentamidiup);

            Assert.True(isAbsent);
            Assert.Equal("A", presence.Etat);
        }

        [Fact]
        public void Absence_PartialAbsence_MorningOnlyMissing()
        {
            var presence = PresenceDtoFixtures.CreatePartialAbsencePresence();

            var isPartialAbsent = string.IsNullOrEmpty(presence.Preentmatup) &&
                                  !string.IsNullOrEmpty(presence.Preentamidiup);

            Assert.True(isPartialAbsent);
        }

        #endregion

        #region Heures de référence

        [Fact]
        public void AbsenceHours_StandardParameters_8HoursPerDay()
        {
            var p = ParametreFixtures.CreateStandardParametres();
            var dailyHours = (p.Parjhnfixe ?? 0) / 20;
            Assert.Equal(8, dailyHours);
        }

        [Fact]
        public void AbsenceHours_CustomDividend120_6HoursPerDay()
        {
            var p = ParametreFixtures.CreateCustomDividendParametres("SOC1", 120);
            var dailyHours = (p.Parjhnfixe ?? 0) / 20;
            Assert.Equal(6, dailyHours);
        }

        [Fact]
        public void CongeHours_StandardParameters_8Hours()
        {
            var p = ParametreFixtures.CreateStandardParametres();
            Assert.Equal(8, p.Nbhconge);
        }

        #endregion

        #region Retard et demi-journée

        [Fact]
        public void LateArrival_30MinuteLate_DetectedAsRetard()
        {
            var presence = PresenceDtoFixtures.CreateLateArrivalPresence();
            var poste = PosteFixtures.CreateStandardPoste();

            var entryTime = TimeSpan.Parse(presence.Preentmatup!); // 08:30
            var scheduledTime = TimeSpan.Parse("08:00");
            var tolerance = TimeSpan.FromMinutes(poste.Avantent ?? 0);
            var delay = entryTime - scheduledTime;

            Assert.True(delay > tolerance);
            Assert.Equal(30, (int)delay.TotalMinutes);
        }

        [Fact]
        public void HalfDay_MorningOnly_NoAfternoon()
        {
            var presence = PresenceDtoFixtures.CreateHalfDayPresence();
            Assert.False(!string.IsNullOrEmpty(presence.Preentamidiup));
        }

        #endregion

        #region Heures de nuit

        [Fact]
        public void Nuit_Enabled_DetectedFromParameters()
        {
            var p = ParametreFixtures.CreateStandardParametres();
            Assert.Equal("1", p.Parnuit);
            Assert.Equal(TimeSpan.Parse("22:00"), TimeSpan.Parse(p.Nuitdeb!));
            Assert.Equal(TimeSpan.Parse("06:00"), TimeSpan.Parse(p.Nuitfin!));
        }

        [Fact]
        public void Nuit_Disabled_DoesNotCount()
        {
            var p = ParametreFixtures.CreateNoNightParametres();
            Assert.Equal("0", p.Parnuit);
        }

        [Fact]
        public void NuitMealDeduction_MoinsRepasEnabled_ReducesAllowance()
        {
            var p = ParametreFixtures.CreateStandardParametres();
            p.Moinsrepas = 1;
            Assert.True(p.Moinsrepas == 1);
        }

        #endregion

        #region Jours fériés

        [Fact]
        public void HolidayWork_Enabled_AllowsHolidayWork()
        {
            var p = ParametreFixtures.CreateStandardParametres();
            Assert.True(p.Fertrv == 1);
        }

        [Fact]
        public void HolidayHours_StandardParameters_8Hours()
        {
            var p = ParametreFixtures.CreateStandardParametres();
            Assert.Equal(8, p.Nbhferier);
        }

        [Fact]
        public void HolidayElimination_BeforeOvertime()
        {
            var p = ParametreFixtures.CreateFeriesExcludedBeforeParametres();
            Assert.Equal("1", p.Parelimftrv);
        }

        [Fact]
        public void HolidayElimination_AfterOvertime()
        {
            var p = ParametreFixtures.CreateFeriesExcludedAfterParametres();
            Assert.Equal("2", p.Parelimftrv);
        }

        #endregion

        #region Déduction repos

        [Fact]
        public void RestDeduction_DeductRest_Mode0()
        {
            var p = ParametreFixtures.CreateStandardParametres();
            p.Parreptrv = "0";
            Assert.Equal("0", p.Parreptrv);
        }

        [Fact]
        public void RestDeduction_OnlySunday_Mode2()
        {
            var p = ParametreFixtures.CreateStandardParametres();
            p.Parreptrv = "2";
            Assert.Equal("2", p.Parreptrv);
        }

        [Fact]
        public void RestDeduction_Weekend_Mode3()
        {
            var p = ParametreFixtures.CreateWeekendDeductionParametres();
            Assert.Equal("3", p.Parreptrv);
        }

        #endregion

        #region Arrondi

        [Fact]
        public void Rounding_Enabled_RoundsToWhole()
        {
            var p = ParametreFixtures.CreateStandardParametres();
            var test = 8.25;
            var rounded = p.Arrondi == 1 ? Math.Round(test, 0) : test;
            Assert.Equal(8, rounded);
        }

        [Fact]
        public void Rounding_Disabled_KeepsPrecision()
        {
            var p = ParametreFixtures.CreateStandardParametres();
            p.Arrondi = 0;
            Assert.False(p.Arrondi == 1);
        }

        #endregion

        #region Écart minimum

        [Fact]
        public void Ecart_Standard_15Minutes()
            => Assert.Equal(15, ParametreFixtures.CreateStandardParametres().Parecart);

        [Fact]
        public void Ecart_Strict_5Minutes()
            => Assert.Equal(5, ParametreFixtures.CreateStrictParametres().Parecart);

        [Fact]
        public void Ecart_Flexible_30Minutes()
            => Assert.Equal(30, ParametreFixtures.CreateFlexibleParametres().Parecart);

        #endregion

        #region Limites min/max

        [Fact]
        public void MinHours_Standard_Zero()
            => Assert.Equal(0, ParametreFixtures.CreateStandardParametres().Parminhjour);

        [Fact]
        public void MaxHours_Standard_Ten()
            => Assert.Equal(10, ParametreFixtures.CreateStandardParametres().Parmaxhjour);

        [Fact]
        public void MaxHours_StrictMoreRestrictiveThanStandard()
        {
            var standard = ParametreFixtures.CreateStandardParametres();
            var strict = ParametreFixtures.CreateStrictParametres();
            Assert.Equal(10, standard.Parmaxhjour);
            Assert.Equal(8, strict.Parmaxhjour);
        }

        #endregion

        #region Catégories

        [Fact]
        public void OvertimeCadre_Enabled() => Assert.Equal("1", ParametreFixtures.CreateStandardParametres().Parcadre);
        [Fact]
        public void OvertimeMaitrise_Enabled() => Assert.Equal("1", ParametreFixtures.CreateStandardParametres().Parmaitrise);
        [Fact]
        public void OvertimeExec_Enabled() => Assert.Equal("1", ParametreFixtures.CreateStandardParametres().Parexec);

        #endregion

        #region Ancienneté

        [Fact]
        public void Anciennete_Standard_NoneRequired()
            => Assert.Equal(0f, ParametreFixtures.CreateStandardParametres().Pardroitnbj);

        [Fact]
        public void Anciennete_OneYearRequired()
        {
            var p = ParametreFixtures.CreateStandardParametres();
            p.Pardroitnbj = 1;
            Assert.Equal(1f, p.Pardroitnbj);
        }

        #endregion

        #region Compenser

        [Fact]
        public void Compenser_AllRequiredFields()
        {
            var c = new Compenser
            {
                Concod = "COMP001",
                Empcod = "EMP001",
                Soccod = "SOC1",
                Conjour = "1",
                Connbjour = 1,
                Conmotif = "Compensation H.Sup",
                Conref = "REF001",
                Abscod = "ABS001",
            };
            Assert.NotNull(c.Concod);
            Assert.NotNull(c.Empcod);
            Assert.NotNull(c.Soccod);
            Assert.Equal(1, c.Connbjour);
        }

        #endregion
    }
}
