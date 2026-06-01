using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace ABRPOINT.Server.Models;

/// <summary>
/// Liaison « type de demande → modèle de document » utilisée par le générateur pour
/// savoir quel template rendre pour un parcours de signature. soccod NULL = défaut global.
/// Cf. table <c>signature_template_map</c>.
/// </summary>
[Table("signature_template_map")]
public class SignatureTemplateMap
{
    [Key]
    [Column("id")]
    public int Id { get; set; }

    /// <summary>NULL = défaut global (tous tenants), sinon spécifique à une société.</summary>
    [Column("soccod")]
    [StringLength(6)]
    public string? Soccod { get; set; }

    /// <summary>'DemConge' | 'DemandeAutorisation' | 'DemandeAbsence' | 'Teletravail' | 'Manual'.</summary>
    [Required]
    [Column("source_type")]
    [StringLength(40)]
    public string SourceType { get; set; } = null!;

    /// <summary>'letter' (RagLetterTemplate par id) | 'vault_html' (fichier VaultTemplates) | 'frx' (FastReport).</summary>
    [Required]
    [Column("template_kind")]
    [StringLength(20)]
    public string TemplateKind { get; set; } = null!;

    /// <summary>Référence du modèle : id RagLetterTemplate, nom de fichier HTML, ou nom .frx.</summary>
    [Required]
    [Column("template_ref")]
    [StringLength(255)]
    public string TemplateRef { get; set; } = null!;
}
