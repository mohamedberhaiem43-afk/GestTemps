using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using Microsoft.EntityFrameworkCore;

namespace ABRPOINT.Server.Models;

[Keyless]
[Table("lpret")]
public partial class Lpret : BaseEntity
{
    [Column("precod")]
    [StringLength(10)]
    public string? Precod { get; set; }

    [Column("soccod")]
    [StringLength(4)]
    public string? Soccod { get; set; }

    [Column("preannee")]
    [StringLength(4)]
    public string? Preannee { get; set; }

    [Column("premois")]
    [StringLength(2)]
    public string? Premois { get; set; }

    [Column("titcod")]
    [StringLength(1)]
    public string? Titcod { get; set; }

    [Column("premnt")]
    public float? Premnt { get; set; }

    [Column("fchannee")]
    [StringLength(4)]
    public string? Fchannee { get; set; }

    [Column("fchmois")]
    [StringLength(2)]
    public string? Fchmois { get; set; }

    [Column("fchtit")]
    [StringLength(1)]
    public string? Fchtit { get; set; }
}
