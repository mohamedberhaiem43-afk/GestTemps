using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using Microsoft.EntityFrameworkCore;

namespace ABRPOINT.Server.Models;

[Table("ville")]
public partial class Ville
{
    [Key]
    [Column("vilcod")]
    [StringLength(2)]
    public string Vilcod { get; set; }

    [Column("villib")]
    [StringLength(20)]
    public string? Villib { get; set; }
}
