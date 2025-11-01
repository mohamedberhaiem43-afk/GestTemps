using System.ComponentModel.DataAnnotations;

namespace ABRPOINT.Server.Dtaos
{
    public class CompenserAbsenceDto
    {
        public string? Concod { get; set; }
        public string? Empcod { get; set; }
        public string? Emplib { get; set; }
        public DateTime? Condat { get; set; }
        public DateTime? Condep { get; set; }
        public DateTime? Conret { get; set; }
        public string? Conmotif { get; set; }
        public double? Connbjour { get; set; }
        public string? Abscod { get; set; }
    }
}
