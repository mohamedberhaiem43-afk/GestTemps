namespace ABRPOINT.Server.Dtaos
{
    public class DashboardData
    {
        public DateTime Date { get; set; }
        public string Departement { get; set; }

        // Effectif
        public int EffectifTotal { get; set; }
        public int EffectifPresent { get; set; }
        public decimal PourcentagePresence { get; set; }
        public int TendancePresence { get; set; } // Différence avec jour précédent

        // Heures
        public decimal HeuresTravaillees { get; set; }
        public decimal HeuresPreveues { get; set; }
        public decimal PourcentageHeures { get; set; }
        public decimal HeuresSupplementaires { get; set; }

        // Absences
        public int AbsencesJustifiees { get; set; }
        public int AbsencesNonJustifiees { get; set; }
        public int TotalAbsences { get; set; }
        public int NombreRetards { get; set; }

        // Demandes
        public int DemandesCongesEnAttente { get; set; }
        public int TotalDemandesEnAttente { get; set; }

        // Anomalies
        public int PointagesIncomplets { get; set; }

        // Données par département
        public List<DonneesDepartement> DonneesDepartements { get; set; }
    }
}

public class DonneesDepartement
{
    public string Departement { get; set; }
    public int EffectifTotal { get; set; }
    public int EffectifPresent { get; set; }
    public decimal PourcentagePresence { get; set; }
}

public class EvolutionJournaliere
{
    public DateTime Date { get; set; }
    public string JourSemaine { get; set; }
    public int EffectifPresent { get; set; }
    public decimal HeuresTravaillees { get; set; }
    public decimal TauxPresence { get; set; }
}

public class EmployeStatut
{
    public string EMPCOD { get; set; }
    public string Emplib { get; set; }
    public string Prenom { get; set; }
    public string Departement { get; set; }
    public DateTime? HeureArrivee { get; set; }
    public DateTime? HeureDepart { get; set; }
    public decimal? HeuresTravaillees { get; set; }
    public string Statut { get; set; } // Présent, Absent, Congé
    public string TypeConge { get; set; }
    public bool EstEnRetard { get; set; }
}