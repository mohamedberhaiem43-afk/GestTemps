using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace ABRPOINT.Server.Models;

/// <summary>
/// Mission / formation rattachÃ©e Ã  un collaborateur. Toute note de frais doit pointer
/// sur une mission via FK, ce qui garantit que les remboursements correspondent Ã  un
/// dÃ©placement / formation tracÃ©. La mission est elle-mÃªme rattachÃ©e Ã  une nature
/// d'absence (Absence.Abscng = "6" â†’ "Formation et mission") pour que les heures
/// dÃ©clarÃ©es impactent correctement la paie.
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
    [Column("misdatedeb", TypeName = "timestamp without time zone")]
    public DateTime Misdatedeb { get; set; }

    [Required]
    [Column("misdatefin", TypeName = "timestamp without time zone")]
    public DateTime Misdatefin { get; set; }

    [Column("misnote")]
    [StringLength(500)]
    public string? Misnote { get; set; }

    /// <summary>Ã‰tat de la mission : Pending | Approved | InProgress | Completed | Cancelled.</summary>
    [Column("misetat")]
    [StringLength(20)]
    public string Misetat { get; set; } = "Pending";

    /// <summary>Budget allouÃ© en devise <see cref="Misdevise"/>. Optionnel â€” informatif pour le suivi des notes de frais.</summary>
    [Column("misbudget")]
    public double? Misbudget { get; set; }

    /// <summary>
    /// Code ISO 4217 de la devise du budget (EUR, USD, TND, MAD, GBPâ€¦).
    /// NULL = devise par dÃ©faut tenant (cÃ´tÃ© client, EUR par dÃ©faut). Permet
    /// les missions internationales sans imposer la devise du siÃ¨ge.
    /// </summary>
    [Column("misdevise")]
    [StringLength(3)]
    public string? Misdevise { get; set; }

    /// <summary>
    /// Code nature d'absence rattachÃ©. Doit pointer sur une Absence dont Abscng="6"
    /// (Formation et mission), validÃ© cÃ´tÃ© contrÃ´leur. Permet d'absenter automatiquement
    /// le collaborateur sur la pÃ©riode de mission lors de la gÃ©nÃ©ration du pointage.
    /// </summary>
    [Required]
    [Column("abscod")]
    [StringLength(4)]
    public string Abscod { get; set; } = null!;
}
