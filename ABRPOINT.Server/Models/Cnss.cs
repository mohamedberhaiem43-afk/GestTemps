using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using Microsoft.EntityFrameworkCore;

namespace ABRPOINT.Server.Models;

[Keyless]
[Table("cnss")]
public partial class Cnss : BaseEntity
{
    [Column("cnscod")]
    [StringLength(2)]
    public string? Cnscod { get; set; }

    [Column("soccod")]
    [StringLength(4)]
    public string? Soccod { get; set; }

    [Column("cnslib")]
    [StringLength(30)]
    public string? Cnslib { get; set; }

    [Column("cnspat")]
    public float? Cnspat { get; set; }

    [Column("cnsemp")]
    public float? Cnsemp { get; set; }

    [Column("cnsirpp")]
    [StringLength(1)]
    public string? Cnsirpp { get; set; }

    [Column("accsoc")]
    public float? Accsoc { get; set; }

    [Column("accemp")]
    public float? Accemp { get; set; }

    [Column("cnstype")]
    [StringLength(1)]
    public string? Cnstype { get; set; }

    [Column("cnsexp")]
    [StringLength(10)]
    public string? Cnsexp { get; set; }
}
