using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using Microsoft.EntityFrameworkCore;

namespace ABRPOINT.Server.Models;


[Table("ferier")]
[PrimaryKey("Soccod","Ferdate")]
public partial class Ferier : BaseEntity
{
    [Column("annee")]
    [StringLength(4)]
    public string? Annee { get; set; }

    [Column("soccod")]
    [StringLength(6)]
    public string? Soccod { get; set; }

    [Column("ferdate", TypeName = "datetime")]
    public DateTime? Ferdate { get; set; }

    [Column("fermotif")]
    [StringLength(20)]
    public string? Fermotif { get; set; }

    [Column("ferfixe")]
    [StringLength(1)]
    public string? Ferfixe { get; set; }

    [Column("fertype")]
    [StringLength(1)]
    public string? Fertype { get; set; }

    [Column("ferheure")]
    public float? Ferheure { get; set; }

    [Column("fernpaye")]
    [StringLength(1)]
    public string? Fernpaye { get; set; }

    [Column("fertrv", TypeName = "datetime")]
    public DateTime? Fertrv { get; set; }
}
