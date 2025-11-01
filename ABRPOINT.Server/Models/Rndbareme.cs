using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using Microsoft.EntityFrameworkCore;

namespace ABRPOINT.Server.Models;

[Keyless]
[Table("rndbareme")]
public partial class Rndbareme
{
    [Column("soccod")]
    [StringLength(10)]
    public string? Soccod { get; set; }

    [Column("bartype")]
    [StringLength(1)]
    public string? Bartype { get; set; }

    [Column("ordre")]
    public int? Ordre { get; set; }

    [Column("barinf")]
    public double? Barinf { get; set; }

    [Column("barsup")]
    public double? Barsup { get; set; }

    [Column("barabs")]
    [StringLength(1)]
    public string? Barabs { get; set; }

    [Column("barrub")]
    [StringLength(1)]
    public string? Barrub { get; set; }

    [Column("barmnt")]
    public double? Barmnt { get; set; }

    [Column("barpabs")]
    public double? Barpabs { get; set; }
}
