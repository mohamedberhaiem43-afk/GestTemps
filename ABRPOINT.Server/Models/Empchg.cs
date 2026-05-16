using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using Microsoft.EntityFrameworkCore;

namespace ABRPOINT.Server.Models;

[Keyless]
[Table("empchg")]
public partial class Empchg : BaseEntity
{
    [Column("empcod")]
    [StringLength(12)]
    public string? Empcod { get; set; }

    [Column("empref")]
    [StringLength(12)]
    public string? Empref { get; set; }

    [Column("empdat", TypeName = "timestamp without time zone")]
    public DateTime? Empdat { get; set; }
}
