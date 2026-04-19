using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace ABRPOINT.Server.Models
{
    [Table("documentvault")]
    public partial class DocumentVault : BaseEntity
    {
        [Key]
        [Column("id")]
        public int Id { get; set; }

        [Required]
        [Column("soccod")]
        [StringLength(6)]
        public string Soccod { get; set; } = null!;

        [Required]
        [Column("empcod")]
        [StringLength(12)]
        public string Empcod { get; set; } = null!;

        [Required]
        [Column("docname")]
        [StringLength(255)]
        public string DocName { get; set; } = null!;

        [Required]
        [Column("doctype")]
        [StringLength(50)]
        public string DocType { get; set; } = null!; // Pay Slip, Contract, Certificate, etc.

        [Required]
        [Column("docpath")]
        [StringLength(1024)]
        public string DocPath { get; set; } = null!;

        [Column("docsize")]
        public long DocSize { get; set; }

        [Column("docdate", TypeName = "datetime")]
        public DateTime DocDate { get; set; } = DateTime.UtcNow;

        [Column("issigned")]
        public bool IsSigned { get; set; } = false;

        [Column("signaturedate", TypeName = "datetime")]
        public DateTime? SignatureDate { get; set; }

        [Column("signaturepath")]
        [StringLength(500)]
        public string? SignaturePath { get; set; }

        [Column("status")]
        [StringLength(20)]
        public string Status { get; set; } = "Validated"; // Validated, Pending Signature, Signed
    }
}
