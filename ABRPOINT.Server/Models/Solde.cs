using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using Microsoft.EntityFrameworkCore;

namespace ABRPOINT.Server.Models;

[PrimaryKey("Empcod", "Soccod")]
[Table("solde")]
public partial class Solde : BaseEntity
{
    [Required]
    [Key]
    [Column("empcod")]
    [StringLength(12)]
    public string Empcod { get; set; } = null!;
    [Required]
    [Key]
    [Column("soccod")]
    [StringLength(4)]
    public string Soccod { get; set; } = null!;

    [Column("annee")]
    [StringLength(4)]
    public string? Annee { get; set; }

    [Column("conge")]
    public float? Conge { get; set; }

    [Column("empconge")]
    public float? Empconge { get; set; }
}
