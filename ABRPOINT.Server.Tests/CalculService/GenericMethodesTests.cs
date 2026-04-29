using Xunit;
using ABRPOINT.Helper;
using ABRPOINT.Server.Models;
using ABRPOINT.Server.Tests.CalculService.Fixtures;

namespace ABRPOINT.Server.Tests.CalculService
{
    /// <summary>
    /// Tests des helpers purs de GenericMethodes (parsing horaires, classification présence,
    /// extraction des plages horaires d'un poste). Pas de mocks nécessaires.
    /// </summary>
    public class GenericMethodesTests
    {
        #region IsValidHHmm

        [Theory]
        [InlineData("08:00", true)]
        [InlineData("23:59", true)]
        [InlineData("00:00", true)]
        [InlineData("invalid", false)]
        [InlineData("", false)]
        [InlineData("25:00", false)] // heure invalide
        public void IsValidHHmm_DiverseInputs(string input, bool expected)
        {
            Assert.Equal(expected, GenericMethodes.IsValidHHmm(input));
        }

        #endregion

        #region ConvertHHmmToDouble

        [Theory]
        [InlineData("08:00", 8.0f)]
        [InlineData("08:30", 8.5f)]
        [InlineData("00:15", 0.25f)]
        [InlineData("12:45", 12.75f)]
        [InlineData("00:00", 0.0f)]
        public void ConvertHHmmToDouble_ValidInputs_ConvertsCorrectly(string input, float expected)
        {
            var result = GenericMethodes.ConvertHHmmToDouble(input);
            Assert.NotNull(result);
            Assert.Equal(expected, result!.Value, 3);
        }

        [Theory]
        [InlineData(null)]
        [InlineData("")]
        [InlineData(" ")]
        [InlineData("invalid")]
        [InlineData("08-30")]      // mauvais séparateur
        [InlineData("08:00:00")]   // 3 segments
        public void ConvertHHmmToDouble_InvalidInputs_ReturnsNull(string? input)
        {
            Assert.Null(GenericMethodes.ConvertHHmmToDouble(input!));
        }

        #endregion

        #region ConvertDoubleToHHmm

        [Theory]
        [InlineData(8.0f, "08:00")]
        [InlineData(8.5f, "08:30")]
        [InlineData(0.25f, "00:15")]
        [InlineData(12.75f, "12:45")]
        [InlineData(0.0f, "00:00")]
        [InlineData(-1.5f, "-01:30")]
        public void ConvertDoubleToHHmm_ValidInputs_FormatsCorrectly(float input, string expected)
        {
            Assert.Equal(expected, GenericMethodes.ConvertDoubleToHHmm(input));
        }

        [Fact]
        public void ConvertDoubleToHHmm_Null_ReturnsNull()
        {
            Assert.Null(GenericMethodes.ConvertDoubleToHHmm(null));
        }

        [Fact]
        public void ConvertDoubleToHHmm_RoundUpEdge_RollsToNextHour()
        {
            // 8.999h → 0.999*60 ≈ 59.94 min ≈ 60 → 09:00
            var result = GenericMethodes.ConvertDoubleToHHmm(8.999f);
            Assert.Equal("09:00", result);
        }

        [Fact]
        public void ConvertHHmmToDouble_RoundTrip_PreservesValue()
        {
            var original = "14:25";
            var asDouble = GenericMethodes.ConvertHHmmToDouble(original);
            var roundTripped = GenericMethodes.ConvertDoubleToHHmm(asDouble);
            Assert.Equal(original, roundTripped);
        }

        #endregion

        #region NotPresent

        [Fact]
        public void NotPresent_NoTothre_ReturnsTrue()
        {
            var presence = new Presence { Tothre = null };
            Assert.True(GenericMethodes.NotPresent(presence));
        }

        [Fact]
        public void NotPresent_TothreLessThanOneHour_ReturnsTrue()
        {
            var presence = new Presence { Tothre = "00:30" };
            Assert.True(GenericMethodes.NotPresent(presence));
        }

        [Fact]
        public void NotPresent_TothreEightHoursButNoSlots_ReturnsTrue()
        {
            // Tothre indique des heures mais aucune plage saisie → considéré comme non-présent
            var presence = new Presence
            {
                Tothre = "08:00",
                Preentmatup = null,
                Presortmatup = null,
                Preentamidiup = null,
                Presortamidiup = null,
            };
            Assert.True(GenericMethodes.NotPresent(presence));
        }

        [Fact]
        public void NotPresent_FullDayWithSlots_ReturnsFalse()
        {
            var presence = new Presence
            {
                Tothre = "08:00",
                Preentmatup = "08:00",
                Presortmatup = "12:00",
                Preentamidiup = "13:00",
                Presortamidiup = "17:00",
            };
            Assert.False(GenericMethodes.NotPresent(presence));
        }

        #endregion

        #region GetStartsWorkDay

        [Fact]
        public void GetStartsWorkDay_Wednesday_ReturnsWednesdaySchedule()
        {
            var poste = PosteFixtures.CreateStandardPoste();
            var date = new DateTime(2024, 1, 17); // mercredi

            var (mStart, mEnd, eStart, eEnd) = GenericMethodes.GetStartsWorkDay(date, poste);

            Assert.Equal("08:00", mStart);
            Assert.Equal("12:00", mEnd);
            Assert.Equal("13:00", eStart);
            Assert.Equal("17:00", eEnd);
        }

        [Fact]
        public void GetStartsWorkDay_DifferentSchedulePerDay_ReturnsCorrectDay()
        {
            // On configure spécifiquement le mardi à 09:00–17:00 sans pause
            var poste = PosteFixtures.CreateStandardPoste();
            poste.Marhdmat = "09:00";
            poste.Marhfmat = "13:00";
            poste.Marhdam = "14:00";
            poste.Marhfam = "18:00";

            var mardi = new DateTime(2024, 1, 16); // mardi
            var (mStart, mEnd, eStart, eEnd) = GenericMethodes.GetStartsWorkDay(mardi, poste);

            Assert.Equal("09:00", mStart);
            Assert.Equal("13:00", mEnd);
            Assert.Equal("14:00", eStart);
            Assert.Equal("18:00", eEnd);
        }

        [Fact]
        public void GetStartsWorkDay_NullPoste_ReturnsAllNull()
        {
            var (mStart, mEnd, eStart, eEnd) = GenericMethodes.GetStartsWorkDay(DateTime.Now, null!);
            Assert.Null(mStart);
            Assert.Null(mEnd);
            Assert.Null(eStart);
            Assert.Null(eEnd);
        }

        #endregion

        #region FormatEmpmat

        [Theory]
        [InlineData("123", (short)5, "00123")]
        [InlineData("1", (short)4, "0001")]
        [InlineData("EMP-987", (short)6, "000987")]
        [InlineData("", (short)4, "")]
        public void FormatEmpmat_PadsWithLeadingZeros(string input, short length, string expected)
        {
            Assert.Equal(expected, GenericMethodes.FormatEmpmat(input, length));
        }

        #endregion
    }
}
