using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using Microsoft.EntityFrameworkCore;

namespace ABRPOINT.Server.Models;

[Keyless]
[Table("lpointmois")]
public partial class Lpointmoi
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

    [Column("rubcod")]
    [StringLength(10)]
    public string? Rubcod { get; set; }

    [Column("rubtype")]
    [StringLength(10)]
    public string? Rubtype { get; set; }

    [Column("rublib")]
    [StringLength(30)]
    public string? Rublib { get; set; }

    [Column("vartype")]
    [StringLength(1)]
    public string? Vartype { get; set; }

    [Column("rubregime")]
    [StringLength(1)]
    public string? Rubregime { get; set; }

    [Column("rubnbr")]
    public double? Rubnbr { get; set; }

    [Column("empmat")]
    [StringLength(12)]
    public string? Empmat { get; set; }

    [Column("sitcod")]
    [StringLength(2)]
    public string? Sitcod { get; set; }
}
