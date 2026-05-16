using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using Microsoft.EntityFrameworkCore;

namespace ABRPOINT.Server.Models;

[Keyless]
[Table("cloture")]
public partial class Cloture : BaseEntity
{
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

    [Column("titcod")]
    [StringLength(1)]
    public string? Titcod { get; set; }

    [Column("clodat", TypeName = "timestamp without time zone")]
    public DateTime? Clodat { get; set; }

    [Column("clousr")]
    [StringLength(20)]
    public string? Clousr { get; set; }
}
