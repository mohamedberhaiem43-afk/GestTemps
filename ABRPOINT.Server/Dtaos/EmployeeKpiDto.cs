using System;

namespace ABRPOINT.Server.Dtaos
{
    public class EmployeeKpiDto
    {
        /// <summary>
        /// Remaining leave balance (congé restant)
        /// </summary>
        public float SoldeConge { get; set; }

        /// <summary>
        /// Total acquired leave days (congé acquis)
        /// </summary>
        public float CongeAcquis { get; set; }

        /// <summary>
        /// Total worked hours this week
        /// </summary>
        public float HeuresTravailleesSemaine { get; set; }

        /// <summary>
        /// Weekly objective hours (default 35h)
        /// </summary>
        public float ObjectifHebdomadaire { get; set; }

        /// <summary>
        /// Percentage of weekly objective achieved
        /// </summary>
        public float PourcentageObjectif { get; set; }

        /// <summary>
        /// Number of pending leave requests
        /// </summary>
        public int DemandesEnAttente { get; set; }

        /// <summary>
        /// Daily worked hours for the week (key=day name, value=hours)
        /// </summary>
        public Dictionary<string, float> SuiviPointageSemaine { get; set; } = new();

        /// <summary>
        /// Monthly worked hours for the current month (key=week label, value=hours)
        /// </summary>
        public Dictionary<string, float> SuiviPointageMois { get; set; } = new();

        /// <summary>
        /// Employee name
        /// </summary>
        public string? Emplib { get; set; }

        /// <summary>
        /// Employee code
        /// </summary>
        public string? Empcod { get; set; }

        /// <summary>
        /// Employee regime (H=Horaire, M=Mensuel)
        /// </summary>
        public string? Empreg { get; set; }

        /// <summary>
        /// Solde RTT — null si l'employé n'est pas éligible (méthode 'N' ou non définie).
        /// L'UI mobile/web utilise cette nullité pour décider d'afficher la carte ou non.
        /// </summary>
        public RttKpiDto? Rtt { get; set; }
    }

    public class RttKpiDto
    {
        public string Methode { get; set; } = "N";
        public float DroitAnnuel { get; set; }
        public float Pris { get; set; }
        public float Solde { get; set; }
    }
}