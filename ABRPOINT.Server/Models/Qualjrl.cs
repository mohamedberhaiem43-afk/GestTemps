using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using Microsoft.EntityFrameworkCore;

namespace ABRPOINT.Server.Models;

[Keyless]
[Table("qualjrl")]
public partial class Qualjrl
{
    [Column("ordre")]
    public int? Ordre { get; set; }

    [Column("empcod")]
    [StringLength(10)]
    public string? Empcod { get; set; }

    [Column("soccod")]
    [StringLength(4)]
    public string? Soccod { get; set; }

    [Column("sitcod")]
    [StringLength(2)]
    public string? Sitcod { get; set; }

    [Column("quadate", TypeName = "datetime")]
    public DateTime? Quadate { get; set; }

    [Column("moncod")]
    [StringLength(10)]
    public string? Moncod { get; set; }

    [Column("artcod")]
    [StringLength(10)]
    public string? Artcod { get; set; }

    [Column("defcod")]
    [StringLength(10)]
    public string? Defcod { get; set; }

    [Column("nombre")]
    public float? Nombre { get; set; }

    [Column("nbpcontrole")]
    public float? Nbpcontrole { get; set; }

    [Column("nbpaccepte")]
    public float? Nbpaccepte { get; set; }

    [Column("quaobs")]
    [StringLength(60)]
    public string? Quaobs { get; set; }
}
