using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using Microsoft.EntityFrameworkCore;

namespace ABRPOINT.Server.Models;

[Keyless]
[Table("avance")]
public partial class Avance : BaseEntity
{
    [Column("empcod")]
    [StringLength(12)]
    public string? Empcod { get; set; }

    [Column("soccod")]
    [StringLength(6)]
    public string? Soccod { get; set; }

    [Column("sitcod")]
    [StringLength(2)]
    public string? Sitcod { get; set; }

    [Column("annee")]
    [StringLength(4)]
    public string? Annee { get; set; }

    [Column("mois")]
    [StringLength(2)]
    public string? Mois { get; set; }

    [Column("niveau")]
    [StringLength(1)]
    public string? Niveau { get; set; }

    [Column("titcod")]
    [StringLength(1)]
    public string? Titcod { get; set; }

    [Column("montant")]
    public float? Montant { get; set; }
    [ForeignKey("Empcod, Soccod, Sitcod")]
    public virtual Employe? Employe { get; set; }

}
