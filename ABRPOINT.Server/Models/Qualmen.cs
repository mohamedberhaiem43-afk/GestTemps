using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using Microsoft.EntityFrameworkCore;

namespace ABRPOINT.Server.Models;

[Keyless]
[Table("qualmens")]
public partial class Qualmen
{
    [Column("empcod")]
    [StringLength(10)]
    public string? Empcod { get; set; }

    [Column("soccod")]
    [StringLength(4)]
    public string? Soccod { get; set; }

    [Column("sitcod")]
    [StringLength(2)]
    public string? Sitcod { get; set; }

    [Column("annee")]
    [StringLength(4)]
    public string? Annee { get; set; }

    [Column("mois")]
    [StringLength(2)]
    public string? Mois { get; set; }

    [Column("rubcod")]
    [StringLength(10)]
    public string? Rubcod { get; set; }

    [Column("titcod")]
    [StringLength(1)]
    public string? Titcod { get; set; }

    [Column("montant")]
    public float? Montant { get; set; }

    [Column("rubsigne")]
    [StringLength(1)]
    public string? Rubsigne { get; set; }

    [Column("nbpcontrole")]
    public float? Nbpcontrole { get; set; }

    [Column("nbprefuse")]
    public float? Nbprefuse { get; set; }

    [Column("nbpaccepte")]
    public float? Nbpaccepte { get; set; }
}
