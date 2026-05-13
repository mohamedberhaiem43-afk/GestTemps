using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace ABRPOINT.Server.Tenancy;

/// <summary>
/// Trace des événements Stripe déjà traités, pour neutraliser les replays. Stripe rejoue
/// un webhook quand le récepteur a renvoyé un code !=2xx ou n'a pas répondu sous 30s ;
/// sans dédoublonnage, un retry peut re-déclencher la logique métier (créer 2 fois une
/// subscription, débloquer 2 fois un tenant, etc.). On enregistre <c>EventId</c> en clé
/// primaire au début du handler et on early-return si la ligne existe déjà.
/// </summary>
[Table("StripeWebhookSeen")]
public class StripeWebhookSeen
{
    /// <summary>ID Stripe de l'événement (format "evt_xxxxxxxxxxxxxxxxxxxxxxxx"). Unique côté Stripe.</summary>
    [Key]
    [MaxLength(80)]
    public string EventId { get; set; } = string.Empty;

    /// <summary>Type de l'événement (ex: "invoice.payment_succeeded"). Sert au debug / audit.</summary>
    [MaxLength(80)]
    public string? EventType { get; set; }

    public DateTime ProcessedAt { get; set; } = DateTime.UtcNow;
}
