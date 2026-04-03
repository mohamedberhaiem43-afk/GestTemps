using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using Microsoft.EntityFrameworkCore;

namespace ABRPOINT.Server.Models;

[Keyless]
[Table("anomalie")]
public partial class Anomalie
{
    [Column("empcod")]
    [StringLength(4)]
    public string? Empcod { get; set; }

    [Column("soccod")]
    [StringLength(6)]
    public string? Soccod { get; set; }

    [Column("sitcod")]
    [StringLength(10)]
    public string? Sitcod { get; set; }

    [Column("anodat", TypeName = "datetime")]
    public DateTime? Anodat { get; set; }

    [Column("motif")]
    [StringLength(100)]
    public string? Motif { get; set; }

    [Column("modcod")]
    [StringLength(20)]
    public string? Modcod { get; set; }

    [Column("uticod")]
    [StringLength(20)]
    public string? Uticod { get; set; }
}
