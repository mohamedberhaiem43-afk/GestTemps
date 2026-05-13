using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
namespace ABRPOINT.Server.Models;

[Table("utilisateur")]
public partial class Utilisateur : BaseEntity
{
    [Key]
    [Column("uticod")]
    [StringLength(20)]
    public string? Uticod { get; set; }

    [Column("utinom")]
    [StringLength(20)]
    public string? Utinom { get; set; }

    [Column("utiprn")]
    [StringLength(20)]
    public string? Utiprn { get; set; }

    [Column("utimps")]
    [StringLength(100)]
    public string? Utimps { get; set; }

    [Column("utiactif")]
    [StringLength(1)]
    public string? Utiactif { get; set; }
    [Column("utiadm")]
    [StringLength(150)]
    public string? Utiadm { get; set; }
    [StringLength(100)]
    public string? Utimail { get; set; }
    [Column("utiimg")]
    [StringLength(500)]
    public string? Utiimg { get; set; }

    [Column("utirole")]
    [StringLength(50)]
    public string? Utirole { get; set; }

    [Column("uti2fa_enabled")]
    [StringLength(1)]
    public string? UtiTwoFactorEnabled { get; set; }

    [Column("uti2fa_secret")]
    [StringLength(200)]
    public string? UtiTwoFactorSecret { get; set; }
    public string? UtiResetCode { get; set; }
    public DateTime? UtiResetCodeExpiry { get; set; }

    /// <summary>
    /// Compteur d'échecs de login consécutifs (reset à 0 après une connexion réussie).
    /// Sert au backoff progressif : 3 échecs → lock 30s, 5 → 5min, 10 → 1h. Le rate
    /// limiter `auth-login` par IP reste actif en parallèle — ces deux mesures sont
    /// complémentaires (IP couvre le brute-force massif, account couvre le ciblé).
    /// </summary>
    [Column("uti_failed_logins")]
    public int? UtiFailedLogins { get; set; }

    /// <summary>
    /// Date jusqu'à laquelle le compte est verrouillé suite à des échecs répétés.
    /// Null = pas de verrou. Comparée à DateTime.UtcNow à chaque tentative.
    /// </summary>
    [Column("uti_lockout_until")]
    public DateTime? UtiLockoutUntil { get; set; }
}
