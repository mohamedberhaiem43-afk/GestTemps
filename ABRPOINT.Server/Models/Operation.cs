using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using Microsoft.EntityFrameworkCore;

namespace ABRPOINT.Server.Models;

[Keyless]
[Table("operation")]
public partial class Operation : BaseEntity
{
    [Column("opecod")]
    [StringLength(10)]
    public string? Opecod { get; set; }

    [Column("soccod")]
    [StringLength(2)]
    public string? Soccod { get; set; }

    [Column("opelib")]
    [StringLength(100)]
    public string? Opelib { get; set; }

    [Column("opemethode")]
    [StringLength(100)]
    public string? Opemethode { get; set; }

    [Column("opetemps")]
    public double? Opetemps { get; set; }

    [Column("opepiece")]
    public double? Opepiece { get; set; }

    [Column("opetype")]
    [StringLength(1)]
    public string? Opetype { get; set; }
}
