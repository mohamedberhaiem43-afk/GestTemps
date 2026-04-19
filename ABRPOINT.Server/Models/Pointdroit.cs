using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using Microsoft.EntityFrameworkCore;

namespace ABRPOINT.Server.Models;

[PrimaryKey("Poicod","Soccod","Uticod")]
[Table("pointdroit")]
public partial class Pointdroit : BaseEntity
{
    [Column("poicod")]
    [StringLength(10)]
    public string? Poicod { get; set; }

    [Column("soccod")]
    [StringLength(10)]
    public string? Soccod { get; set; }

    [Column("uticod")]
    [StringLength(20)]
    public string? Uticod { get; set; }

    [Column("purger")]
    [StringLength(1)]
    public string? Purger { get; set; }

    [Column("lire")]
    [StringLength(1)]
    public string? Lire { get; set; }

    [Column("config")]
    [StringLength(1)]
    public string? Config { get; set; }
}
