using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using Microsoft.EntityFrameworkCore;

namespace ABRPOINT.Server.Models;

[Keyless]
[Table("paieuser")]
public partial class Paieuser
{
    [Column("dircod")]
    [StringLength(15)]
    public string? Dircod { get; set; }

    [Column("uticod")]
    [StringLength(20)]
    public string? Uticod { get; set; }

    [Column("exercice")]
    [StringLength(4)]
    public string? Exercice { get; set; }
}
