using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using Microsoft.EntityFrameworkCore;

namespace ABRPOINT.Server.Models;

[PrimaryKey("Empcod", "Soccod")]
[Table("empchoisie")]
public partial class Empchoisie : BaseEntity
{
    [Key]
    [Column("empcod")]
    [StringLength(12)]
    public string Empcod { get; set; } = null!;

    [Key]
    [Column("soccod")]
    [StringLength(6)]
    public string Soccod { get; set; } = null!;

    [Column("uticod")]
    [StringLength(20)]
    public string? Uticod { get; set; }

    [Column("emplib")]
    [StringLength(30)]
    public string? Emplib { get; set; }
}
