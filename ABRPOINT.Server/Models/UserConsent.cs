using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace ABRPOINT.Server.Models;

/// <summary>
/// Trace d'acquittement par un Salarié-Utilisateur de la notice d'information RGPD
/// (cf. <see cref="DataProcessingNotice"/>). Sert de preuve que l'employeur a bien
/// informé le salarié — pas un consentement au sens RGPD (le pointage repose sur
/// l'intérêt légitime et l'obligation légale, pas sur le consentement).
///
/// Index (uticod, notice_version) pour la requête de check rapide :
/// « cet utilisateur a-t-il déjà acquitté la version courante ? ».
/// </summary>
[Table("user_consent")]
public class UserConsent
{
    [Key]
    [DatabaseGenerated(DatabaseGeneratedOption.Identity)]
    [Column("id")]
    public long Id { get; set; }

    [Column("uticod")]
    [StringLength(20)]
    [Required]
    public string Uticod { get; set; } = string.Empty;

    /// <summary>Version de la notice qui a été acquittée.</summary>
    [Column("notice_version")]
    public int NoticeVersion { get; set; }

    [Column("acknowledged_at", TypeName = "timestamp without time zone")]
    public DateTime AcknowledgedAt { get; set; } = DateTime.UtcNow;

    /// <summary>IP cliente au moment de l'acquittement (proof of delivery).</summary>
    [Column("ip_address")]
    [StringLength(45)]
    public string? IpAddress { get; set; }
}
