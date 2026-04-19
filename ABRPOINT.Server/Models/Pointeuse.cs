using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using Microsoft.EntityFrameworkCore;

namespace ABRPOINT.Server.Models;

[PrimaryKey("Poicod", "Soccod")]
[Table("pointeuse")]
public partial class Pointeuse : BaseEntity
{
    [Key]
    [Column("poicod")]
    [StringLength(4)]
    public string Poicod { get; set; } = null!;

    [Key]
    [Column("soccod")]
    [StringLength(6)]
    public string Soccod { get; set; } = null!;

    [Column("poilib")]
    [StringLength(30)]
    public string? Poilib { get; set; }

    [Column("poiadrip1")]
    public int? Poiadrip1 { get; set; }

    [Column("poiadrip2")]
    public int? Poiadrip2 { get; set; }

    [Column("poiadrip3")]
    public int? Poiadrip3 { get; set; }

    [Column("poiadrip4")]
    public int? Poiadrip4 { get; set; }

    [Column("poiport")]
    public int? Poiport { get; set; }

    [Column("poietat")]
    [StringLength(1)]
    public string? Poietat { get; set; }

    [Column("poicom")]
    [StringLength(1)]
    public string? Poicom { get; set; }
    public string? Poipwd { get; set; }

}
