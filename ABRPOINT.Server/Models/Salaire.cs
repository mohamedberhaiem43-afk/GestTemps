using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using Microsoft.EntityFrameworkCore;

namespace ABRPOINT.Server.Models;

[Keyless]
[Table("salaire")]
public partial class Salaire : BaseEntity
{
    [Column("empcod")]
    [StringLength(12)]
    public string? Empcod { get; set; }

    [Column("soccod")]
    [StringLength(4)]
    public string? Soccod { get; set; }

    [Column("salannee")]
    [StringLength(4)]
    public string? Salannee { get; set; }

    [Column("salmois")]
    [StringLength(2)]
    public string? Salmois { get; set; }

    [Column("saltit")]
    [StringLength(1)]
    public string? Saltit { get; set; }

    [Column("salmat")]
    [StringLength(12)]
    public string? Salmat { get; set; }

    [Column("sitcod")]
    [StringLength(2)]
    public string? Sitcod { get; set; }

    [Column("salacc")]
    public float? Salacc { get; set; }

    [Column("saldatac", TypeName = "timestamp without time zone")]
    public DateTime? Saldatac { get; set; }

    [Column("salmens")]
    public float? Salmens { get; set; }

    [Column("saldat", TypeName = "timestamp without time zone")]
    public DateTime? Saldat { get; set; }

    [Column("salreg")]
    [StringLength(1)]
    public string? Salreg { get; set; }

    [Column("salnbj")]
    public float? Salnbj { get; set; }

    [Column("saljfer")]
    public float? Saljfer { get; set; }

    [Column("salconge")]
    public float? Salconge { get; set; }

    [Column("salcsf")]
    public float? Salcsf { get; set; }

    [Column("salallait")]
    public float? Salallait { get; set; }

    [Column("saldep")]
    public float? Saldep { get; set; }

    [Column("salhs25")]
    public float? Salhs25 { get; set; }

    [Column("salhs50")]
    public float? Salhs50 { get; set; }

    [Column("salhs75")]
    public float? Salhs75 { get; set; }

    [Column("salhs100")]
    public float? Salhs100 { get; set; }

    [Column("salacc2")]
    public float? Salacc2 { get; set; }

    [Column("salnbh")]
    public float? Salnbh { get; set; }

    [Column("salabs")]
    public float? Salabs { get; set; }

    [Column("salnjabs")]
    public float? Salnjabs { get; set; }

    [Column("saljcpl")]
    public float? Saljcpl { get; set; }

    [Column("salacd")]
    public float? Salacd { get; set; }

    [Column("salsem")]
    public float? Salsem { get; set; }

    [Column("salhbg")]
    public float? Salhbg { get; set; }

    [Column("salnuit")]
    public float? Salnuit { get; set; }

    [Column("salret")]
    public float? Salret { get; set; }

    [Column("salssld")]
    public float? Salssld { get; set; }

    [Column("salmal")]
    public float? Salmal { get; set; }

    [Column("joudeb", TypeName = "timestamp without time zone")]
    public DateTime? Joudeb { get; set; }

    [Column("joufin", TypeName = "timestamp without time zone")]
    public DateTime? Joufin { get; set; }

    [Column("salpoint")]
    [StringLength(1)]
    public string? Salpoint { get; set; }

    [Column("saljnfer")]
    public float? Saljnfer { get; set; }

    [Column("saljfertrv")]
    public float? Saljfertrv { get; set; }

    [Column("salrnd")]
    public float? Salrnd { get; set; }

    [Column("salhfertrv")]
    public float? Salhfertrv { get; set; }

    [Column("salhfer2trv")]
    public float? Salhfer2trv { get; set; }

    [Column("salhimp")]
    public float? Salhimp { get; set; }

    [Column("salhreptrv")]
    public float? Salhreptrv { get; set; }

    [Column("saljreptrv")]
    public float? Saljreptrv { get; set; }

    [Column("salhfer")]
    public float? Salhfer { get; set; }

    [Column("salhabs")]
    public float? Salhabs { get; set; }

    [Column("salpanier")]
    public float? Salpanier { get; set; }

    [Column("saldouche")]
    public float? Saldouche { get; set; }
}
