using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace ABRPOINT.Server.Models;

/// <summary>
/// Sceau cryptographique append-only (chaîne de hachage tamper-evident). À la signature
/// finale, on calcule le SHA-256 des octets du PDF GELÉ et on le chaîne au sceau précédent
/// (prev_seal_hash). C'est le « scellement » v1 (sans TSA externe / eIDAS qualifié) :
/// preuve d'intégrité + horodatage UTC. Cf. table <c>signature_seal_log</c>.
/// </summary>
[Table("signature_seal_log")]
public class SignatureSealLog
{
    [Key]
    [Column("id")]
    public int Id { get; set; }

    [Column("request_id")]
    public int RequestId { get; set; }

    [Column("documentvault_id")]
    public int DocumentVaultId { get; set; }

    /// <summary>SHA-256 hex (64 chars) des octets finaux du PDF scellé.</summary>
    [Required]
    [Column("seal_hash")]
    [StringLength(64)]
    public string SealHash { get; set; } = null!;

    /// <summary>SHA-256 du sceau précédent du tenant (chaînage tamper-evident), null pour le premier.</summary>
    [Column("prev_seal_hash")]
    [StringLength(64)]
    public string? PrevSealHash { get; set; }

    [Required]
    [Column("sealed_by")]
    [StringLength(12)]
    public string SealedBy { get; set; } = null!;

    [Column("sealed_at", TypeName = "timestamp without time zone")]
    public DateTime SealedAt { get; set; } = DateTime.UtcNow;
}
