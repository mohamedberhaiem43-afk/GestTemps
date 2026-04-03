namespace ABRPOINT.Server.Dtaos
{

    // Add this DTO class
    public class ParametrePresenceCalculDto
    {
        public string? Joudeb { get; set; }
        public string? Joufin { get; set; }
        public string? Moisdeb { get; set; }
        public string? Moisfin { get; set; }
        public float? Nbhconge { get; set; }
        public string? Socpresence { get; set; }
        public string? Sochsup { get; set; }
        public int DebutReel { get; set; }
        public int DebutCalc { get; set; }
        public float Arrondi { get; set; }
        public int? Arrhsup { get; set; }
    }
}
