using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using Microsoft.EntityFrameworkCore;

namespace ABRPOINT.Server.Models;

[Keyless]
[Table("lferier")]
public partial class Lferier
{
    [Column("dircod")]
    [StringLength(4)]
    public string? Dircod { get; set; }

    [Column("soccod")]
    [StringLength(6)]
    public string? Soccod { get; set; }

    [Column("ferdate", TypeName = "datetime")]
    public DateTime? Ferdate { get; set; }

    [Column("fertype")]
    [StringLength(1)]
    public string? Fertype { get; set; }
}
