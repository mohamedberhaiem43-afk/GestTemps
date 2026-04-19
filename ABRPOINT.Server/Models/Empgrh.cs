using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using Microsoft.EntityFrameworkCore;

namespace ABRPOINT.Server.Models;

[Keyless]
[Table("empgrh")]
public partial class Empgrh : BaseEntity
{
    [Column("empcod")]
    [StringLength(12)]
    public string? Empcod { get; set; }

    [Column("soccod")]
    [StringLength(12)]
    public string? Soccod { get; set; }

    [Column("emplib")]
    [StringLength(100)]
    public string? Emplib { get; set; }

    [Column("soclib")]
    [StringLength(100)]
    public string? Soclib { get; set; }
}
