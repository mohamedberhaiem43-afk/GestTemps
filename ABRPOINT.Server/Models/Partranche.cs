using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using Microsoft.EntityFrameworkCore;

namespace ABRPOINT.Server.Models;

[Table("partranche")]
[PrimaryKey("Soccod","Empreg")]
public partial class Partranche
{
    [Column("soccod")]
    [StringLength(6)]
    public string? Soccod { get; set; }

    [Column("ordre")]
    public int? Ordre { get; set; }

    [Column("caltype")]
    [StringLength(6)]
    public string? Caltype { get; set; }

    [Column("empreg")]
    [StringLength(1)]
    public string? Empreg { get; set; }

    [Column("partranche1")]
    public float? Partranche1 { get; set; }

    [Column("partaux1")]
    public float? Partaux1 { get; set; }

    [Column("partranche2")]
    public float? Partranche2 { get; set; }

    [Column("partaux2")]
    public float? Partaux2 { get; set; }
}
