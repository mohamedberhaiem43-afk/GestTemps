using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace ABRPOINT.Server.Models;

/// <summary>
/// Demande de télétravail soumise par un collaborateur, à valider par son manager
/// ou un administrateur. Plage de dates en jours pleins (cf. discussion produit
/// 2026-05-23 — pas de demi-journées dans la V1 pour rester aligné avec le
/// workflow `Demconge` qui inspire ce modèle).
///
/// Cycle de vie de <see cref="Status"/> :
///   Pending  → soumis, en attente de décision (l'employé peut encore l'annuler) ;
///   Approved → accepté par manager/admin (immuable) ;
///   Rejected → refusé (immuable, motif obligatoire dans <see cref="DecisionComment"/>) ;
///   Cancelled → annulé par l'employé avant décision (immuable).
///
/// Le tenant est porté par <see cref="Soccod"/> ; les requêtes EF passent par le
/// filtre global multi-tenant — un employé ne voit JAMAIS les demandes d'un
/// autre tenant même si l'ID est connu.
/// </summary>
[Table("teletravail")]
public partial class Teletravail
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

    // Plage de dates en JOURS PLEINS (pas d'heure significative). On stocke en
    // timestamp pour rester homogène avec Demconge.Condep/Conret ; côté UI on
    // affiche/saisit en date seule.
    [Column("start_date", TypeName = "timestamp without time zone")]
    public DateTime StartDate { get; set; }

    [Column("end_date", TypeName = "timestamp without time zone")]
    public DateTime EndDate { get; set; }

    // Nombre de jours ouvrés couverts par la demande, calculé côté serveur à la
    // création pour les indicateurs RH (« X jours de TT cumulés ce mois »).
    [Column("days_count")]
    public float? DaysCount { get; set; }

    // Motif libre (raison personnelle, mission focus, garde d'enfant…). Optionnel.
    [Column("reason")]
    [StringLength(500)]
    public string? Reason { get; set; }

    // Cf. doc en tête : "Pending" / "Approved" / "Rejected" / "Cancelled".
    [Column("status")]
    [StringLength(20)]
    public string Status { get; set; } = "Pending";

    // Validator : uticod (pas empcod — un admin sans fiche employé peut décider).
    [Column("decided_by")]
    [StringLength(20)]
    public string? DecidedBy { get; set; }

    [Column("decided_at", TypeName = "timestamp without time zone")]
    public DateTime? DecidedAt { get; set; }

    // Commentaire du décideur. Obligatoire en cas de refus (validation API),
    // optionnel en cas d'acceptation.
    [Column("decision_comment")]
    [StringLength(500)]
    public string? DecisionComment { get; set; }

    [Column("created_at", TypeName = "timestamp without time zone")]
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
