using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using Microsoft.EntityFrameworkCore;

namespace ABRPOINT.Server.Models;

[Keyless]
[Table("qualif")]
public partial class Qualif
{
    [Column("quacod")]
    [StringLength(4)]
    public string? Quacod { get; set; }

    [Column("soccod")]
    [StringLength(4)]
    public string? Soccod { get; set; }

    [Column("qualib")]
    [StringLength(100)]
    public string? Qualib { get; set; }
    [Column("catcod")]
    [StringLength(10)]
    public string? Catcod { get; set; }
}
