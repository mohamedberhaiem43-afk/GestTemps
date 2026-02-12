namespace ABRPOINT.Server.Dtaos
{
    public class EtatEmpPresence
    {
        public string Empcod { get; set; }
        public string Empmat { get; set; }
        public string EmpSite { get; set; }
        public string Emplib { get; set; }
        public string Regime { get; set; }
        public string? Motif { get; set; }
        public string HasConge { get; set; }
        public DateTime Predat { get; set; }
        public string Entree1 { get; set; }
        public string Entree2 { get; set; }
        public string Sortie1 { get; set; }
        public string Sortie2 { get; set; }
        public bool Allaitement { get; set; }
        public string HS25 { get; set; }
        public string HS50 { get; set; }
        public string HS75 { get; set; }
        public TimeSpan? Preretmateup { get; set; }
        public TimeSpan? Preretameup { get; set; }
        public TimeSpan? Preretmatsup { get; set; }
        public TimeSpan? Preretamsup { get; set; }
        public string HS100 { get; set; }
        public string TotalRetard { get; set; }
        public string TotalHeure { get; set; }
        public string HeureNuit { get; set; }
    }
}
