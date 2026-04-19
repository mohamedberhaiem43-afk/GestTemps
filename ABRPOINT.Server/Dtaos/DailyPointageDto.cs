namespace ABRPOINT.Server.Dtaos
{
    public class DailyPointageDto
    {
        public string Empcod { get; set; }
        public string Emplib { get; set; }
        public string Empmat { get; set; }
        public string Codposte { get; set; }
        public string Poslib { get; set; }
        public string Entree1 { get; set; }
        public string Sortie1 { get; set; }
        public string Entree2 { get; set; }
        public string Sortie2 { get; set; }
        public string TotalHeure { get; set; }
        public string Status { get; set; } // "present", "absent", "conge", "repos", "ferie", "en_cours"
        public string Motif { get; set; }
        public bool IsExpected { get; set; }
    }

    public class EntryReminderDto
    {
        public bool ShouldRemind { get; set; }
        public string Poste { get; set; }
        public string? HeureEntree { get; set; }
        public bool HasMarkedEntry { get; set; }
        public bool IsRepos { get; set; }
        public bool IsConge { get; set; }
        public bool IsFerie { get; set; }
        public string Message { get; set; }
    }
}