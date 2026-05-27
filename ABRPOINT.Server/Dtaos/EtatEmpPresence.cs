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
        // Nommé Tothnuit (et non HeureNuit) pour matcher la colonne Presence.Tothnuit
        // et le champ lu côté client `etatPresence.tothnuit`. Le rename est purement
        // sérialisation : la KPI « H.Nuit total » de la page EtatPresence sommait
        // `r.tothnuit` qui n'existait pas dans le JSON renvoyé (le champ s'appelait
        // `heureNuit`) → résultat toujours 0 même sur des plannings avec h. nuit.
        public string Tothnuit { get; set; }
    }
}
