using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using Microsoft.EntityFrameworkCore;

namespace ABRPOINT.Server.Models;

[Keyless]
[Table("billet")]
public partial class Billet
{
    [Column("empcod")]
    [StringLength(6)]
    public string? Empcod { get; set; }

    [Column("soccod")]
    [StringLength(2)]
    public string? Soccod { get; set; }

    [Column("predat", TypeName = "datetime")]
    public DateTime? Predat { get; set; }

    [Column("ordre")]
    public int? Ordre { get; set; }

    [Column("empmat")]
    [StringLength(6)]
    public string? Empmat { get; set; }

    [Column("motif")]
    [StringLength(10)]
    public string? Motif { get; set; }
}
