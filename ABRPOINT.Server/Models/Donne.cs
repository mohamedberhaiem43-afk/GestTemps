using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using Microsoft.EntityFrameworkCore;

namespace ABRPOINT.Server.Models;

[Keyless]
[Table("donne")]
public partial class Donne : BaseEntity
{
    [Column("doncod")]
    [StringLength(100)]
    public string? Doncod { get; set; }

    [Column("doncle1")]
    [StringLength(10)]
    public string? Doncle1 { get; set; }

    [Column("doncle2")]
    [StringLength(10)]
    public string? Doncle2 { get; set; }

    [Column("doncle3")]
    [StringLength(10)]
    public string? Doncle3 { get; set; }

    [Column("doncle4")]
    [StringLength(10)]
    public string? Doncle4 { get; set; }
}
