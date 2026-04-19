using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using Microsoft.EntityFrameworkCore;

namespace ABRPOINT.Server.Models;

[Keyless]
[Table("module")]
public partial class Module : BaseEntity
{
    [Column("modcod")]
    [StringLength(15)]
    public string? Modcod { get; set; }

    [Column("modlib")]
    [StringLength(50)]
    public string? Modlib { get; set; }

    [Column("appcod")]
    [StringLength(3)]
    public string? Appcod { get; set; }

    [Column("modsais")]
    [StringLength(1)]
    public string? Modsais { get; set; }

    [Column("modupd")]
    [StringLength(1)]
    public string? Modupd { get; set; }

    [Column("modsupp")]
    [StringLength(1)]
    public string? Modsupp { get; set; }

    [Column("modconsult")]
    [StringLength(1)]
    public string? Modconsult { get; set; }

    [Column("description")]
    [StringLength(50)]
    public string? Description { get; set; }
}
