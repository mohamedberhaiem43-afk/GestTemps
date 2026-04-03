using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using Microsoft.EntityFrameworkCore;

namespace ABRPOINT.Server.Models;

[Keyless]
[Table("titre")]
public partial class Titre
{
    [Column("titcod")]
    [StringLength(1)]
    public string? Titcod { get; set; }

    [Column("soccod")]
    [StringLength(4)]
    public string? Soccod { get; set; }

    [Column("titlib")]
    [StringLength(30)]
    public string? Titlib { get; set; }

    [Column("titsens")]
    [StringLength(1)]
    public string? Titsens { get; set; }

    [Column("titarrondi")]
    [StringLength(1)]
    public string? Titarrondi { get; set; }

    [Column("tittype")]
    [StringLength(1)]
    public string? Tittype { get; set; }
}
