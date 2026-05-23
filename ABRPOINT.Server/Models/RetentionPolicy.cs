using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace ABRPOINT.Server.Models;

/// <summary>
/// Politique de rétention RGPD configurable par le tenant — clause 13.3 du contrat
/// éditeur/client : la durée de conservation des données est décidée par le client
/// (responsable de traitement) et non par l'éditeur. Singleton par base tenant.
///
/// Toutes les durées sont en JOURS. Les bornes (min/max) sont validées par le
/// contrôleur ; les hosted services appliquent un plancher absolu côté code pour
/// éviter qu'une corruption de la table ne permette une purge "trop agressive".
/// </summary>
[Table("retention_policy")]
public class RetentionPolicy
{
    /// <summary>PK fixe à 1 — un seul enregistrement par tenant.</summary>
    [Key]
    [Column("id")]
    public int Id { get; set; } = 1;

    /// <summary>Journaux d'audit (table AuditLog). Défaut 180 j (6 mois).</summary>
    [Column("audit_log_days")]
    public int AuditLogDays { get; set; } = 180;

    /// <summary>
    /// Anonymisation des pointages bruts : on vide les champs free-text (Preobs)
    /// au-delà de ce seuil. Les agrégats horaires sont conservés pour la paie.
    /// Défaut 365 j.
    /// </summary>
    [Column("presence_anonymize_days")]
    public int PresenceAnonymizeDays { get; set; } = 365;

    /// <summary>
    /// Suppression définitive des pointages. Défaut 1 825 j (5 ans) — durée légale
    /// max imposée par l'article L3171-3 du Code du travail FR pour les relevés
    /// d'heures.
    /// </summary>
    [Column("presence_delete_days")]
    public int PresenceDeleteDays { get; set; } = 1825;

    /// <summary>Refresh tokens expirés ou révoqués (au-delà de leur expiration).</summary>
    [Column("refresh_token_days_after_expiry")]
    public int RefreshTokenDaysAfterExpiry { get; set; } = 30;

    /// <summary>Devices connus inactifs (KnownDevice.LastSeenAt).</summary>
    [Column("known_device_inactive_days")]
    public int KnownDeviceInactiveDays { get; set; } = 365;

    /// <summary>Push tokens marqués active=false et inactifs.</summary>
    [Column("push_token_inactive_days")]
    public int PushTokenInactiveDays { get; set; } = 90;

    /// <summary>Historique des chats RAG (assistant IA).</summary>
    [Column("rag_chat_log_days")]
    public int RagChatLogDays { get; set; } = 90;

    [Column("updated_at", TypeName = "timestamp without time zone")]
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    [Column("updated_by")]
    [StringLength(20)]
    public string? UpdatedBy { get; set; }
}
