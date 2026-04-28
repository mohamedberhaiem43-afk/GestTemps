using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using Microsoft.EntityFrameworkCore;

namespace ABRPOINT.Server.Models;

[Table("ville")]
public partial class Ville : BaseEntity
{
    [Key]
    [Column("vilcod")]
    [StringLength(6)]
    public string Vilcod { get; set; }

    [Column("villib")]
    [StringLength(100)]
    public string? Villib { get; set; }
}
