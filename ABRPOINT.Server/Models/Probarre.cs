using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using Microsoft.EntityFrameworkCore;

namespace ABRPOINT.Server.Models;

[Keyless]
[Table("probarre")]
public partial class Probarre : BaseEntity
{
    [Column("artcod")]
    [StringLength(20)]
    public string? Artcod { get; set; }

    [Column("clicod")]
    [StringLength(12)]
    public string? Clicod { get; set; }

    [Column("arttaille")]
    [StringLength(20)]
    public string? Arttaille { get; set; }

    [Column("artclr")]
    [StringLength(10)]
    public string? Artclr { get; set; }

    [Column("soccod")]
    [StringLength(2)]
    public string? Soccod { get; set; }

    [Column("qte")]
    public int? Qte { get; set; }

    [Column("artean")]
    [StringLength(20)]
    public string? Artean { get; set; }

    [Column("artref")]
    [StringLength(20)]
    public string? Artref { get; set; }

    [Column("artlib")]
    [StringLength(250)]
    public string? Artlib { get; set; }

    [Column("artprix")]
    public double? Artprix { get; set; }

    [Column("artcodac")]
    [StringLength(255)]
    public string? Artcodac { get; set; }

    [Column("gender")]
    [StringLength(10)]
    public string? Gender { get; set; }
}
