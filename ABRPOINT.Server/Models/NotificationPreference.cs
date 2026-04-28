using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace ABRPOINT.Server.Models;

/// <summary>
/// Préférence de notification par utilisateur et par catégorie.
/// Convention : l'absence de ligne signifie "tout activé" (default opt-in).
/// Deux canaux indépendants :
///   - PushEnabled : envoi push système (mobile).
///   - InappEnabled : persistance dans le centre de notifications (web + mobile).
/// L'utilisateur peut couper le push d'une catégorie (ex: rappels) tout en gardant l'historique
/// consultable dans le centre.
/// `Enabled` est conservé pour rétrocompat ; il joue le rôle de master switch (false = tout off).
/// </summary>
[Table("notification_preferences")]
public class NotificationPreference : BaseEntity
{
    [Key]
    [Column("np_id")]
    public int Id { get; set; }

    [Required]
    [Column("uticod")]
    [StringLength(20)]
    public string Uticod { get; set; } = string.Empty;

    /// <summary>
    /// Code de catégorie (cf. UserNotificationService.ExtractCategory) : reminder_in,
    /// reminder_out, leave_request_accepted, leave_request_refused, etc.
    /// </summary>
    [Required]
    [Column("category")]
    [StringLength(50)]
    public string Category { get; set; } = string.Empty;

    /// <summary>Master switch hérité — false = tout désactivé (push ET in-app).</summary>
    [Column("enabled")]
    public bool Enabled { get; set; } = true;

    [Column("push_enabled")]
    public bool PushEnabled { get; set; } = true;

    [Column("inapp_enabled")]
    public bool InappEnabled { get; set; } = true;

    [Column("updated_at")]
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}
