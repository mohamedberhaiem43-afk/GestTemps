using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace ABRPOINT.Server.Models;

/// <summary>
/// En-tête d'un parcours de signature électronique (workflow). Relie une demande
/// source (congé, autorisation…) au document généré (DocumentVault) et porte l'état
/// global du circuit. Les signataires/approbateurs sont dans <see cref="SignatureStep"/>,
/// le registre append-only des actions dans <see cref="SignatureAction"/>, le sceau
/// final dans <see cref="SignatureSealLog"/>. Cf. table <c>signature_request</c>.
/// </summary>
[Table("signature_request")]
public class SignatureRequest
{
    [Key]
    [Column("id")]
    public int Id { get; set; }

    [Required]
    [Column("soccod")]
    [StringLength(6)]
    public string Soccod { get; set; } = null!;

    /// <summary>'DemConge' | 'DemandeAutorisation' | 'DemandeAbsence' | 'Teletravail' | 'Manual'.</summary>
    [Required]
    [Column("source_type")]
    [StringLength(40)]
    public string SourceType { get; set; } = null!;

    /// <summary>Concod / PK de la demande source (null si Manual).</summary>
    [Column("source_id")]
    [StringLength(40)]
    public string? SourceId { get; set; }

    /// <summary>FK → documentvault.id : le PDF généré (gelé) qui sera signé puis scellé.</summary>
    [Column("documentvault_id")]
    public int? DocumentVaultId { get; set; }

    [Required]
    [Column("requested_by")]
    [StringLength(12)]
    public string RequestedBy { get; set; } = null!;

    /// <summary>awaiting_signatures | in_validation | rejected | all_signed | archived.</summary>
    [Column("workflow_status")]
    [StringLength(30)]
    public string WorkflowStatus { get; set; } = "awaiting_signatures";

    [Column("current_step")]
    public int CurrentStep { get; set; } = 1;

    [Column("created_at", TypeName = "timestamp without time zone")]
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    [Column("completed_at", TypeName = "timestamp without time zone")]
    public DateTime? CompletedAt { get; set; }
}
