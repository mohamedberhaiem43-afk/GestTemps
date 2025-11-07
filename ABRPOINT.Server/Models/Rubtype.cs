using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using Microsoft.EntityFrameworkCore;

namespace ABRPOINT.Server.Models;

[Keyless]
[Table("rubtype")]
public partial class Rubtype
{
    [Column("rubtype")]
    [StringLength(10)]
    public string? Rubtype1 { get; set; }

    [Column("rublib")]
    [StringLength(50)]
    public string? Rublib { get; set; }
}
