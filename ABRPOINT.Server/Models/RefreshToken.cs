using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace ABRPOINT.Server.Models;

[Table("refresh_tokens")]
public class RefreshToken : BaseEntity
{
    [Key]
    [Column("id")]
    public int Id { get; set; }

    [Required]
    [Column("uticod")]
    [StringLength(20)]
    public string? Uticod { get; set; }

    [Required]
    [Column("token")]
    [StringLength(500)]
    public string? Token { get; set; }

    [Required]
    [Column("expires_at")]
    public DateTime ExpiresAt { get; set; }

    [Column("revoked")]
    public bool Revoked { get; set; } = false;

    /// <summary>
    /// SEC-G2 — Discrimine les tokens utilisés pour le refresh classique (rotation à chaque
    /// usage, durée 30j) des tokens biométriques (durée 90j, ne sont PAS révoqués au logout —
    /// Face ID/Touch ID reste opérationnel après une déconnexion volontaire).
    /// Valeurs : "Refresh" (défaut, legacy) ou "Biometric".
    /// </summary>
    [Column("purpose")]
    [StringLength(20)]
    public string Purpose { get; set; } = "Refresh";

    /// <summary>
    /// SEC-G6 — Date de dernière utilisation pour le quota par user : on garde les N RT les
    /// plus récents et on révoque les plus anciens.
    /// </summary>
    [Column("last_used_at")]
    public DateTime? LastUsedAt { get; set; }
}
