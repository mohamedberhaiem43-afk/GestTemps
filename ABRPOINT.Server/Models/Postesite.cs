using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using Microsoft.EntityFrameworkCore;

namespace ABRPOINT.Server.Models;

[Keyless]
[Table("postesite")]
public partial class Postesite
{
    [Column("code")]
    [StringLength(10)]
    public string? Code { get; set; }

    [Column("nature")]
    [StringLength(1)]
    public string? Nature { get; set; }

    [Column("soccod")]
    [StringLength(10)]
    public string? Soccod { get; set; }

    [Column("sitcod")]
    [StringLength(10)]
    public string? Sitcod { get; set; }
}
