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

    /// <summary>
    /// "1" si l'email de l'utilisateur a été confirmé via le code OTP envoyé au signup.
    /// "0" ou null = non vérifié. Distinct de UtiResetCode (réservé au reset password)
    /// pour éviter qu'une procédure efface les données de l'autre. Pas d'enforcement
    /// dur côté API à ce jour — seulement un bandeau d'incitation côté front, conçu
    /// pour ne pas bloquer un utilisateur valide qui aurait des problèmes de SMTP.
    /// </summary>
    [Column("uti_email_verified")]
    [StringLength(1)]
    public string? UtiEmailVerified { get; set; }

    /// <summary>
    /// BCrypt hash du code OTP 6 chiffres en attente de vérification. Effacé dès la
    /// vérification réussie. Renouvelé à chaque resend (via /Utilisateurs/resend-verification).
    /// Hash plutôt que plaintext : même si un dump de la table fuit, le code reste
    /// inexploitable (BCrypt cost 10 + expiry 15min + max 5 tentatives).
    /// </summary>
    [Column("uti_email_verif_code")]
    [StringLength(72)]
    public string? UtiEmailVerifCode { get; set; }

    /// <summary>
    /// Timestamp UTC d'expiration du code OTP courant (15 minutes après émission).
    /// Toute tentative de vérification après cette date renvoie code_expired.
    /// </summary>
    [Column("uti_email_verif_expiry")]
    public DateTime? UtiEmailVerifExpiry { get; set; }

    /// <summary>
    /// Compteur d'échecs de vérification consécutifs pour le code OTP courant. Au-delà
    /// de 5 tentatives, le code est invalidé (l'utilisateur doit relancer un resend).
    /// Évite le brute-force en ligne (10^6 codes possibles vs 5 essais → infaisable).
    /// </summary>
    [Column("uti_email_verif_attempts")]
    public int? UtiEmailVerifAttempts { get; set; }

    // ── OTP de signature électronique (Phase 3) ──
    // Stockage DÉDIÉ (distinct de la vérif email signup) pour ne pas écraser un code
    // de vérification d'adresse en cours. BCrypt-hashé, expiry court, anti-bruteforce.
    [Column("uti_sign_otp_code")]
    [StringLength(72)]
    public string? UtiSignOtpCode { get; set; }

    [Column("uti_sign_otp_expiry")]
    public DateTime? UtiSignOtpExpiry { get; set; }

    [Column("uti_sign_otp_attempts")]
    public int? UtiSignOtpAttempts { get; set; }
}
