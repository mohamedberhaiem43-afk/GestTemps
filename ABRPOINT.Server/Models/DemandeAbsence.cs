using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace ABRPOINT.Server.Models;

/// <summary>
/// Demande d'absence avec justificatif (certificat médical, convocation, attestation…)
/// soumise par un collaborateur, à valider par son manager ou un admin.
///
/// Workflow identique à <see cref="Teletravail"/> (Pending → Approved/Rejected/Cancelled).
/// Distinct de <see cref="Demconge"/> : la demande d'absence est ponctuelle, requiert
/// un justificatif et ne décrémente pas un solde de congés — c'est un acte de notification
/// + validation a posteriori (ex: arrêt maladie remis le lendemain), pas une planification.
///
/// Le fichier de justification est stocké via <see cref="ABRPOINT.Server.Helpers.FileHelper"/>
/// dans <c>uploads/{slug}/</c> ; on persiste l'URL relative (<see cref="JustificationUrl"/>)
/// + le nom d'origine + le mimeType pour les afficher dans l'UI sans relire le disque.
/// </summary>
[Table("demande_absence")]
public partial class DemandeAbsence
{
    [Key]
    [Column("id")]
    public int Id { get; set; }

    [Column("soccod")]
    [StringLength(2)]
    public string? Soccod { get; set; }

    [Column("empcod")]
    [StringLength(12)]
    public string? Empcod { get; set; }

    [Column("requested_at", TypeName = "timestamp without time zone")]
    public DateTime RequestedAt { get; set; } = DateTime.UtcNow;

    // Date de DÉBUT de l'absence (date à laquelle le collaborateur a été absent ou
    // va l'être). Tronqué à la date (pas d'heure significative — la demande
    // d'absence couvre des journées pleines comme Teletravail).
    [Column("start_date", TypeName = "timestamp without time zone")]
    public DateTime StartDate { get; set; }

    [Column("end_date", TypeName = "timestamp without time zone")]
    public DateTime EndDate { get; set; }

    [Column("days_count")]
    public float? DaysCount { get; set; }

    // Type d'absence référencé dans la table Absence (Abscod). Permet à l'UI de
    // joindre Absence.Abslib pour afficher « Maladie », « Évènement familial », etc.
    // Optionnel : si le collaborateur ne sait pas, il peut laisser vide et le
    // manager qualifie au moment de la validation.
    [Column("abscod")]
    [StringLength(6)]
    public string? Abscod { get; set; }

    [Column("reason")]
    [StringLength(1000)]
    public string? Reason { get; set; }

    // ─── Justificatif ────────────────────────────────────────────────────────
    // URL relative (/api/uploads/{slug}/{guid}.ext) retournée par FileHelper.SaveFile.
    // NON chiffrée — contrairement au Vault (DocumentVault.FilePath), le
    // justificatif d'absence est destiné à être consulté inline par le manager
    // dans la page de validation, donc on garde le chemin tel quel.
    [Column("justification_url")]
    [StringLength(500)]
    public string? JustificationUrl { get; set; }

    // Nom d'origine du fichier uploadé (sans le chemin). Affiché dans la liste
    // côté manager (« certificat-medical-05-23.pdf »).
    [Column("justification_filename")]
    [StringLength(200)]
    public string? JustificationFilename { get; set; }

    [Column("justification_mime")]
    [StringLength(100)]
    public string? JustificationMime { get; set; }

    [Column("justification_size")]
    public long? JustificationSize { get; set; }

    // ─── État machine ────────────────────────────────────────────────────────
    [Column("status")]
    [StringLength(20)]
    public string Status { get; set; } = "Pending";

    [Column("decided_by")]
    [StringLength(20)]
    public string? DecidedBy { get; set; }

    [Column("decided_at", TypeName = "timestamp without time zone")]
    public DateTime? DecidedAt { get; set; }

    [Column("decision_comment")]
    [StringLength(500)]
    public string? DecisionComment { get; set; }

    [Column("created_at", TypeName = "timestamp without time zone")]
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
