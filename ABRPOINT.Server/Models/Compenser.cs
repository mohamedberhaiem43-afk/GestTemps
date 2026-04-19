using Microsoft.EntityFrameworkCore;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace ABRPOINT.Server.Models;


[Table("compenser")]
[PrimaryKey("Concod","Soccod")]
public partial class Compenser : BaseEntity
{
    [Required]
    [Column("concod")]
    [StringLength(10)]
    public string? Concod { get; set; }

    [Required]
    [Column("soccod")]
    [StringLength(2)]
    public string? Soccod { get; set; }

    [Column("empcod")]
    [StringLength(12)]
    public string? Empcod { get; set; }

    [Column("condat", TypeName = "datetime")]
    public DateTime? Condat { get; set; }

    [Column("concmp", TypeName = "datetime")]
    public DateTime? Concmp { get; set; }

    [Column("conjour")]
    [StringLength(1)]
    public string? Conjour { get; set; }

    [Column("condep", TypeName = "datetime")]
    public DateTime? Condep { get; set; }

    [Column("conamdep")]
    [StringLength(1)]
    public string? Conamdep { get; set; }

    [Column("conret", TypeName = "datetime")]
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
    public double? Connbjour { get; set; }

    [Column("conref")]
    [StringLength(20)]
    public string? Conref { get; set; }

    [Column("conaffecte")]
    [StringLength(12)]
    public string? Conaffecte { get; set; }
}
