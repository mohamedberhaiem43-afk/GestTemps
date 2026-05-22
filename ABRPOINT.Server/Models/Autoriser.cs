using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace ABRPOINT.Server.Models;

[Table("autoriser")]
public partial class Autoriser : BaseEntity
{
    [Required] 
    [Key]
    [Column("concod")]
    [StringLength(10)]
    public string Concod { get; set; }
    [Required]
    [Column("soccod")]
    [StringLength(2)]
    public string? Soccod { get; set; }

    [Column("empcod")]
    [StringLength(12)]
    public string? Empcod { get; set; }

    [Column("condat", TypeName = "timestamp without time zone")]
    public DateTime? Condat { get; set; }

    [Column("conjour")]
    [StringLength(1)]
    public string? Conjour { get; set; }

    [Column("condep", TypeName = "timestamp without time zone")]
    public DateTime? Condep { get; set; }

    [Column("conamdep")]
    [StringLength(1)]
    public string? Conamdep { get; set; }

    [Column("conret", TypeName = "timestamp without time zone")]
    public DateTime? Conret { get; set; }

    [Column("conamret")]
    [StringLength(1)]
    public string? Conamret { get; set; }

    [Column("abscod")]
    [StringLength(6)]
    public string? Abscod { get; set; }

    [Column("conmotif")]
    [StringLength(50)]
    public string? Conmotif { get; set; }

    [Column("consanc")]
    [StringLength(1)]
    public string? Consanc { get; set; }

    [Column("connbjour")]
    public float? Connbjour { get; set; }

    [Column("conref")]
    [StringLength(20)]
    public string? Conref { get; set; }

    [Column("conaffecte")]
    [StringLength(12)]
    public string? Conaffecte { get; set; }

    /// <summary>État de validation pour les demandes d'heures supplémentaires
    /// soumises depuis le mobile : "Pending" (par défaut à la création), "Approved",
    /// "Rejected". NULL = legacy (avant le fix de validation) → traité comme Pending
    /// côté lecture pour compat ascendante.</summary>
    [Column("conetat")]
    [StringLength(20)]
    public string? Conetat { get; set; }

    /// <summary>Empcod de l'admin/manager ayant traité la demande (validation/refus).</summary>
    [Column("contraitepar")]
    [StringLength(12)]
    public string? Contraitepar { get; set; }

    /// <summary>Horodatage du traitement (validation/refus).</summary>
    [Column("contraitedat", TypeName = "timestamp without time zone")]
    public DateTime? Contraitedat { get; set; }

    /// <summary>Commentaire libre saisi par le validateur (motif de refus, contexte
    /// d'approbation conditionnelle). Affiché à l'employé dans la notif/email.</summary>
    [Column("concommentaire")]
    [StringLength(500)]
    public string? Concommentaire { get; set; }
}
