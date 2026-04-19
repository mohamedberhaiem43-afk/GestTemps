using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using Microsoft.EntityFrameworkCore;

namespace ABRPOINT.Server.Models;

[Keyless]
[Table("mission")]
public partial class Mission : BaseEntity
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

    [Column("conmotif")]
    [StringLength(50)]
    public string? Conmotif { get; set; }

    [Column("consanc")]
    [StringLength(1)]
    public string? Consanc { get; set; }

    [Column("connbjour")]
    public float? Connbjour { get; set; }

    [Column("conref")]
    [StringLength(20)]
    public string? Conref { get; set; }

    [Column("contransp")]
    [StringLength(100)]
    public string? Contransp { get; set; }

    [Column("conmnt")]
    public double? Conmnt { get; set; }

    [Column("conmodep")]
    [StringLength(50)]
    public string? Conmodep { get; set; }

    [Column("conadrdep")]
    [StringLength(100)]
    public string? Conadrdep { get; set; }

    [Column("condest")]
    [StringLength(100)]
    public string? Condest { get; set; }

    [Column("conresp")]
    [StringLength(15)]
    public string? Conresp { get; set; }

    [Column("condepense")]
    [StringLength(100)]
    [Unicode(false)]
    public string? Condepense { get; set; }
}
