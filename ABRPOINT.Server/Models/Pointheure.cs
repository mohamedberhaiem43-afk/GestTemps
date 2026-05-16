using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using Microsoft.EntityFrameworkCore;

namespace ABRPOINT.Server.Models;

[Keyless]
[Table("pointheure")]
public partial class Pointheure : BaseEntity
{
    [Column("empcod")]
    [StringLength(12)]
    public string? Empcod { get; set; }

    [Column("soccod")]
    [StringLength(6)]
    public string? Soccod { get; set; }

    [Column("sitcod")]
    [StringLength(4)]
    public string? Sitcod { get; set; }

    [Column("pointdat", TypeName = "timestamp without time zone")]
    public DateTime? Pointdat { get; set; }

    [Column("numheure")]
    public int? Numheure { get; set; }

    [Column("nbminute")]
    public float? Nbminute { get; set; }

    [Column("foncod")]
    [StringLength(6)]
    public string? Foncod { get; set; }

    [Column("quacod")]
    [StringLength(6)]
    public string? Quacod { get; set; }
}
