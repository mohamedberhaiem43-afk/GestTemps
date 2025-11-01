using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using Microsoft.EntityFrameworkCore;

namespace ABRPOINT.Server.Models;

[Table("allaitement")]
[PrimaryKey("Concod","Soccod")]
public partial class Allaitement
{
    [Required]
    [Key]
    [Column("concod")]
    [StringLength(10)]
    public string Concod { get; set; } = null!;
    [Required]
    [Key]
    [Column("soccod")]
    [StringLength(2)]
    public string Soccod { get; set; } = null!;

    [Column("empcod")]
    [StringLength(12)]
    public string? Empcod { get; set; }

    [Column("condat", TypeName = "datetime")]
    public DateTime? Condat { get; set; }

    [Column("conjour")]
    [StringLength(1)]
    public string? Conjour { get; set; }

    [Column("condep", TypeName = "datetime")]
    public DateTime? Condep { get; set; }

    [Column("conret", TypeName = "datetime")]
    public DateTime? Conret { get; set; }

    [Column("lundi")]
    public float? Lundi { get; set; }

    [Column("mardi")]
    public float? Mardi { get; set; }

    [Column("mercredi")]
    public float? Mercredi { get; set; }

    [Column("jeudi")]
    public float? Jeudi { get; set; }

    [Column("vendredi")]
    public float? Vendredi { get; set; }

    [Column("samedi")]
    public float? Samedi { get; set; }

    [Column("dimanche")]
    public float? Dimanche { get; set; }
}
