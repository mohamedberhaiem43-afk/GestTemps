using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace ABRPOINT.Server.Models;

/// <summary>
/// Modèle de courrier réutilisable. Le corps HTML peut contenir des placeholders
/// <c>{{variable}}</c> qui seront remplacés par les données employé/contrat/société
/// au moment de la génération. Une option de polish IA permet à Claude de reformuler
/// le ton après substitution.
/// </summary>
[Table("rag_letter_template")]
public class RagLetterTemplate
{
    [Key]
    [DatabaseGenerated(DatabaseGeneratedOption.Identity)]
    [Column("id")]
    public int Id { get; set; }

    [Required]
    [StringLength(6)]
    [Column("soccod")]
    public string Soccod { get; set; } = string.Empty;

    [Required]
    [StringLength(120)]
    [Column("name")]
    public string Name { get; set; } = string.Empty;

    [StringLength(500)]
    [Column("description")]
    public string? Description { get; set; }

    [Required]
    [Column("body_html")]
    public string BodyHtml { get; set; } = string.Empty;

    /// <summary>JSON sérialisé : ["empnom","empcod","soclib", ...] — auto-détecté à l'écriture.</summary>
    [Column("placeholders_json")]
    public string? PlaceholdersJson { get; set; }

    [StringLength(20)]
    [Column("category")]
    public string? Category { get; set; }

    [Column("created_at")]
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    [Column("updated_at")]
    public DateTime? UpdatedAt { get; set; }
}
