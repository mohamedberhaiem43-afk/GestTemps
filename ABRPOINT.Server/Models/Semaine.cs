using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using Microsoft.EntityFrameworkCore;

namespace ABRPOINT.Server.Models;

[Keyless]
[Table("semaine")]
public partial class Semaine : BaseEntity
{
    [Column("sitcod")]
    [StringLength(2)]
    public string? Sitcod { get; set; }

    [Column("soccod")]
    [StringLength(4)]
    public string? Soccod { get; set; }

    [Column("annee")]
    [StringLength(4)]
    public string? Annee { get; set; }

    [Column("semcod")]
    public int? Semcod { get; set; }

    [Column("semdeb", TypeName = "datetime")]
    public DateTime? Semdeb { get; set; }

    [Column("semfin", TypeName = "datetime")]
    public DateTime? Semfin { get; set; }

    [Column("semnbheure")]
    public float? Semnbheure { get; set; }

    [Column("semnbh1")]
    public float? Semnbh1 { get; set; }

    [Column("semtaux1")]
    public float? Semtaux1 { get; set; }

    [Column("semnbh2")]
    public float? Semnbh2 { get; set; }

    [Column("semtaux2")]
    public float? Semtaux2 { get; set; }

    [Column("semtaux3")]
    public float? Semtaux3 { get; set; }

    [Column("semconge")]
    public float? Semconge { get; set; }

    [Column("semferie")]
    public float? Semferie { get; set; }

    [Column("semrepos")]
    public float? Semrepos { get; set; }

    [Column("semhjdemi")]
    public float? Semhjdemi { get; set; }
}
