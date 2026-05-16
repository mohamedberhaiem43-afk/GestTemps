using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace ABRPOINT.Server.Models;

[Table("autoriser")]
public partial class Autoriser : BaseEntity
{
    [Required] 
    [Key]
    [Column("concod")]
    [StringLength(10)]
    public string Concod { get; set; }
    [Required]
    [Column("soccod")]
    [StringLength(2)]
    public string? Soccod { get; set; }

    [Column("empcod")]
    [StringLength(12)]
    public string? Empcod { get; set; }

    [Column("condat", TypeName = "timestamp without time zone")]
    public DateTime? Condat { get; set; }

    [Column("conjour")]
    [StringLength(1)]
    public string? Conjour { get; set; }

    [Column("condep", TypeName = "timestamp without time zone")]
    public DateTime? Condep { get; set; }

    [Column("conamdep")]
    [StringLength(1)]
    public string? Conamdep { get; set; }

    [Column("conret", TypeName = "timestamp without time zone")]
    public DateTime? Conret { get; set; }

    [Column("conamret")]
    [StringLength(1)]
    public string? Conamret { get; set; }

    [Column("abscod")]
    [StringLength(6)]
    public string? Abscod { get; set; }

    [Column("conmotif")]
    [StringLength(50)]
    public string? Conmotif { get; set; }

    [Column("consanc")]
    [StringLength(1)]
    public string? Consanc { get; set; }

    [Column("connbjour")]
    public float? Connbjour { get; set; }

    [Column("conref")]
    [StringLength(20)]
    public string? Conref { get; set; }

    [Column("conaffecte")]
    [StringLength(12)]
    public string? Conaffecte { get; set; }
}
