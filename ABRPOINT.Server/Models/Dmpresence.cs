using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using Microsoft.EntityFrameworkCore;

namespace ABRPOINT.Server.Models;

[Keyless]
[Table("dmpresence")]
public partial class Dmpresence : BaseEntity
{
    [Column("empcod")]
    [StringLength(12)]
    public string? Empcod { get; set; }

    [Column("soccod")]
    [StringLength(6)]
    public string? Soccod { get; set; }

    [Column("dmdat", TypeName = "timestamp without time zone")]
    public DateTime? Dmdat { get; set; }

    [Column("ordre")]
    public int? Ordre { get; set; }

    [Column("dmpnt")]
    [StringLength(4)]
    public string? Dmpnt { get; set; }

    [Column("dmhre", TypeName = "timestamp without time zone")]
    public DateTime? Dmhre { get; set; }

    [Column("dmsem")]
    public int? Dmsem { get; set; }

    [Column("dmlue")]
    [StringLength(1)]
    public string? Dmlue { get; set; }

    [Column("dmtype")]
    [StringLength(1)]
    public string? Dmtype { get; set; }
}
