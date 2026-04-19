using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using Microsoft.EntityFrameworkCore;

namespace ABRPOINT.Server.Models;

[Keyless]
[Table("aide")]
public partial class Aide : BaseEntity
{
    [Column("modcod")]
    [StringLength(20)]
    public string? Modcod { get; set; }

    [Column("modzone")]
    [StringLength(20)]
    public string? Modzone { get; set; }

    [Column("modhelp")]
    public string? Modhelp { get; set; }
}
