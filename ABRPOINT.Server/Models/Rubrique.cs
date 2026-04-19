using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using Microsoft.EntityFrameworkCore;

namespace ABRPOINT.Server.Models;

[PrimaryKey("Rubcod","Soccod")]
[Table("rubrique")]
public partial class Rubrique : BaseEntity
{
    [Column("rubcod")]
    [StringLength(10)]
    public string Rubcod { get; set; }

    [Column("soccod")]
    [StringLength(4)]
    public string Soccod { get; set; }

    [Column("rubtype")]
    [StringLength(5)]
    public string? Rubtype { get; set; }

    [Column("rublib")]
    [StringLength(30)]
    public string? Rublib { get; set; }

    [Column("rubregime")]
    [StringLength(1)]
    public string? Rubregime { get; set; }

    [Column("vartype")]
    [StringLength(5)]
    public string? Vartype { get; set; }

    [Column("rubunite")]
    [StringLength(1)]
    public string? Rubunite { get; set; }

    [Column("rubtaux")]
    public float? Rubtaux { get; set; }
}
