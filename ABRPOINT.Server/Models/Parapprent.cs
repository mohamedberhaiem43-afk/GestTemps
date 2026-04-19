using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using Microsoft.EntityFrameworkCore;

namespace ABRPOINT.Server.Models;

[Keyless]
[Table("parapprent")]
public partial class Parapprent : BaseEntity
{
    [Column("soccod")]
    [StringLength(4)]
    public string? Soccod { get; set; }

    [Column("parmois")]
    public int? Parmois { get; set; }

    [Column("partaux")]
    public float? Partaux { get; set; }

    [Column("parmnt")]
    public double? Parmnt { get; set; }

    [Column("parrub")]
    [StringLength(30)]
    public string? Parrub { get; set; }
}
