using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using Microsoft.EntityFrameworkCore;

namespace ABRPOINT.Server.Models;

/// <summary>
/// Position GPS « live » d'un salarié — UNE ligne par (Soccod, Empcod), upsertée
/// à chaque heartbeat reçu du mobile. Distincte de <see cref="Presence"/>.prelat/prelon
/// qui ne capture la position QU'au moment du pointage : LivePosition trace en plus
/// la position courante PENDANT la journée de travail (heartbeat périodique côté
/// mobile, ex. toutes les 60 s) pour permettre à l'admin / manager de visualiser
/// en quasi-temps réel où sont les salariés sur la carte OpenStreetMap.
///
/// Politique RGPD :
/// - La capture LivePosition est gated par <c>PlanFeatures.Geolocation</c> côté
///   backend (cf. [RequirePlanFeature(Geolocation)] sur les endpoints concernés).
/// - La table est purgée par <c>LivePositionRetentionHostedService</c> : toute ligne
///   dont <see cref="UpdatedAt"/> dépasse <c>RetentionMinutes</c> (défaut 30 min)
///   est supprimée. C'est une donnée VOLATILE : on ne conserve pas un historique
///   live (pour l'historique des pointages on a déjà <c>Presence.prelat/prelon</c>).
/// </summary>
[Table("live_position")]
[PrimaryKey("Soccod", "Empcod")]
public class LivePosition
{
    [Column("soccod")]
    [StringLength(4)]
    public string Soccod { get; set; } = string.Empty;

    [Column("empcod")]
    [StringLength(12)]
    public string Empcod { get; set; } = string.Empty;

    /// <summary>
    /// Latitude WGS84 — précision 7 décimales (~1 cm), cohérent avec
    /// <c>Presence.Prelat</c> pour pouvoir comparer/agréger les deux sources.
    /// </summary>
    [Column("lat", TypeName = "decimal(10,7)")]
    public decimal Lat { get; set; }

    [Column("lon", TypeName = "decimal(10,7)")]
    public decimal Lon { get; set; }

    /// <summary>
    /// Précision de la mesure en mètres (de expo-location accuracy.Balanced ≈ 10-30 m).
    /// Permet à l'UI d'afficher un disque de confiance autour du marqueur.
    /// </summary>
    [Column("acc")]
    public int? Acc { get; set; }

    /// <summary>
    /// Horodatage UTC de la dernière mise à jour. C'est le critère de fraîcheur
    /// utilisé par le frontend (marqueur vert si &lt; 2 min, gris si plus vieux).
    /// </summary>
    [Column("updated_at", TypeName = "timestamp without time zone")]
    public DateTime UpdatedAt { get; set; }

    /// <summary>
    /// Identifiant de session mobile optionnel — utile pour distinguer plusieurs
    /// appareils si un même salarié se connecte sur 2 téléphones (cas rare mais
    /// possible en flotte). Pas un secret, juste un GUID côté client.
    /// </summary>
    [Column("session_id")]
    [StringLength(64)]
    public string? SessionId { get; set; }

    /// <summary>
    /// Niveau de batterie (0-100) à l'instant du heartbeat. Pure courtoisie pour
    /// l'admin (savoir si un salarié risque de perdre le tracking) — pas utilisé
    /// dans la logique métier.
    /// </summary>
    [Column("battery_level")]
    public int? BatteryLevel { get; set; }
}
