using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace ABRPOINT.Server.Models;

/// <summary>
/// Une étape ordonnée du circuit de signature : étape 1 = l'employé demandeur,
/// étapes 2..n = les approbateurs (résolus via l'organigramme <c>Employe.Empresp</c>).
/// Chaque étape cible un emplacement de signature dans le PDF (placeholder_key).
/// Cf. table <c>signature_step</c>. (Phase 1 : une seule étape = l'employé ; la
/// chaîne multi-niveaux arrive en Phase 2.)
/// </summary>
[Table("signature_step")]
public class SignatureStep
{
    [Key]
    [Column("id")]
    public int Id { get; set; }

    [Column("request_id")]
    public int RequestId { get; set; }

    [Column("step_order")]
    public int StepOrder { get; set; }

    [Required]
    [Column("signer_empcod")]
    [StringLength(12)]
    public string SignerEmpcod { get; set; } = null!;

    /// <summary>'employee' | 'approver'.</summary>
    [Column("signer_role")]
    [StringLength(20)]
    public string SignerRole { get; set; } = "employee";

    /// <summary>Placeholder texte ciblé dans le PDF (ex. [Signature_Collaborateur], [Signature_Approbateur_1]).</summary>
    [Column("placeholder_key")]
    [StringLength(40)]
    public string? PlaceholderKey { get; set; }

    /// <summary>pending | signed | rejected | delegated | skipped.</summary>
    [Column("status")]
    [StringLength(20)]
    public string Status { get; set; } = "pending";

    [Column("delegated_to")]
    [StringLength(12)]
    public string? DelegatedTo { get; set; }
}
