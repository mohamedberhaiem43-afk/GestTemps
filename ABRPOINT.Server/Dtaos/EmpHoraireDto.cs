namespace ABRPOINT.Server.Dtaos
{
    public class EmpHoraireDto
    {
        public string Soccod { get; set; } = null!;
        public string Empcod { get; set; } = null!;
        public string? Codposte { get; set; }
        public string? Lunhdmat { get; set; }
        public string? Lunhfmat { get; set; }
        public string? Lunhdam { get; set; }
        public string? Lunhfam { get; set; }
        public int? AvantEnt { get; set; }
        public int? AvantSort { get; set; }

    }
}
