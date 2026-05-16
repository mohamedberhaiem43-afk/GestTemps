using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using Microsoft.EntityFrameworkCore;

namespace ABRPOINT.Server.Models;

[Keyless]
[Table("suivemp")]
public partial class Suivemp : BaseEntity
{
    [Column("empcod")]
    [StringLength(20)]
    public string? Empcod { get; set; }

    [Column("date", TypeName = "timestamp without time zone")]
    public DateTime? Date { get; set; }

    [Column("soccod")]
    [StringLength(20)]
    public string? Soccod { get; set; }

    [Column("paqcod")]
    [StringLength(20)]
    public string? Paqcod { get; set; }

    [Column("presence")]
    public int? Presence { get; set; }

    [Column("panne")]
    public int? Panne { get; set; }

    [Column("temprod")]
    [StringLength(10)]
    public string? Temprod { get; set; }

    [Column("rend")]
    [StringLength(10)]
    public string? Rend { get; set; }

    [Column("mois")]
    public int? Mois { get; set; }

    [Column("annee")]
    public int? Annee { get; set; }
}
