using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace ABRPOINT.Server.Models;

/// <summary>
/// Empreinte d'un appareil/réseau d'où un utilisateur s'est déjà connecté avec succès.
/// Sert à détecter les connexions depuis un nouveau contexte (vol de cookie/mdp, malware)
/// et à envoyer une alerte email à l'utilisateur. Stocke un hash + un préfixe d'IP au
/// lieu des valeurs brutes — RGPD-friendly (minimisation des données) et résistant aux
/// changements mineurs (rotation d'IP intra-/16).
/// </summary>
[Table("known_devices")]
public class KnownDevice
{
    [Key]
    [Column("kd_id")]
    public int Id { get; set; }

    /// <summary>Utilisateur propriétaire de l'empreinte.</summary>
    [Required]
    [Column("uticod")]
    [StringLength(20)]
    public string Uticod { get; set; } = string.Empty;

    /// <summary>SHA-256 tronqué (16 hex) du User-Agent normalisé. Identifie le navigateur+OS.</summary>
    [Required]
    [Column("ua_hash")]
    [StringLength(16)]
    public string UaHash { get; set; } = string.Empty;

    /// <summary>
    /// Préfixe /16 d'IPv4 ("203.0.") ou /48 d'IPv6 ("2001:db8:1234"). On garde un préfixe
    /// au lieu de l'IP complète pour tolérer les rotations d'IP dans le même réseau (DHCP
    /// FAI, opérateur mobile) sans spammer l'utilisateur d'alertes pour de faux positifs.
    /// </summary>
    [Required]
    [Column("ip_prefix")]
    [StringLength(40)]
    public string IpPrefix { get; set; } = string.Empty;

    /// <summary>Libellé lisible côté admin : "Chrome 140 · Windows · Paris (203.0.x.x)" — best-effort.</summary>
    [Column("device_label")]
    [StringLength(150)]
    public string? DeviceLabel { get; set; }

    [Column("first_seen_at")]
    public DateTime FirstSeenAt { get; set; } = DateTime.UtcNow;

    [Column("last_seen_at")]
    public DateTime LastSeenAt { get; set; } = DateTime.UtcNow;
}
