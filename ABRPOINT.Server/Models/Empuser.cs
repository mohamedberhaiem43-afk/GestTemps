using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using Microsoft.EntityFrameworkCore;

namespace ABRPOINT.Server.Models;

[Keyless]
[Table("empuser")]
public partial class Empuser
{
    [Column("ntable")]
    [StringLength(20)]
    public string? Ntable { get; set; }

    [Column("nchamps")]
    [StringLength(20)]
    public string? Nchamps { get; set; }

    [Column("paie")]
    [StringLength(1)]
    public string? Paie { get; set; }

    [Column("point")]
    [StringLength(1)]
    public string? Point { get; set; }
}
