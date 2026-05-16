using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using Microsoft.EntityFrameworkCore;

namespace ABRPOINT.Server.Models;

[Keyless]
[Table("empaff")]
public partial class Empaff : BaseEntity
{
    [Column("empcod")]
    [StringLength(12)]
    public string? Empcod { get; set; }

    [Column("soccod")]
    [StringLength(6)]
    public string? Soccod { get; set; }

    [Column("ordre")]
    public int? Ordre { get; set; }

    [Column("emplib")]
    [StringLength(30)]
    public string? Emplib { get; set; }

    [Column("heuredeb")]
    public int? Heuredeb { get; set; }

    [Column("empmat")]
    [StringLength(6)]
    public string? Empmat { get; set; }

    [Column("heurefin")]
    public int? Heurefin { get; set; }

    [Column("affdate", TypeName = "timestamp without time zone")]
    public DateTime? Affdate { get; set; }

    [Column("empsexe")]
    [StringLength(1)]
    public string? Empsexe { get; set; }

    [Column("sercod")]
    [StringLength(4)]
    public string? Sercod { get; set; }

    [Column("sitcod")]
    [StringLength(2)]
    public string? Sitcod { get; set; }

    [Column("empdu", TypeName = "timestamp without time zone")]
    public DateTime? Empdu { get; set; }

    [Column("empfonc")]
    [StringLength(30)]
    public string? Empfonc { get; set; }

    [Column("empau", TypeName = "timestamp without time zone")]
    public DateTime? Empau { get; set; }

    [Column("empreg")]
    [StringLength(1)]
    public string? Empreg { get; set; }

    [Column("catcod")]
    [StringLength(2)]
    public string? Catcod { get; set; }

    [Column("socaff")]
    [StringLength(4)]
    public string? Socaff { get; set; }

    [Column("empnbp", TypeName = "real")]
    public float? Empnbp { get; set; }

    [Column("sitaff")]
    [StringLength(2)]
    public string? Sitaff { get; set; }

    [Column("foncod")]
    [StringLength(6)]
    public string? Foncod { get; set; }

    [Column("natcod")]
    [StringLength(4)]
    public string? Natcod { get; set; }

    [Column("quacod")]
    [StringLength(6)]
    public string? Quacod { get; set; }

    [Column("vilcod")]
    [StringLength(6)]
    public string? Vilcod { get; set; }

    [Column("empadr")]
    [StringLength(40)]
    public string? Empadr { get; set; }

    [Column("emptel")]
    [StringLength(20)]
    public string? Emptel { get; set; }

    [Column("empmob")]
    [StringLength(20)]
    public string? Empmob { get; set; }
}
