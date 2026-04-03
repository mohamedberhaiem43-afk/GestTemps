using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using Microsoft.EntityFrameworkCore;

namespace ABRPOINT.Server.Models;

[Keyless]
[Table("coltable")]
public partial class Coltable
{
    [Column("latable")]
    [StringLength(20)]
    public string? Latable { get; set; }

    [Column("champs")]
    [StringLength(20)]
    public string? Champs { get; set; }

    [Column("ordre")]
    public int? Ordre { get; set; }

    [Column("typech")]
    [StringLength(1)]
    public string? Typech { get; set; }

    [Column("taille")]
    public int? Taille { get; set; }

    [StringLength(50)]
    public string? Description { get; set; }

    [Column("tablelier")]
    [StringLength(20)]
    public string? Tablelier { get; set; }

    [Column("editer")]
    [StringLength(1)]
    public string? Editer { get; set; }

    [StringLength(30)]
    public string? Abréviation { get; set; }
}
