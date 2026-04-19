using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using Microsoft.EntityFrameworkCore;

namespace ABRPOINT.Server.Models;

[Keyless]
[Table("opbarre")]
public partial class Opbarre : BaseEntity
{
    [Column("codbarre")]
    [StringLength(255)]
    public string? Codbarre { get; set; }

    [Column("soccod")]
    [StringLength(25)]
    public string? Soccod { get; set; }

    [Column("proj")]
    [StringLength(25)]
    public string? Proj { get; set; }

    [Column("numpaq")]
    [StringLength(25)]
    public string? Numpaq { get; set; }

    [Column("opcod")]
    [StringLength(25)]
    public string? Opcod { get; set; }

    [Column("phcod")]
    [StringLength(25)]
    public string? Phcod { get; set; }

    [Column("opduree")]
    [StringLength(25)]
    public string? Opduree { get; set; }

    [Column("unite")]
    [StringLength(255)]
    public string? Unite { get; set; }

    [Column("phtype")]
    [StringLength(255)]
    public string? Phtype { get; set; }

    [Column("sitcod")]
    [StringLength(2)]
    public string? Sitcod { get; set; }
}
