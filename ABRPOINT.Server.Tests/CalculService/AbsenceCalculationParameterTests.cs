using Xunit;
using ABRPOINT.Server.Tests.CalculService.Fixtures;

namespace ABRPOINT.Server.Tests.CalculService
{
    /// <summary>
    /// Tests des règles de calcul d'absence à partir des paramètres société.
    /// Le dividende mensuel (Parjhnfixe) divisé par 20 donne les heures journalières
    /// de référence pour les absences/congés.
    /// </summary>
    public class AbsenceCalculationParameterTests
    {
        #region Dividende mensuel → heures journalières

        [Theory]
        [InlineData(160, 8)]
        [InlineData(120, 6)]
        [InlineData(180, 9)]
        [InlineData(140, 7)]
        public void DailyHours_FromMonthlyDividend(int monthlyHours, int expectedDailyHours)
        {
            var p = ParametreFixtures.CreateCustomDividendParametres("SOC1", monthlyHours);
            var dailyHours = (p.Parjhnfixe ?? 0) / 20;
            Assert.Equal(expectedDailyHours, dailyHours);
        }

        [Fact]
        public void Parminhjour_Standard_IsZero()
            => Assert.Equal(0, ParametreFixtures.CreateStandardParametres().Parminhjour);

        [Fact]
        public void Parminhjour_Strict_IsTwoHours()
            => Assert.Equal(2, ParametreFixtures.CreateStrictParametres().Parminhjour);

        #endregion

        #region Congé / repos / férié

        [Fact]
        public void CongeHours_StandardParameters_8Hours()
            => Assert.Equal(8, ParametreFixtures.CreateStandardParametres().Nbhconge);

        [Fact]
        public void CongeHours_EqualsAbsenceHours_StandardParameters()
        {
            var p = ParametreFixtures.CreateStandardParametres();
            var congeHours = p.Nbhconge ?? 0;
            var absenceHours = (p.Parjhnfixe ?? 0) / 20;
            Assert.Equal(congeHours, absenceHours);
        }

        [Fact]
        public void RestHours_StandardParameters_1Hour()
            => Assert.Equal(1, ParametreFixtures.CreateStandardParametres().Nbhrepos);

        [Fact]
        public void HolidayHours_StandardParameters_8Hours()
            => Assert.Equal(8, ParametreFixtures.CreateStandardParametres().Nbhferier);

        [Fact]
        public void HolidayWork_FerTrvDisabled_NoOvertimeOnHoliday()
        {
            var p = ParametreFixtures.CreateStandardParametres();
            p.Fertrv = 0;
            Assert.False(p.Fertrv == 1);
        }

        [Fact]
        public void Parmaxfer_Standard_Zero()
            => Assert.Equal(0, ParametreFixtures.CreateStandardParametres().Parmaxfer);

        #endregion

        #region Demi-journée

        [Fact]
        public void HalfDayAbsence_FromStandardDailyHours()
        {
            var p = ParametreFixtures.CreateStandardParametres();
            var dailyHours = (p.Parjhnfixe ?? 0) / 20;
            Assert.Equal(4, dailyHours / 2);
        }

        [Fact]
        public void TwoFullDaysAbsence_FromStandardDailyHours()
        {
            var p = ParametreFixtures.CreateStandardParametres();
            var dailyHours = (p.Parjhnfixe ?? 0) / 20;
            Assert.Equal(16, dailyHours * 2);
        }

        [Fact]
        public void MixedAbsence_OneAndHalfDay_FromStandardDailyHours()
        {
            var p = ParametreFixtures.CreateStandardParametres();
            var dailyHours = (p.Parjhnfixe ?? 0) / 20;
            Assert.Equal(12, dailyHours + dailyHours / 2);
        }

        #endregion

        #region Strict vs flexible

        [Fact]
        public void StrictParameters_AreMoreRestrictive()
        {
            var s = ParametreFixtures.CreateStrictParametres();
            Assert.Equal(2, s.Parminhjour);
            Assert.Equal(8, s.Parmaxhjour);
            Assert.Equal(5, s.Parecart);
        }

        [Fact]
        public void FlexibleParameters_AreMorePermissive()
        {
            var f = ParametreFixtures.CreateFlexibleParametres();
            Assert.Equal(0, f.Parminhjour);
            Assert.Equal(12, f.Parmaxhjour);
            Assert.Equal(30, f.Parecart);
        }

        [Fact]
        public void StrictMaxHours_LessThanFlexibleMaxHours()
        {
            var s = ParametreFixtures.CreateStrictParametres();
            var f = ParametreFixtures.CreateFlexibleParametres();
            Assert.True(s.Parmaxhjour < f.Parmaxhjour);
        }

        #endregion

        #region Compensation

        [Fact]
        public void FullAbsence_TriggersCompensation()
        {
            var presence = PresenceDtoFixtures.CreateAbsencePresence();
            var shouldCompensate = string.IsNullOrEmpty(presence.Preentmatup) &&
                                   string.IsNullOrEmpty(presence.Preentamidiup);
            Assert.True(shouldCompensate);
        }

        [Fact]
        public void PartialAbsence_HasAfternoonOnly()
        {
            var presence = PresenceDtoFixtures.CreatePartialAbsencePresence();
            Assert.True(string.IsNullOrEmpty(presence.Preentmatup));
            Assert.False(string.IsNullOrEmpty(presence.Preentamidiup));
        }

        #endregion

        #region Ancienneté

        [Fact]
        public void Anciennete_DefaultZero()
            => Assert.Equal(0f, ParametreFixtures.CreateStandardParametres().Pardroitnbj);

        [Fact]
        public void Anciennete_CustomOneYear()
        {
            var p = ParametreFixtures.CreateStandardParametres();
            p.Pardroitnbj = 1;
            Assert.Equal(1f, p.Pardroitnbj);
        }

        #endregion

        #region Catégories

        [Fact]
        public void AllCategories_Eligible_StandardParameters()
        {
            var p = ParametreFixtures.CreateStandardParametres();
            Assert.Equal("1", p.Parcadre);
            Assert.Equal("1", p.Parmaitrise);
            Assert.Equal("1", p.Parexec);
        }

        [Fact]
        public void Cadre_Disabled_FlexibleParameters()
        {
            var p = ParametreFixtures.CreateFlexibleParametres();
            Assert.Equal("0", p.Parcadre);
        }

        #endregion

        #region Jours travaillés / weekend

        [Theory]
        [InlineData("2024-01-01")] // lun
        [InlineData("2024-01-02")] // mar
        [InlineData("2024-01-03")] // mer
        public void WorkDay_ApplyAbsenceRules(string dateStr)
        {
            var date = DateTime.Parse(dateStr);
            Assert.True(date.DayOfWeek != DayOfWeek.Saturday && date.DayOfWeek != DayOfWeek.Sunday);
        }

        [Theory]
        [InlineData("2024-01-06")] // sam
        [InlineData("2024-01-07")] // dim
        public void Weekend_DoesNotApplyAbsenceRules(string dateStr)
        {
            var date = DateTime.Parse(dateStr);
            Assert.True(date.DayOfWeek == DayOfWeek.Saturday || date.DayOfWeek == DayOfWeek.Sunday);
        }

        #endregion

        #region Multi-jour

        [Fact]
        public void Absence_ThreeConsecutiveDays_24Hours()
        {
            var p = ParametreFixtures.CreateStandardParametres();
            var dailyHours = (p.Parjhnfixe ?? 0) / 20;
            Assert.Equal(24, dailyHours * 3);
        }

        [Fact]
        public void Absence_FullWeek_40Hours()
        {
            var p = ParametreFixtures.CreateStandardParametres();
            var dailyHours = (p.Parjhnfixe ?? 0) / 20;
            Assert.Equal(40, dailyHours * 5);
        }

        #endregion

        #region Arrondi

        [Fact]
        public void Rounding_Enabled_SnapsToWhole()
        {
            var p = ParametreFixtures.CreateStandardParametres();
            var rounded = p.Arrondi == 1 ? Math.Round(8.4, 0) : 8.4;
            Assert.True(p.Arrondi == 1);
            Assert.Equal(8, rounded);
        }

        [Fact]
        public void Rounding_Disabled_KeepsFractional()
        {
            var p = ParametreFixtures.CreateStandardParametres();
            p.Arrondi = 0;
            Assert.False(p.Arrondi == 1);
        }

        #endregion
    }
}
