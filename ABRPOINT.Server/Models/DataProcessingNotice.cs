using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace ABRPOINT.Server.Models;

/// <summary>
/// Notice d'information RGPD destinée aux Salariés-Utilisateurs (clause 13.3 du
/// contrat éditeur + Art. 13 RGPD : obligation d'information du responsable de
/// traitement envers la personne concernée). Singleton par tenant.
///
/// Le client (Responsable de traitement) édite le contenu depuis l'UI Admin —
/// l'éditeur fournit seulement un modèle par défaut. Chaque modification incrémente
/// <see cref="Version"/>, ce qui déclenche un nouvel acknowledgment côté salariés.
/// </summary>
[Table("data_processing_notice")]
public class DataProcessingNotice
{
    [Key]
    [Column("id")]
    public int Id { get; set; } = 1;

    /// <summary>Titre affiché en haut de la notice.</summary>
    [Column("title")]
    [StringLength(200)]
    public string Title { get; set; } = "Information sur le traitement de vos données";

    /// <summary>Corps de la notice (texte ou Markdown léger).</summary>
    [Column("body")]
    public string Body { get; set; } = DefaultBody;

    /// <summary>
    /// Version monotone incrémentée à chaque édition. Sert de pivot d'acknowledgment :
    /// un nouvel utilisateur (ou un utilisateur qui a accepté une version antérieure)
    /// re-voit la bannière jusqu'à acquittement de la version courante.
    /// </summary>
    [Column("version")]
    public int Version { get; set; } = 1;

    [Column("updated_at", TypeName = "timestamp without time zone")]
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    [Column("updated_by")]
    [StringLength(20)]
    public string? UpdatedBy { get; set; }

    public const string DefaultBody =
@"Conformément à l'article 13 du Règlement Général sur la Protection des Données (RGPD), nous vous informons des modalités de traitement de vos données personnelles dans le cadre du dispositif de pointage.

**Données collectées**
- Identifiant et nom/prénom
- Horaires d'entrée et de sortie
- Coordonnées GPS au moment du pointage (lorsque la géolocalisation est activée pour votre site)

**Finalités**
- Décompte du temps de travail
- Préparation de la paie
- Contrôle du respect des plages horaires de présence sur les sites de l'entreprise

**Base légale**
Intérêt légitime de l'employeur (art. 6.1.f RGPD) et obligation légale de tenue d'un relevé d'heures (art. L3171-2 du Code du travail).

**Durée de conservation**
Les relevés d'heures sont conservés conformément à la politique de rétention paramétrée par votre employeur (5 ans maximum, durée légale FR).

**Vos droits**
Accès, rectification, effacement, limitation, opposition. Vous pouvez exercer ces droits auprès du Responsable de traitement (votre employeur) ou de son DPO.";
}
