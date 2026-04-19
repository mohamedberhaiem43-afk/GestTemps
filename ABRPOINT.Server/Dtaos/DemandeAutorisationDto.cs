namespace ABRPOINT.Server.Dtaos
{
    public class DemandeAutorisationDto
    {
        public int Id { get; set; }
        public string? Soccod { get; set; }
        public string? Empcod { get; set; }
        public string? Concod { get; set; }
        public DateTime? Condat { get; set; }
        public DateTime? Condep { get; set; }
        public DateTime? Conret { get; set; }
        public float? Connbjour { get; set; }
        public string? Conmotif { get; set; }
        public string? Statut { get; set; }
        public DateTime? DateDemande { get; set; }
        public string? TraitePar { get; set; }
        public DateTime? DateTraitement { get; set; }
        public string? Commentaire { get; set; }
        public string? Abscod { get; set; }
        // Joined fields
        public string? Emplib { get; set; }
        public string? Abslib { get; set; }
    }

    public class DemandeAutorisationCreateDto
    {
        public string? Soccod { get; set; }
        public string? Empcod { get; set; }
        public string? Concod { get; set; }
        public DateTime? Condat { get; set; }
        public DateTime? Condep { get; set; }
        public DateTime? Conret { get; set; }
        public float? Connbjour { get; set; }
        public string? Conmotif { get; set; }
        public string? Abscod { get; set; }
    }

    public class DemandeAutorisationUpdateDto
    {
        public int Id { get; set; }
        public string? Concod { get; set; }
        public DateTime? Condat { get; set; }
        public DateTime? Condep { get; set; }
        public DateTime? Conret { get; set; }
        public float? Connbjour { get; set; }
        public string? Conmotif { get; set; }
        public string? Abscod { get; set; }
    }

    public class DemandeAutorisationTraitementDto
    {
        public int Id { get; set; }
        public string? Statut { get; set; } // "Approuvé" or "Refusé"
        public string? Commentaire { get; set; }
        public string? TraitePar { get; set; }
    }
}