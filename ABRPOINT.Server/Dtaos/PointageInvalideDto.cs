namespace ABRPOINT.Server.Dtaos
{
    public class PointageInvalideDto
    {
        public string Empcod { get; set; } = string.Empty;
        public string? Emplib { get; set; }
        public string? Departement { get; set; }
        public string? Codposte { get; set; }
        public DateTime? Predat { get; set; }

        // Pointages bruts
        public string? Preentmatup { get; set; }
        public string? Presortmatup { get; set; }
        public string? Preentamidiup { get; set; }
        public string? Presortamidiup { get; set; }
        public string? Tothre { get; set; }

        // Diagnostic
        public string Motif { get; set; } = string.Empty;
        public bool EntreeManquante { get; set; }
        public bool SortieManquante { get; set; }
        public bool IncoherenceHoraire { get; set; }
        public bool MidiIncoherent { get; set; }
    }
}