using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using Microsoft.EntityFrameworkCore;

namespace ABRPOINT.Server.Models;

[Keyless]
[Table("emprnd")]
public partial class Emprnd : BaseEntity
{
    [Column("soccod")]
    [StringLength(6)]
    public string? Soccod { get; set; }

    [Column("empcod")]
    [StringLength(12)]
    public string? Empcod { get; set; }

    [Column("sitcod")]
    [StringLength(2)]
    public string? Sitcod { get; set; }

    [Column("rnddate")]
    [StringLength(50)]
    public string? Rnddate { get; set; }

    [Column("annee")]
    [StringLength(4)]
    public string? Annee { get; set; }

    [Column("mois")]
    [StringLength(2)]
    public string? Mois { get; set; }

    [Column("rubcod")]
    [StringLength(12)]
    public string? Rubcod { get; set; }

    [Column("rndnote")]
    public double? Rndnote { get; set; }

    [Column("rndvaleur")]
    public double? Rndvaleur { get; set; }

    [Column("nbhprod")]
    public double? Nbhprod { get; set; }

    [Column("nbhpre")]
    public double? Nbhpre { get; set; }
}
