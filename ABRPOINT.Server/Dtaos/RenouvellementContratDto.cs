using System.ComponentModel.DataAnnotations;

namespace ABRPOINT.Server.Dtaos
{
    public class RenouvellementContratDto
    {
        [Required]
        [StringLength(4)]
        public string Soccod { get; set; } = string.Empty;

        [Required]
        [StringLength(9)]
        public string SourceConcod { get; set; } = string.Empty;

        [Required]
        [StringLength(9)]
        public string NewConcod { get; set; } = string.Empty;

        [Required]
        public DateTime Condat { get; set; }

        [Required]
        public DateTime StartDate { get; set; }

        [Required]
        public DateTime EndDate { get; set; }

        public float? MonthNumber { get; set; }

        [StringLength(1)]
        public string? Contype { get; set; }

        [StringLength(100)]
        public string? Empcontrat { get; set; }

        [StringLength(100)]
        public string? Empmotif { get; set; }
    }
}
