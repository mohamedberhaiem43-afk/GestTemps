using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace ABRPOINT.Server.Models;

[Table("societe")]
public partial class Societe : BaseEntity
{
    [Key]
    [Column("soccod")]
    [StringLength(2)]
    public string Soccod { get; set; } = null!;

    [Column("soclib")]
    [StringLength(30)]
    public string? Soclib { get; set; }

    [Column("socresp")]
    [StringLength(30)]
    public string? Socresp { get; set; }

    [Column("socadr")]
    [StringLength(40)]
    public string? Socadr { get; set; }

    [Column("socville")]
    [StringLength(60)]
    public string? Socville { get; set; }

    [Column("soctel")]
    [StringLength(20)]
    public string? Soctel { get; set; }

    [Column("socfax")]
    [StringLength(20)]
    public string? Socfax { get; set; }

    [Column("socemail")]
    [StringLength(30)]
    public string? Socemail { get; set; }

    [Column("socccb")]
    [StringLength(1)]
    public string? Socccb { get; set; }

    [Column("soctva")]
    [StringLength(10)]
    public string? Soctva { get; set; }

    [Column("soctva1")]
    [StringLength(1)]
    public string? Soctva1 { get; set; }

    [Column("soctva2")]
    [StringLength(1)]
    public string? Soctva2 { get; set; }

    [Column("soctva3")]
    [StringLength(1)]
    public string? Soctva3 { get; set; }

    [Column("soctva000")]
    [StringLength(3)]
    public string? Soctva000 { get; set; }

    [Column("socreg")]
    public int? Socreg { get; set; }

    [Column("socmois")]
    public int? Socmois { get; set; }

    [Column("soctype")]
    [StringLength(1)]
    public string? Soctype { get; set; }

    [Column("socpresence")]
    [StringLength(1)]
    public string? Socpresence { get; set; }

    [Column("sochsup")]
    [StringLength(1)]
    public string? Sochsup { get; set; }

    [Column("socmere")]
    [StringLength(6)]
    public string? Socmere { get; set; }

    [Column("socsmig")]
    public double? Socsmig { get; set; }

    [Column("soclibar")]
    [StringLength(100)]
    public string? Soclibar { get; set; }

    [Column("socadrar")]
    [StringLength(100)]
    public string? Socadrar { get; set; }

    [Column("socrespar")]
    [StringLength(30)]
    public string? Socrespar { get; set; }

    [Column("socimg")]
    [StringLength(500)]
    public string? Socimg { get; set; }

    /// <summary>
    /// Branding personnalisé (option Premium / addon CustomBranding) : JSON des couleurs
    /// de base de la plateforme choisies par le tenant, ex.
    /// <c>{"primary":"#0040a1","background":"#f7f9fb","title":"#1e293b"}</c>.
    /// NULL = thème par défaut. Exposé au front via /Utilisateurs/me (champ "branding").
    /// </summary>
    [Column("socbranding")]
    [StringLength(1000)]
    public string? Socbranding { get; set; }

    /// <summary>
    /// Politique de pointage hors zone (geofence) : '1' = ACCEPTER les pointages effectués hors
    /// du périmètre du site, avec notification de l'employeur. '0'/null = REFUSER (défaut, sécurité).
    /// Lu par PresencesController.MarkPresence.
    /// </summary>
    [Column("socgeohorszone")]
    [StringLength(1)]
    public string? Socgeohorszone { get; set; }
}
