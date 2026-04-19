using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using Microsoft.EntityFrameworkCore;

namespace ABRPOINT.Server.Models;

[Keyless]
[Table("lsalaire")]
public partial class Lsalaire : BaseEntity
{
    [Column("empcod")]
    [StringLength(12)]
    public string? Empcod { get; set; }

    [Column("soccod")]
    [StringLength(4)]
    public string? Soccod { get; set; }

    [Column("annee")]
    [StringLength(4)]
    public string? Annee { get; set; }

    [Column("mois")]
    [StringLength(2)]
    public string? Mois { get; set; }

    [Column("jour", TypeName = "datetime")]
    public DateTime? Jour { get; set; }

    [Column("rubcod")]
    [StringLength(10)]
    public string? Rubcod { get; set; }

    [Column("rubregime")]
    [StringLength(1)]
    public string? Rubregime { get; set; }

    [Column("tothre")]
    [StringLength(5)]
    public string? Tothre { get; set; }

    [Column("rubnbr")]
    public double? Rubnbr { get; set; }

    [Column("nbhjour")]
    [StringLength(6)]
    public string? Nbhjour { get; set; }

    [Column("empmat")]
    [StringLength(12)]
    public string? Empmat { get; set; }

    [Column("sitcod")]
    [StringLength(2)]
    public string? Sitcod { get; set; }

    [Column("motif")]
    [StringLength(30)]
    public string? Motif { get; set; }

    [Column("rubtype")]
    [StringLength(1)]
    public string? Rubtype { get; set; }
}
