using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using Microsoft.EntityFrameworkCore;

namespace ABRPOINT.Server.Models;

[Table("section")]
public partial class Section : BaseEntity
{
    [Column("seccod")]
    [StringLength(10)]
    public string? Seccod { get; set; }

    [Column("soccod")]
    [StringLength(6)]
    public string? Soccod { get; set; }

    [Column("seclib")]
    [StringLength(30)]
    public string? Seclib { get; set; }

    [Column("sectype")]
    [StringLength(10)]
    public string? Sectype { get; set; }

    [Column("secemail")]
    [StringLength(256)]
    public string? Secemail { get; set; }

    [Column("effectif")]
    public int? Effectif { get; set; }
}
