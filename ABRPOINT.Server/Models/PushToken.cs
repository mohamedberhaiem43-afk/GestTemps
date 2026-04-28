using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace ABRPOINT.Server.Models;

/// <summary>
/// Token Expo push enregistré par un appareil mobile pour recevoir des notifications
/// (rappels de pointage, validations de demandes, alertes manager). 1 ligne par device :
/// un même utilisateur peut avoir plusieurs entrées s'il a plusieurs appareils.
/// </summary>
[Table("push_tokens")]
public class PushToken : BaseEntity
{
    [Key]
    [Column("pt_id")]
    public int PtId { get; set; }

    [Required]
    [Column("uticod")]
    [StringLength(20)]
    public string Uticod { get; set; } = string.Empty;

    [Column("soccod")]
    [StringLength(15)]
    public string? Soccod { get; set; }

    /// <summary>Token Expo (`ExponentPushToken[xxxxxxxxxx]`).</summary>
    [Required]
    [Column("token")]
    [StringLength(200)]
    public string Token { get; set; } = string.Empty;

    /// <summary>"ios" | "android" | "web".</summary>
    [Column("platform")]
    [StringLength(20)]
    public string? Platform { get; set; }

    /// <summary>Identifiant device opaque côté mobile pour faire l'upsert.</summary>
    [Column("device_id")]
    [StringLength(100)]
    public string? DeviceId { get; set; }

    [Column("created_at")]
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    [Column("last_seen_at")]
    public DateTime LastSeenAt { get; set; } = DateTime.UtcNow;

    /// <summary>Désactivé si Expo a renvoyé une erreur permanente (DeviceNotRegistered).</summary>
    [Column("active")]
    public bool Active { get; set; } = true;
}
