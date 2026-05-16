using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using Microsoft.EntityFrameworkCore;

namespace ABRPOINT.Server.Models;

[Keyless]
[Table("grille")]
public partial class Grille : BaseEntity
{
    [Column("catcod")]
    [StringLength(4)]
    public string? Catcod { get; set; }

    [Column("grireg")]
    [StringLength(1)]
    public string? Grireg { get; set; }

    [Column("grideb", TypeName = "timestamp without time zone")]
    public DateTime? Grideb { get; set; }

    [Column("grifin", TypeName = "timestamp without time zone")]
    public DateTime? Grifin { get; set; }

    [Column("soccod")]
    [StringLength(4)]
    public string Soccod { get; set; } = null!;

    [Column("griech01")]
    public float? Griech01 { get; set; }

    [Column("griech02")]
    public float? Griech02 { get; set; }

    [Column("griech03")]
    public float? Griech03 { get; set; }

    [Column("griech04")]
    public float? Griech04 { get; set; }

    [Column("griech05")]
    public float? Griech05 { get; set; }

    [Column("griech06")]
    public float? Griech06 { get; set; }

    [Column("griech07")]
    public float? Griech07 { get; set; }

    [Column("griech08")]
    public float? Griech08 { get; set; }

    [Column("griech09")]
    public float? Griech09 { get; set; }

    [Column("griech10")]
    public float? Griech10 { get; set; }

    [Column("griech11")]
    public float? Griech11 { get; set; }

    [Column("griech12")]
    public float? Griech12 { get; set; }

    [Column("griech13")]
    public float? Griech13 { get; set; }

    [Column("griech14")]
    public float? Griech14 { get; set; }

    [Column("griech15")]
    public float? Griech15 { get; set; }

    [Column("griech16")]
    public float? Griech16 { get; set; }

    [Column("griech17")]
    public float? Griech17 { get; set; }

    [Column("griech18")]
    public float? Griech18 { get; set; }

    [Column("griech19")]
    public float? Griech19 { get; set; }

    [Column("griech20")]
    public float? Griech20 { get; set; }

    [Column("griech21")]
    public float? Griech21 { get; set; }
}
