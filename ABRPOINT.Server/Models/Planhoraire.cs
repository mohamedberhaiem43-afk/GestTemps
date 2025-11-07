using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using Microsoft.EntityFrameworkCore;

namespace ABRPOINT.Server.Models;

[Keyless]
[Table("planhoraire")]
public partial class Planhoraire
{
    [Column("empcod")]
    [StringLength(12)]
    public string? Empcod { get; set; }

    [Column("soccod")]
    [StringLength(4)]
    public string? Soccod { get; set; }

    [Column("plandate", TypeName = "datetime")]
    public DateTime? Plandate { get; set; }

    [Column("plancat")]
    [StringLength(10)]
    public string? Plancat { get; set; }

    [Column("planposte")]
    [StringLength(10)]
    public string? Planposte { get; set; }

    [Column("planrepos")]
    [StringLength(1)]
    public string? Planrepos { get; set; }
}
