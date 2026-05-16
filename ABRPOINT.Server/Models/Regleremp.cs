using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using Microsoft.EntityFrameworkCore;

namespace ABRPOINT.Server.Models;

[Keyless]
[Table("regleremp")]
public partial class Regleremp : BaseEntity
{
    [Column("regordre")]
    [StringLength(10)]
    public string? Regordre { get; set; }

    [Column("soccod")]
    [StringLength(2)]
    public string? Soccod { get; set; }

    [Column("sitcod")]
    [StringLength(4)]
    public string? Sitcod { get; set; }

    [Column("empcod")]
    [StringLength(12)]
    public string? Empcod { get; set; }

    [Column("idamortis")]
    public int? Idamortis { get; set; }

    [Column("nopret")]
    public int? Nopret { get; set; }

    [Column("datecheance", TypeName = "timestamp without time zone")]
    public DateTime? Datecheance { get; set; }

    [Column("pretmnt")]
    public int? Pretmnt { get; set; }

    [Column("regech", TypeName = "timestamp without time zone")]
    public DateTime? Regech { get; set; }

    [Column("regdat", TypeName = "timestamp without time zone")]
    public DateTime? Regdat { get; set; }

    [Column("regmnt")]
    public double? Regmnt { get; set; }

    [Column("regref")]
    [StringLength(20)]
    public string? Regref { get; set; }

    [Column("regtype")]
    [StringLength(1)]
    public string? Regtype { get; set; }

    [Column("regtit")]
    [StringLength(1)]
    public string? Regtit { get; set; }

    [Column("reglib")]
    [StringLength(20)]
    public string? Reglib { get; set; }
}
