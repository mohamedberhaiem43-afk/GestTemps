namespace ABRPOINT.Server.Dtaos
{
    public class EmployeDto
    {
        public string Empcod { get; set; } = null!;
        public string Soccod { get; set; } = null!;
        public string Sitcod { get; set; } = null!;
        public string? Emplib { get; set; }
        public string? Empmat { get; set; }
        public string? Empreg { get; set; }
        public string? Empfonc { get; set; }
        public string? Foncod { get; set; }
        public DateTime? Empemb { get; set; }
        public DateTime? Empsort { get; set; }
        public string? Actif { get; set; }
        public string? Quacod { get; set; }
        public string? Sercod { get; set; }
        public string? Empferepos { get; set; }
        public string? Empniv { get; set; }
        public string? Empcontrat { get; set; }
        public string? Empemail { get; set; }
        public string? Empsexe { get; set; }
        public string? Empdnais { get; set; }
        public string? Emplnais { get; set; }
        public string? Empsitfam { get; set; }
        public int? Empnbp { get; set; }
        public string? Empcin { get; set; }
        public string? Emptel { get; set; }
        public string? Empmob { get; set; }
        public string? Empadr { get; set; }
        public string? Utirole { get; set; }
        // Photo de profil — lue depuis Utilisateurs.Utiimg via la jointure
        // Empcod=Uticod (le compte utilisateur partage le code de l'employé).
        // Permet d'afficher l'avatar dans la liste effectifs sans appel séparé.
        public string? Utiimg { get; set; }
    }
}
