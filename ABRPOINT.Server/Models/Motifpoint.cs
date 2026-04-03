using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using Microsoft.EntityFrameworkCore;

namespace ABRPOINT.Server.Models;

[Keyless]
[Table("motifpoint")]
public partial class Motifpoint
{
    [Column("motcod")]
    [StringLength(12)]
    [Unicode(false)]
    public string? Motcod { get; set; }

    [Column("soccod")]
    [StringLength(10)]
    [Unicode(false)]
    public string? Soccod { get; set; }

    [Column("mottype")]
    [StringLength(1)]
    [Unicode(false)]
    public string? Mottype { get; set; }

    [Column("motlib")]
    [StringLength(50)]
    [Unicode(false)]
    public string? Motlib { get; set; }

    [Column("motmnt")]
    public double? Motmnt { get; set; }
}
