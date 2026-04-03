using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using Microsoft.EntityFrameworkCore;

namespace ABRPOINT.Server.Models;

[Keyless]
[Table("pointacce")]
public partial class Pointacce
{
    [Column("empcod")]
    [StringLength(6)]
    public string? Empcod { get; set; }

    [Column("predat", TypeName = "datetime")]
    public DateTime? Predat { get; set; }

    [Column("ordre")]
    public int? Ordre { get; set; }

    [Column("ordreent")]
    public int? Ordreent { get; set; }

    [Column("soccod")]
    [StringLength(6)]
    public string? Soccod { get; set; }

    [Column("ordresort")]
    public int? Ordresort { get; set; }

    [Column("empmat")]
    [StringLength(6)]
    public string? Empmat { get; set; }

    [Column("entree")]
    [StringLength(8)]
    public string? Entree { get; set; }

    [Column("sortie")]
    [StringLength(8)]
    public string? Sortie { get; set; }

    [Column("duree")]
    [StringLength(8)]
    public string? Duree { get; set; }

    [Column("sitcod")]
    [StringLength(6)]
    public string? Sitcod { get; set; }

    [Column("pntentree")]
    [StringLength(6)]
    public string? Pntentree { get; set; }

    [Column("pntsortie")]
    [StringLength(6)]
    public string? Pntsortie { get; set; }

    [Column("predatent", TypeName = "datetime")]
    public DateTime? Predatent { get; set; }

    [Column("predatsort", TypeName = "datetime")]
    public DateTime? Predatsort { get; set; }

    [Column("valider")]
    [StringLength(1)]
    public string? Valider { get; set; }
}
