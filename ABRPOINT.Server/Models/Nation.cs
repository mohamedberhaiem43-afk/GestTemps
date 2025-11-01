using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using Microsoft.EntityFrameworkCore;

namespace ABRPOINT.Server.Models;

[Table("nation")]
public partial class Nation
{
    [Key]
    [Column("natcod")]
    [StringLength(3)]
    public string? Natcod { get; set; }

    [Column("natlib")]
    [StringLength(20)]
    public string? Natlib { get; set; }
}
