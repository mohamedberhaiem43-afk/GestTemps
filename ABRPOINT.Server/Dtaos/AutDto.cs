namespace ABRPOINT.Server.Dtaos
{
    public class AutDto
    {
        public string? Abslib { get; set; }
        public DateTime? Condat { get; set; }
        public DateTime? Condep { get; set; }
        public DateTime? Conret { get; set; }
        public float? Connbjour { get; set; }
        // From Absence table: "O" = paid (counted as worked hours), other = unpaid (excluded from Tothre)
        public string? Abspayer { get; set; }
    }
}
