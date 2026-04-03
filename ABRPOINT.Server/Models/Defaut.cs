using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using Microsoft.EntityFrameworkCore;

namespace ABRPOINT.Server.Models;

[Keyless]
[Table("defaut")]
public partial class Defaut
{
    [Column("defcod")]
    [StringLength(3)]
    public string? Defcod { get; set; }

    [Column("deflib")]
    [StringLength(50)]
    public string? Deflib { get; set; }
}
