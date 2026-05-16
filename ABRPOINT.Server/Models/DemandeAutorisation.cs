using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace ABRPOINT.Server.Models;

[Table("demande_autorisation")]
public class DemandeAutorisation : BaseEntity
{
    [Key]
    [DatabaseGenerated(DatabaseGeneratedOption.Identity)]
    [Column("id")]
    public int Id { get; set; }

    [Required]
    [Column("soccod")]
    [StringLength(2)]
    public string Soccod { get; set; } = string.Empty;

    [Required]
    [Column("empcod")]
    [StringLength(12)]
    public string Empcod { get; set; } = string.Empty;

    [Column("concod")]
    [StringLength(10)]
    public string? Concod { get; set; }

    [Column("condat", TypeName = "timestamp without time zone")]
    public DateTime? Condat { get; set; }

    [Column("condep", TypeName = "timestamp without time zone")]
    public DateTime? Condep { get; set; }

    [Column("conret", TypeName = "timestamp without time zone")]
    public DateTime? Conret { get; set; }

    [Column("connbjour")]
    public float? Connbjour { get; set; }

    [Column("conmotif")]
    [StringLength(200)]
    public string? Conmotif { get; set; }

    [Column("statut")]
    [StringLength(20)]
    public string Statut { get; set; } = "En attente";

    [Column("date_demande", TypeName = "timestamp without time zone")]
    public DateTime? DateDemande { get; set; }

    [Column("traite_par")]
    [StringLength(12)]
    public string? TraitePar { get; set; }

    [Column("date_traitement", TypeName = "timestamp without time zone")]
    public DateTime? DateTraitement { get; set; }

    [Column("commentaire")]
    [StringLength(500)]
    public string? Commentaire { get; set; }

    [Column("abscod")]
    [StringLength(4)]
    public string? Abscod { get; set; }
}
