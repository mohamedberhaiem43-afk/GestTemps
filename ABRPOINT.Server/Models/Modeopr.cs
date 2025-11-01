using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using Microsoft.EntityFrameworkCore;

namespace ABRPOINT.Server.Models;

[Keyless]
[Table("modeopr")]
public partial class Modeopr
{
    [Column("artcod")]
    [StringLength(10)]
    public string? Artcod { get; set; }

    [Column("soccod")]
    [StringLength(2)]
    public string? Soccod { get; set; }

    [Column("opecod")]
    [StringLength(10)]
    public string? Opecod { get; set; }

    [Column("opeordre")]
    public int? Opeordre { get; set; }

    [Column("artqte")]
    public double? Artqte { get; set; }

    [Column("arttemps")]
    public double? Arttemps { get; set; }

    [Column("artmethode")]
    [StringLength(30)]
    public string? Artmethode { get; set; }
}
