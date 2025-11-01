using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using Microsoft.EntityFrameworkCore;

namespace ABRPOINT.Server.Models;

[Keyless]
[Table("pret")]
public partial class Pret
{
    [Column("precod")]
    [StringLength(10)]
    public string? Precod { get; set; }

    [Column("soccod")]
    [StringLength(4)]
    public string? Soccod { get; set; }

    [Column("empcod")]
    [StringLength(6)]
    public string? Empcod { get; set; }

    [Column("predat", TypeName = "datetime")]
    public DateTime? Predat { get; set; }

    [Column("rubcod")]
    [StringLength(10)]
    public string? Rubcod { get; set; }

    [Column("predeb", TypeName = "datetime")]
    public DateTime? Predeb { get; set; }

    [Column("prefin", TypeName = "datetime")]
    public DateTime? Prefin { get; set; }

    [Column("premnt")]
    public float? Premnt { get; set; }

    [Column("preret")]
    public float? Preret { get; set; }

    [Column("condg")]
    [StringLength(1)]
    public string? Condg { get; set; }

    [Column("conrefus")]
    [StringLength(20)]
    public string? Conrefus { get; set; }
}
