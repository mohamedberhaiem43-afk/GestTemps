using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace ABRPOINT.Server.Models;

[Table("fonction")]
public partial class Fonction : BaseEntity
{
    [Column("foncod")]
    [StringLength(6)]
    public string? Foncod { get; set; }

    [Column("soccod")]
    [StringLength(4)]
    public string? Soccod { get; set; }

    [Column("fonlib")]
    [StringLength(100)]
    public string? Fonlib { get; set; }

    [Column("fontype")]
    [StringLength(1)]
    public string? Fontype { get; set; }

    [Column("fonpqual")]
    [StringLength(1)]
    public string? Fonpqual { get; set; }

    [Column("fonpchoix")]
    [StringLength(1)]
    public string? Fonpchoix { get; set; }
}
