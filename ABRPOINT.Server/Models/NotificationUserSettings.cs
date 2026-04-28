using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace ABRPOINT.Server.Models;

/// <summary>
/// Réglages globaux de notification par utilisateur (1 row par uticod, optionnelle).
/// Actuellement : créneau « heures silencieuses » qui supprime les push pendant la plage
/// (l'historique in-app est préservé pour que l'utilisateur retrouve l'info au matin).
/// </summary>
[Table("notification_user_settings")]
public class NotificationUserSettings : BaseEntity
{
    [Key]
    [Column("uticod")]
    [StringLength(20)]
    public string Uticod { get; set; } = string.Empty;

    [Column("quiet_enabled")]
    public bool QuietEnabled { get; set; } = false;

    /// <summary>
    /// Mode du créneau silencieux :
    ///   "manual"      : utilise QuietStart / QuietEnd définis manuellement.
    ///   "auto_poste"  : calé sur les heures de travail du poste de l'employé pour la date courante
    ///                   (silencieux = hors plage [morningStart, eveningEnd] du poste du jour).
    /// </summary>
    [Column("quiet_mode")]
    [StringLength(20)]
    public string QuietMode { get; set; } = "manual";

    /// <summary>Heure de début (format "HH:mm", local). Utilisée seulement si QuietMode = "manual".</summary>
    [Column("quiet_start")]
    [StringLength(5)]
    public string QuietStart { get; set; } = "22:00";

    /// <summary>Heure de fin (format "HH:mm", local). Peut être &lt; QuietStart pour traverser minuit.</summary>
    [Column("quiet_end")]
    [StringLength(5)]
    public string QuietEnd { get; set; } = "07:00";

    [Column("updated_at")]
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}
