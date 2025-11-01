namespace ABRPOINT.Server.Dtaos
{
    public class EmployeDto
    {
        public string Empcod { get; set; } = null!;
        public string Soccod { get; set; } = null!;
        public string Sitcod { get; set; } = null!;
        public string? Emplib { get; set; }
        public string? Empreg { get; set; }
        public string? Empfonc { get; set; }
        public DateTime? Empemb { get; set; }
        public DateTime? Empsort { get; set; }
        public string? Actif { get; set; }
        public string? Quacod { get; set; }
        public string? Sercod { get; set; }

    }
}
