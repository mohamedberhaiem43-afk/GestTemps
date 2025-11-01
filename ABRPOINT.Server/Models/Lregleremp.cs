using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using Microsoft.EntityFrameworkCore;

namespace ABRPOINT.Server.Models;

[Keyless]
[Table("lregleremp")]
public partial class Lregleremp
{
    [Column("ligne")]
    public int? Ligne { get; set; }

    [Column("cheordre")]
    [StringLength(10)]
    public string? Cheordre { get; set; }

    [Column("soccod")]
    [StringLength(2)]
    public string? Soccod { get; set; }

    [Column("chetype")]
    [StringLength(1)]
    public string? Chetype { get; set; }

    [Column("faccod")]
    [StringLength(15)]
    public string? Faccod { get; set; }

    [Column("codsite")]
    [StringLength(1)]
    public string? Codsite { get; set; }

    [Column("facreg")]
    public double? Facreg { get; set; }
}
