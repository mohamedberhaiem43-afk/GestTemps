using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using Microsoft.EntityFrameworkCore;

namespace ABRPOINT.Server.Models;

[Keyless]
[Table("empcat")]
public partial class Empcat : BaseEntity
{
    [Column("soccod")]
    [StringLength(6)]
    public string? Soccod { get; set; }

    [Column("empcod")]
    [StringLength(12)]
    public string? Empcod { get; set; }

    [Column("catdeb", TypeName = "timestamp without time zone")]
    public DateTime? Catdeb { get; set; }

    [Column("catfin", TypeName = "timestamp without time zone")]
    public DateTime? Catfin { get; set; }

    [Column("catcod")]
    [StringLength(4)]
    public string? Catcod { get; set; }
}
