using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace ABRPOINT.Server.Models;

/// <summary>
/// Demande d'alimentation du CET (Compte Épargne Temps) émise par un salarié : transfert
/// de N jours d'un type de congé source (RTT, congé payé…) vers son CET.
///
/// Distinct de <see cref="Demconge"/> : pas de dates de congé, juste un nombre de jours +
/// le type source (<see cref="Abscod"/>). Le workflow de validation est optionnel et piloté
/// par <c>Parametre.Parcetvalidation</c> au niveau société :
///   - validation requise → la demande naît <c>pending</c> et un admin/manager l'approuve
///     ou la refuse ;
///   - sinon → la demande est créée directement <c>approved</c> et le transfert est appliqué
///     immédiatement (décrément du solde source + crédit <c>Solde.Cetjours</c>).
///
/// Le contrôle de limite repose sur la config du type d'absence
/// (<c>Absence.Abspeutcet</c> / <c>Absence.Absmaxcet</c>) + le solde source disponible.
/// </summary>
[Table("dem_alimentation_cet")]
public partial class DemAlimentationCet
{
    [Key]
    [Column("id")]
    public int Id { get; set; }

    [Column("soccod")]
    [StringLength(6)]
    public string? Soccod { get; set; }

    [Column("empcod")]
    [StringLength(12)]
    public string? Empcod { get; set; }

    /// <summary>Type de congé source du transfert (référence Absence.Abscod).</summary>
    [Column("abscod")]
    [StringLength(4)]
    public string? Abscod { get; set; }

    [Column("nbjours")]
    public float Nbjours { get; set; }

    /// <summary>Année de référence du plafond annuel (cumul par type).</summary>
    [Column("annee")]
    [StringLength(4)]
    public string? Annee { get; set; }

    [Column("datedemande", TypeName = "timestamp without time zone")]
    public DateTime Datedemande { get; set; } = DateTime.UtcNow;

    /// <summary>"pending" | "approved" | "refused".</summary>
    [Column("statut")]
    [StringLength(12)]
    public string Statut { get; set; } = "pending";

    [Column("validepar")]
    [StringLength(12)]
    public string? Validepar { get; set; }

    [Column("datevalidation", TypeName = "timestamp without time zone")]
    public DateTime? Datevalidation { get; set; }

    [Column("motifrefus")]
    [StringLength(200)]
    public string? Motifrefus { get; set; }
}
