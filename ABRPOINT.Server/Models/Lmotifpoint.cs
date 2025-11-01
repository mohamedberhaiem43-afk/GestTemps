using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using Microsoft.EntityFrameworkCore;

namespace ABRPOINT.Server.Models;

[Keyless]
[Table("lmotifpoint")]
public partial class Lmotifpoint
{
    [Column("concod")]
    [StringLength(10)]
    [Unicode(false)]
    public string? Concod { get; set; }

    [Column("soccod")]
    [StringLength(10)]
    [Unicode(false)]
    public string? Soccod { get; set; }

    [Column("motcod")]
    [StringLength(12)]
    [Unicode(false)]
    public string? Motcod { get; set; }

    [Column("ordre")]
    public int? Ordre { get; set; }

    [Column("qte")]
    public double? Qte { get; set; }

    [Column("motmnt")]
    public double? Motmnt { get; set; }

    [Column("mottotal")]
    public double? Mottotal { get; set; }
}
