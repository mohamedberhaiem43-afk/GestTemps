namespace ABRPOINT.Server.Dtaos
{
    public class ParametreMoisPointageDto
    {
        public string Joudeb { get; set; }
        public string Joufin { get; set; }
        public string Moisdeb { get; set; }
        public string Moisfin { get; set; }
        public float? Nbhconge { get; set; }
        public string? Socpresence { get; set; }
        public string? Sochsup { get; set; }

        // --- nouvelles propriétés ---
        public int DebutReel { get; set; }      // jour réel
        public int DebutCalc { get; set; }      // ajusté selon Sochsup
    }
}
