using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using Microsoft.EntityFrameworkCore;

namespace ABRPOINT.Server.Models;

[Keyless]
[Table("rendjour")]
public partial class Rendjour : BaseEntity
{
    [Column("empcod")]
    [StringLength(12)]
    public string? Empcod { get; set; }

    [Column("rnddate", TypeName = "datetime")]
    public DateTime? Rnddate { get; set; }

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

    [Column("totpre")]
    public double? Totpre { get; set; }

    [Column("artqte")]
    public double? Artqte { get; set; }

    [Column("rndtemps")]
    public double? Rndtemps { get; set; }

    [Column("rndprod")]
    public double? Rndprod { get; set; }

    [Column("rndpre")]
    public double? Rndpre { get; set; }

    [Column("artmethode")]
    [StringLength(30)]
    public string? Artmethode { get; set; }
}
