using ABRPOINT.Server.Models;

namespace ABRPOINT.Server.Tests.CalculService.Fixtures
{
    /// <summary>
    /// Fixtures pour les paramètres société (table `parametre`).
    /// Les types correspondent au modèle EF (Joudeb/Joufin/Parreptrv/Parelimftrv… sont des string,
    /// Pardroitnbj est un float, etc.).
    /// </summary>
    public static class ParametreFixtures
    {
        public static Parametre CreateStandardParametres(string soccod = "SOC1")
        {
            return new Parametre
            {
                Soccod = soccod,
                Parjhnfixe = 160f,         // 160h/mois (référentiel)
                Joudeb = "01",
                Moisdeb = "C",
                Joufin = "31",
                Moisfin = "C",
                Parecart = 15,             // écart minimum 15 min
                Parminhjour = 0,
                Parmaxhjour = 10,
                Parmaxfer = 0,
                Parelimftrv = "0",         // ne pas éliminer fériés du calcul H.Sup
                Parreptrv = "0",           // déduire heures repos
                Fertrv = 1,                // travail autorisé jours fériés
                Nbhconge = 8f,
                Nbhrepos = 1,
                Nbhferier = 8,
                Arrondi = 1,               // arrondi automatique
                Parnuit = "1",
                Nuitdeb = "22:00",
                Nuitfin = "06:00",
                Moinsrepas = 1,
                Ajustupd = "0",
                Parretabs = "1",
                Parhnuitspec = "1",
                Pardroitnbj = 0f,
                Paie = "I",
                Parcadre = "1",
                Parmaitrise = "1",
                Parexec = "1",
            };
        }

        public static Parametre CreateNoNightParametres(string soccod = "SOC1")
        {
            var p = CreateStandardParametres(soccod);
            p.Parnuit = "0";
            return p;
        }

        public static Parametre CreateLimitedOvertimeParametres(string soccod = "SOC1")
        {
            var p = CreateStandardParametres(soccod);
            p.Parmaxhjour = 9; // max 9h → 1h de supp max
            return p;
        }

        public static Parametre CreateStrictParametres(string soccod = "SOC1")
        {
            var p = CreateStandardParametres(soccod);
            p.Parecart = 5;
            p.Parminhjour = 2;
            p.Parmaxhjour = 8;
            return p;
        }

        public static Parametre CreateFlexibleParametres(string soccod = "SOC1")
        {
            var p = CreateStandardParametres(soccod);
            p.Parecart = 30;
            p.Parminhjour = 0;
            p.Parmaxhjour = 12;
            p.Parcadre = "0";
            return p;
        }

        public static Parametre CreateFeriesExcludedBeforeParametres(string soccod = "SOC1")
        {
            var p = CreateStandardParametres(soccod);
            p.Parelimftrv = "1";
            return p;
        }

        public static Parametre CreateFeriesExcludedAfterParametres(string soccod = "SOC1")
        {
            var p = CreateStandardParametres(soccod);
            p.Parelimftrv = "2";
            return p;
        }

        public static Parametre CreateWeekendDeductionParametres(string soccod = "SOC1")
        {
            var p = CreateStandardParametres(soccod);
            p.Parreptrv = "3"; // déduire samedi + dimanche
            return p;
        }

        public static Parametre CreateCustomDividendParametres(string soccod = "SOC1", int hoursPerMonth = 120)
        {
            var p = CreateStandardParametres(soccod);
            p.Parjhnfixe = hoursPerMonth;
            return p;
        }
    }
}
