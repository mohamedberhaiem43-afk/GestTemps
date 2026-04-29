using ABRPOINT.Server.Dtaos;

namespace ABRPOINT.Server.Tests.CalculService.Fixtures
{
    /// <summary>
    /// Fixtures pour les DTO de présence (PresenceDto).
    /// Note importante : Predat / Dmdate sont DateTime?.
    /// On fixe la date de référence à un mercredi pour stabiliser les tests
    /// qui dépendent du jour de la semaine via Poste (cf. GetStartsWorkDay).
    /// </summary>
    public static class PresenceDtoFixtures
    {
        /// <summary>Mercredi 17/01/2024 — utilisé par toutes les fixtures par défaut.</summary>
        public static readonly DateTime DefaultDate = new DateTime(2024, 1, 17);

        public static PresenceDto CreateStandardPresence(
            string empcod = "EMP001",
            string soccod = "SOC1",
            string codposte = "POST001",
            DateTime? date = null)
        {
            var d = date ?? DefaultDate;
            return new PresenceDto
            {
                Empcod = empcod,
                Soccod = soccod,
                Codposte = codposte,
                Predat = d,
                Dmdate = d,
                Catcod = "CAT001",
                Preentmatup = "08:00",
                Presortmatup = "12:00",
                Preentamidiup = "13:00",
                Presortamidiup = "17:00",
                Preobs = null,
                Etat = "P",
            };
        }

        public static PresenceDto CreateEarlyArrivalPresence(string empcod = "EMP001", string soccod = "SOC1")
        {
            var p = CreateStandardPresence(empcod, soccod);
            p.Preentmatup = "07:00"; // 1h avant 8h
            return p;
        }

        public static PresenceDto CreateLateLeavePresence(string empcod = "EMP001", string soccod = "SOC1")
        {
            var p = CreateStandardPresence(empcod, soccod);
            p.Presortamidiup = "19:00"; // 2h après 17h
            return p;
        }

        public static PresenceDto CreateAbsencePresence(string empcod = "EMP001", string soccod = "SOC1")
        {
            return new PresenceDto
            {
                Empcod = empcod,
                Soccod = soccod,
                Codposte = "POST001",
                Predat = DefaultDate,
                Dmdate = DefaultDate,
                Catcod = "CAT001",
                Preentmatup = null,
                Presortmatup = null,
                Preentamidiup = null,
                Presortamidiup = null,
                Preobs = "ABS",
                Etat = "A",
            };
        }

        public static PresenceDto CreateLateArrivalPresence(string empcod = "EMP001", string soccod = "SOC1")
        {
            var p = CreateStandardPresence(empcod, soccod);
            p.Preentmatup = "08:30"; // retard de 30 min
            return p;
        }

        public static PresenceDto CreateNightShiftPresence(string empcod = "EMP001", string soccod = "SOC1")
        {
            return new PresenceDto
            {
                Empcod = empcod,
                Soccod = soccod,
                Codposte = "POST001",
                Predat = DefaultDate,
                Dmdate = DefaultDate,
                Catcod = "CAT001",
                Preentmatup = "20:00",
                Presortmatup = "04:00",
                Preentamidiup = null,
                Presortamidiup = null,
                Preobs = null,
                Etat = "P",
            };
        }

        public static PresenceDto CreateHalfDayPresence(string empcod = "EMP001", string soccod = "SOC1")
        {
            return new PresenceDto
            {
                Empcod = empcod,
                Soccod = soccod,
                Codposte = "POST001",
                Predat = DefaultDate,
                Dmdate = DefaultDate,
                Catcod = "CAT001",
                Preentmatup = "08:00",
                Presortmatup = "12:00",
                Preentamidiup = null,
                Presortamidiup = null,
                Preobs = null,
                Etat = "P",
            };
        }

        public static PresenceDto CreatePartialAbsencePresence(string empcod = "EMP001", string soccod = "SOC1")
        {
            return new PresenceDto
            {
                Empcod = empcod,
                Soccod = soccod,
                Codposte = "POST001",
                Predat = DefaultDate,
                Dmdate = DefaultDate,
                Catcod = "CAT001",
                Preentmatup = null,
                Presortmatup = null,
                Preentamidiup = "13:00",
                Presortamidiup = "17:00",
                Preobs = "ABS_MAT",
                Etat = "P",
            };
        }
    }
}
