using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using Microsoft.EntityFrameworkCore;

namespace ABRPOINT.Server.Models;

[Keyless]
[Table("repos")]
public partial class Repo : BaseEntity
{
    [Column("empcod")]
    [StringLength(12)]
    public string? Empcod { get; set; }

    [Column("predat", TypeName = "timestamp without time zone")]
    public DateTime? Predat { get; set; }

    [Column("soccod")]
    [StringLength(6)]
    public string? Soccod { get; set; }

    [Column("ordre")]
    public int? Ordre { get; set; }

    [Column("prerepos")]
    [StringLength(1)]
    public string? Prerepos { get; set; }

    [Column("motif")]
    [StringLength(255)]
    public string? Motif { get; set; }

    [Column("hredeb")]
    [StringLength(5)]
    public string? Hredeb { get; set; }

    [Column("hrefin")]
    [StringLength(5)]
    public string? Hrefin { get; set; }

    [Column("nbheure")]
    [StringLength(5)]
    public string? Nbheure { get; set; }
}
