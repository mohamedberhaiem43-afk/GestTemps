using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using Microsoft.EntityFrameworkCore;

namespace ABRPOINT.Server.Models;

[Keyless]
[Table("paquet")]
public partial class Paquet : BaseEntity
{
    [Column("num")]
    [StringLength(25)]
    public string? Num { get; set; }

    [Column("proj")]
    [StringLength(25)]
    public string? Proj { get; set; }

    [Column("soccod")]
    [StringLength(25)]
    public string? Soccod { get; set; }

    [Column("artbarre")]
    [StringLength(255)]
    public string? Artbarre { get; set; }

    [Column("artcod")]
    [StringLength(25)]
    public string? Artcod { get; set; }

    [Column("qtepaq")]
    public int? Qtepaq { get; set; }

    [Column("sitcod")]
    [StringLength(25)]
    public string? Sitcod { get; set; }

    [Column("date", TypeName = "timestamp without time zone")]
    public DateTime? Date { get; set; }

    [Column("qteproj")]
    [StringLength(255)]
    public string? Qteproj { get; set; }
}
