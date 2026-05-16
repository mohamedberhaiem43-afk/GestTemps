using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using Microsoft.EntityFrameworkCore;

namespace ABRPOINT.Server.Models;

[Keyless]
[Table("lplanhoraire")]
public partial class Lplanhoraire : BaseEntity
{
    [Column("plandate", TypeName = "timestamp without time zone")]
    public DateTime? Plandate { get; set; }

    [Column("soccod")]
    [StringLength(4)]
    public string? Soccod { get; set; }

    [Column("planan")]
    [StringLength(4)]
    public string? Planan { get; set; }

    [Column("planmois")]
    [StringLength(2)]
    public string? Planmois { get; set; }

    [Column("plansem")]
    public int? Plansem { get; set; }

    [Column("plancat")]
    [StringLength(10)]
    public string? Plancat { get; set; }

    [Column("planposte")]
    [StringLength(10)]
    public string? Planposte { get; set; }

    [Column("plantrav")]
    public float? Plantrav { get; set; }

    [Column("plancol")]
    public int? Plancol { get; set; }

    [Column("planrow")]
    public int? Planrow { get; set; }

    [Column("motif")]
    [StringLength(20)]
    public string? Motif { get; set; }

    [Column("payer")]
    [StringLength(1)]
    public string? Payer { get; set; }
}
