using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using Microsoft.EntityFrameworkCore;

namespace ABRPOINT.Server.Models;

[Table("absence")]
[PrimaryKey("Abscod", "Soccod")]
public partial class Absence : BaseEntity
{
    [Required]
    [Column("abscod")]
    [StringLength(4)]
    public string? Abscod { get; set; }
    [Required]
    [Column("soccod")]
    [StringLength(6)]
    public string? Soccod { get; set; }

    [Column("abslib")]
    [StringLength(60)]
    public string? Abslib { get; set; }

    [Column("abscng")]
    [StringLength(1)]
    public string? Abscng { get; set; }

    [Column("abssanc")]
    [StringLength(1)]
    public string? Abssanc { get; set; }

    [Column("abspayer")]
    [StringLength(1)]
    public string? Abspayer { get; set; }

    [Column("absaut")]
    public int? Absaut { get; set; }

    [Column("abspar")]
    [StringLength(1)]
    public string? Abspar { get; set; }

    [Column("absrepos")]
    [StringLength(1)]
    public string? Absrepos { get; set; }

    [Column("rubcod")]
    [StringLength(12)]
    public string? Rubcod { get; set; }

    [Column("absferier")]
    [StringLength(1)]
    public string? Absferier { get; set; }

    [Column("absunite")]
    [StringLength(1)]
    public string? Absunite { get; set; }
}
