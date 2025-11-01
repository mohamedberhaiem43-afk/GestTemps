using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using Microsoft.EntityFrameworkCore;

namespace ABRPOINT.Server.Models;

[Keyless]
[Table("parpostsite")]
public partial class Parpostsite
{
    [Column("codposte")]
    [StringLength(2)]
    public string? Codposte { get; set; }

    [Column("sitcod")]
    [StringLength(6)]
    public string? Sitcod { get; set; }

    [Column("ordre")]
    public int? Ordre { get; set; }

    [Column("posjour")]
    [StringLength(15)]
    public string? Posjour { get; set; }

    [Column("poshredeb")]
    [StringLength(5)]
    public string? Poshredeb { get; set; }

    [Column("poshrefin")]
    [StringLength(5)]
    public string? Poshrefin { get; set; }

    [Column("postaux")]
    public float? Postaux { get; set; }

    [Column("postxrepos")]
    public float? Postxrepos { get; set; }
}
