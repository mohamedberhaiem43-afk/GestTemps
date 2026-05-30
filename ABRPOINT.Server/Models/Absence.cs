using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using Microsoft.EntityFrameworkCore;

namespace ABRPOINT.Server.Models;

[Table("absence")]
[PrimaryKey("Abscod", "Soccod")]
public partial class Absence : BaseEntity
{
    [Required]
    [Column("abscod")]
    [StringLength(4)]
    public string? Abscod { get; set; }
    [Required]
    [Column("soccod")]
    [StringLength(6)]
    public string? Soccod { get; set; }

    [Column("abslib")]
    [StringLength(60)]
    public string? Abslib { get; set; }

    [Column("abscng")]
    [StringLength(1)]
    public string? Abscng { get; set; }

    [Column("abssanc")]
    [StringLength(1)]
    public string? Abssanc { get; set; }

    [Column("abspayer")]
    [StringLength(1)]
    public string? Abspayer { get; set; }

    [Column("absaut")]
    public int? Absaut { get; set; }

    [Column("abspar")]
    [StringLength(1)]
    public string? Abspar { get; set; }

    [Column("absrepos")]
    [StringLength(1)]
    public string? Absrepos { get; set; }

    [Column("rubcod")]
    [StringLength(12)]
    public string? Rubcod { get; set; }

    [Column("absferier")]
    [StringLength(1)]
    public string? Absferier { get; set; }

    [Column("absunite")]
    [StringLength(1)]
    public string? Absunite { get; set; }

    /// <summary>
    /// Ce type de congé peut-il alimenter le CET (Compte Épargne Temps) ? "1" = oui.
    /// Configuré par l'admin sur la fiche du type d'absence. Cf. alimentation CET salarié.
    /// </summary>
    [Column("abspeutcet")]
    [StringLength(1)]
    public string? Abspeutcet { get; set; }

    /// <summary>
    /// Plafond annuel (en jours) transférable vers le CET depuis ce type de congé.
    /// Null/0 = pas de plafond spécifique (la validation se fait alors sur le solde disponible).
    /// </summary>
    [Column("absmaxcet")]
    public float? Absmaxcet { get; set; }

    /// <summary>
    /// "1" = prendre un congé de ce type puise dans la réserve CET du salarié (besoin 2).
    /// À l'acceptation de la demande, Solde.Cetjours est décrémenté du nombre de jours pris.
    /// </summary>
    [Column("absprendcet")]
    [StringLength(1)]
    public string? Absprendcet { get; set; }
}
