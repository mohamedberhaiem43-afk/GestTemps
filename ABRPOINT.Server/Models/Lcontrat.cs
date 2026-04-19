using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using Microsoft.EntityFrameworkCore;

namespace ABRPOINT.Server.Models;

[PrimaryKey("Soccod", "Concod", "Empcod")]
[Table("lcontrat")]
public partial class Lcontrat : BaseEntity
{
    [Key]
    [Column("soccod")]
    [StringLength(4)]
    public string Soccod { get; set; } = null!;

    [Key]
    [Column("concod")]
    [StringLength(9)]
    public string Concod { get; set; } = null!;

    [Key]
    [Column("empcod")]
    [StringLength(12)]
    public string Empcod { get; set; } = null!;

    [Column("rubcod")]
    [StringLength(12)]
    public string? Rubcod { get; set; }

    [Column("rublib")]
    [StringLength(50)]
    public string? Rublib { get; set; }

    [Column("rubmnt")]
    public double? Rubmnt { get; set; }

    [Column("rubunite")]
    [StringLength(1)]
    public string? Rubunite { get; set; }
}
