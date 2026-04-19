using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using Microsoft.EntityFrameworkCore;

namespace ABRPOINT.Server.Models;

[Keyless]
[Table("pointsemainej")]
public partial class Pointsemainej : BaseEntity
{
    [Column("modcod")]
    [StringLength(20)]
    public string? Modcod { get; set; }

    [Column("uticod")]
    [StringLength(20)]
    public string? Uticod { get; set; }

    [Column("soccod")]
    [StringLength(10)]
    public string? Soccod { get; set; }

    [Column("jours")]
    public float? Jours { get; set; }

    [Column("annee")]
    [StringLength(4)]
    public string? Annee { get; set; }

    [Column("mois")]
    [StringLength(2)]
    public string? Mois { get; set; }

    [Column("semaine1")]
    [StringLength(8)]
    public string? Semaine1 { get; set; }

    [Column("semaine2")]
    [StringLength(8)]
    public string? Semaine2 { get; set; }

    [Column("semaine3")]
    [StringLength(8)]
    public string? Semaine3 { get; set; }

    [Column("semaine4")]
    [StringLength(8)]
    public string? Semaine4 { get; set; }

    [Column("semaine5")]
    [StringLength(8)]
    public string? Semaine5 { get; set; }

    [Column("semaine6")]
    [StringLength(8)]
    public string? Semaine6 { get; set; }

    [Column("totsem")]
    [StringLength(8)]
    public string? Totsem { get; set; }

    [Column("caltype")]
    [StringLength(10)]
    public string? Caltype { get; set; }

    [Column("semaine1d", TypeName = "datetime")]
    public DateTime? Semaine1d { get; set; }

    [Column("semaine2d", TypeName = "datetime")]
    public DateTime? Semaine2d { get; set; }

    [Column("semaine3d", TypeName = "datetime")]
    public DateTime? Semaine3d { get; set; }

    [Column("semaine4d", TypeName = "datetime")]
    public DateTime? Semaine4d { get; set; }

    [Column("semaine5d", TypeName = "datetime")]
    public DateTime? Semaine5d { get; set; }

    [Column("semaine6d", TypeName = "datetime")]
    public DateTime? Semaine6d { get; set; }

    [Column("semaine6f", TypeName = "datetime")]
    public DateTime? Semaine6f { get; set; }

    [Column("semaine1n")]
    public float? Semaine1n { get; set; }

    [Column("semaine2n")]
    public float? Semaine2n { get; set; }

    [Column("semaine3n")]
    public float? Semaine3n { get; set; }

    [Column("semaine4n")]
    public float? Semaine4n { get; set; }

    [Column("semaine5n")]
    public float? Semaine5n { get; set; }

    [Column("semaine6n")]
    public float? Semaine6n { get; set; }
}
