using ABRPOINT.Server.Models;

namespace ABRPOINT.Server.Tests.CalculService.Fixtures
{
    /// <summary>
    /// Fixtures pour les postes (horaires hebdomadaires).
    /// Le modèle Poste stocke les heures début/fin matin et après-midi pour chaque jour
    /// de la semaine (Lun → Dim). On remplit donc les 7 jours avec les mêmes horaires
    /// pour rendre les tests indépendants du jour de la date.
    /// </summary>
    public static class PosteFixtures
    {
        private static Poste BuildWeeklySchedule(
            string codposte,
            string soccod,
            string libposte,
            string morningStart,
            string morningEnd,
            string? afternoonStart,
            string? afternoonEnd,
            int? avantent,
            int? apressort)
        {
            return new Poste
            {
                Codposte = codposte,
                Soccod = soccod,
                Libposte = libposte,
                Avantent = avantent,
                Apresent = avantent,
                Avantsort = apressort,
                Apressort = apressort,

                // Lundi
                Lunhdmat = morningStart, Lunhfmat = morningEnd, Lunhdam = afternoonStart, Lunhfam = afternoonEnd,
                // Mardi
                Marhdmat = morningStart, Marhfmat = morningEnd, Marhdam = afternoonStart, Marhfam = afternoonEnd,
                // Mercredi
                Merhdmat = morningStart, Merhfmat = morningEnd, Merhdam = afternoonStart, Merhfam = afternoonEnd,
                // Jeudi
                Jeuhdmat = morningStart, Jeuhfmat = morningEnd, Jeuhdam = afternoonStart, Jeuhfam = afternoonEnd,
                // Vendredi
                Venhdmat = morningStart, Venhfmat = morningEnd, Venhdam = afternoonStart, Venhfam = afternoonEnd,
                // Samedi
                Samhdmat = morningStart, Samhfmat = morningEnd, Samhdam = afternoonStart, Samhfam = afternoonEnd,
                // Dimanche
                Dimhdmat = morningStart, Dimhfmat = morningEnd, Dimhdam = afternoonStart, Dimhfam = afternoonEnd,
            };
        }

        /// <summary>Poste standard 8h–12h / 13h–17h, tolérance 5 min.</summary>
        public static Poste CreateStandardPoste(string codposte = "POST001", string soccod = "SOC001")
            => BuildWeeklySchedule(codposte, soccod, "Poste Standard",
                "08:00", "12:00", "13:00", "17:00", avantent: 5, apressort: 5);

        /// <summary>Poste décalé 10h–14h / 15h–19h, tolérance 5 min.</summary>
        public static Poste CreateShiftedPoste(string codposte = "POST002", string soccod = "SOC001")
            => BuildWeeklySchedule(codposte, soccod, "Poste Décalé",
                "10:00", "14:00", "15:00", "19:00", avantent: 5, apressort: 5);

        /// <summary>
        /// Poste de nuit 20h → 04h en session unique (pas de pause).
        /// On stocke 20:00 / 04:00 sur les champs "matin" et on laisse la session après-midi vide.
        /// Cela correspond à la convention du service : pas de session du soir si eveningStart/End == 00:00.
        /// </summary>
        public static Poste CreateNightShiftPoste(string codposte = "POST003", string soccod = "SOC001")
            => BuildWeeklySchedule(codposte, soccod, "Poste Nuit",
                morningStart: "20:00", morningEnd: "04:00",
                afternoonStart: null!, afternoonEnd: null!,
                avantent: 5, apressort: 5);

        /// <summary>Poste strict — aucune tolérance.</summary>
        public static Poste CreateStrictPoste(string codposte = "POST004", string soccod = "SOC001")
            => BuildWeeklySchedule(codposte, soccod, "Poste Strict",
                "08:00", "12:00", "13:00", "17:00", avantent: 0, apressort: 0);

        /// <summary>Poste flexible — large tolérance (15 min).</summary>
        public static Poste CreateFlexiblePoste(string codposte = "POST005", string soccod = "SOC001")
            => BuildWeeklySchedule(codposte, soccod, "Poste Flexible",
                "08:00", "12:00", "13:00", "17:00", avantent: 15, apressort: 15);

        /// <summary>Poste avec sanction de retard configurée (ApplySanction).</summary>
        public static Poste CreateRetardSanctionPoste(string codposte = "POST006", string soccod = "SOC001")
        {
            var poste = CreateStandardPoste(codposte, soccod);
            poste.Retmin = 10;     // Au-delà de 10 min de retard
            poste.Retsanc = 30;    // → ajouter 30 min de sanction
            poste.Avamn = 10;      // sortie matin avancée > 10 min
            poste.Avabon = 30;     // → 30 min de sanction
            return poste;
        }
    }
}
