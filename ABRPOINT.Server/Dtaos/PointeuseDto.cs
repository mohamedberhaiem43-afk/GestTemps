namespace ABRPOINT.Server.Dtaos
{
    public class PointeuseDto
    {
        public string Poicod { get; set; } = null!;
        public string Soccod { get; set; } = null!;
        public int? Poiadrip1 { get; set; }
        public int? Poiadrip2 { get; set; }
        public int? Poiadrip3 { get; set; }
        public int? Poiadrip4 { get; set; }
        public string? Poilib { get; set; }
        public int? Poiport { get; set; }
        public DateTime? LatestDmhre { get; set; }
    }
}
