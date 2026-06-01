using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace ABRPOINT.Server.Models;

/// <summary>
/// Registre APPEND-ONLY des actions de signature : une ligne par signature / rejet /
/// délégation effectivement réalisé, avec la preuve probante (identité, horodatage UTC,
/// méthode d'authentification, IP, user-agent, cert-id). Source de vérité du « qui a signé
/// quoi, quand, comment ». Cf. table <c>signature_action</c>.
/// </summary>
[Table("signature_action")]
public class SignatureAction
{
    [Key]
    [Column("id")]
    public int Id { get; set; }

    [Column("request_id")]
    public int RequestId { get; set; }

    [Column("step_id")]
    public int StepId { get; set; }

    [Required]
    [Column("signer_empcod")]
    [StringLength(12)]
    public string SignerEmpcod { get; set; } = null!;

    /// <summary>'signed' | 'rejected' | 'delegated'.</summary>
    [Column("action")]
    [StringLength(20)]
    public string Action { get; set; } = "signed";

    [Column("signature_path")]
    [StringLength(500)]
    public string? SignaturePath { get; set; }

    [Column("certificate_id")]
    [StringLength(60)]
    public string? CertificateId { get; set; }

    /// <summary>'handwritten' | 'password_otp_email' | 'totp' (Phase 3 renseigne la méthode réelle).</summary>
    [Column("auth_method")]
    [StringLength(20)]
    public string? AuthMethod { get; set; }

    [Column("ip_address")]
    [StringLength(64)]
    public string? IpAddress { get; set; }

    [Column("user_agent")]
    [StringLength(256)]
    public string? UserAgent { get; set; }

    /// <summary>Motif de rejet (action = 'rejected').</summary>
    [Column("motif")]
    [StringLength(500)]
    public string? Motif { get; set; }

    [Column("signed_at", TypeName = "timestamp without time zone")]
    public DateTime SignedAt { get; set; } = DateTime.UtcNow;
}
