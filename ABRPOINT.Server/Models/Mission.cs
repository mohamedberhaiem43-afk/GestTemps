using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace ABRPOINT.Server.Models;

/// <summary>
/// Mission / formation rattachée à un collaborateur. Toute note de frais doit pointer
/// sur une mission via FK, ce qui garantit que les remboursements correspondent à un
/// déplacement / formation tracé. La mission est elle-même rattachée à une nature
/// d'absence (Absence.Abscng = "6" → "Formation et mission") pour que les heures
/// déclarées impactent correctement la paie.
/// </summary>
[Table("mission")]
public partial class Mission : BaseEntity
{
    [Key]
    [Column("id")]
    public int Id { get; set; }

    [Required]
    [Column("soccod")]
    [StringLength(6)]
    public string Soccod { get; set; } = null!;

    [Required]
    [Column("empcod")]
    [StringLength(12)]
    public string Empcod { get; set; } = null!;

    /// <summary>Objet / titre de la mission (ex: "Formation Microsoft Azure", "Audit client Acme").</summary>
    [Required]
    [Column("misobj")]
    [StringLength(150)]
    public string Misobj { get; set; } = null!;

    /// <summary>Destination / lieu (ville, pays, locaux client).</summary>
    [Column("misdest")]
    [StringLength(150)]
    public string? Misdest { get; set; }

    [Required]
    [Column("misdatedeb", TypeName = "datetime")]
    public DateTime Misdatedeb { get; set; }

    [Required]
    [Column("misdatefin", TypeName = "datetime")]
    public DateTime Misdatefin { get; set; }

    [Column("misnote")]
    [StringLength(500)]
    public string? Misnote { get; set; }

    /// <summary>État de la mission : Pending | Approved | InProgress | Completed | Cancelled.</summary>
    [Column("misetat")]
    [StringLength(20)]
    public string Misetat { get; set; } = "Pending";

    /// <summary>Budget alloué en devise tenant. Optionnel — informatif pour le suivi des notes de frais.</summary>
    [Column("misbudget")]
    public double? Misbudget { get; set; }

    /// <summary>
    /// Code nature d'absence rattaché. Doit pointer sur une Absence dont Abscng="6"
    /// (Formation et mission), validé côté contrôleur. Permet d'absenter automatiquement
    /// le collaborateur sur la période de mission lors de la génération du pointage.
    /// </summary>
    [Required]
    [Column("abscod")]
    [StringLength(4)]
    public string Abscod { get; set; } = null!;
}
