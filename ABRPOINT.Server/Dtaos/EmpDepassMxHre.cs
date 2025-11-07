namespace ABRPOINT.Server.Dtaos
{
    public class EmpDepassMxHre
    {
        public string Empcod { get; set; } = null!;
        public string Soccod { get; set; } = null!;
        public string Sitcod { get; set; } = null!;
        public string? Empmat { get; set; }
        public string? Emplib { get; set; }
        public DateTime? Date { get; set; }
        public float? Heure { get; set; }
    }
}
