using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using Microsoft.EntityFrameworkCore;

namespace ABRPOINT.Server.Models;

[Table("demconge")]
public partial class Demconge
{
    [Column("concod")]
    [StringLength(10)]
    public string? Concod { get; set; }
    [Column("soccod")]
    [StringLength(2)]
    public string? Soccod { get; set; }

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

    [Column("conamdep")]
    [StringLength(1)]
    public string? Conamdep { get; set; }

    [Column("conret", TypeName = "datetime")]
    public DateTime? Conret { get; set; }

    [Column("conamret")]
    [StringLength(1)]
    public string? Conamret { get; set; }

    [Column("abscod")]
    [StringLength(6)]
    public string? Abscod { get; set; }

    [Column("conadr")]
    [StringLength(50)]
    public string? Conadr { get; set; }

    [Column("contel")]
    [StringLength(10)]
    public string? Contel { get; set; }

    [Column("condg")]
    [StringLength(1)]
    public string? Condg { get; set; }

    [Column("conrefus")]
    [StringLength(20)]
    public string? Conrefus { get; set; }

    [Column("connbjour")]
    public float? Connbjour { get; set; }

    [Column("conref")]
    [StringLength(20)]
    public string? Conref { get; set; }

    [Column("consolde")]
    public float? Consolde { get; set; }
}
