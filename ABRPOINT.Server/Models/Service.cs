using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using Microsoft.EntityFrameworkCore;

namespace ABRPOINT.Server.Models;

[Table("service")]
public partial class Service
{
    [Column("sercod")]
    [StringLength(4)]
    public string? Sercod { get; set; }

    [Column("soccod")]
    [StringLength(6)]
    public string? Soccod { get; set; }

    [Column("serlib")]
    [StringLength(30)]
    public string? Serlib { get; set; }

    [Column("serloc")]
    [StringLength(1)]
    public string? Serloc { get; set; }

    [Column("effectif")]
    public int? Effectif { get; set; }
}
