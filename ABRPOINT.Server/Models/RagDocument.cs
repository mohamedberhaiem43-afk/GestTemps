using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace ABRPOINT.Server.Models;

/// <summary>
/// Document juridique uploadé par le tenant (convention collective, règlement intérieur,
/// accord d'entreprise, etc.) puis indexé dans Qdrant via le sidecar Python.
/// Le fichier physique vit sur disque (./uploads/{soccod}/rag/{id}_{filename}.{ext}),
/// cette ligne ne stocke que les métadonnées.
/// </summary>
[Table("rag_document")]
public class RagDocument
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
    [StringLength(260)]
    [Column("filename")]
    public string Filename { get; set; } = string.Empty;

    [Required]
    [StringLength(260)]
    [Column("original_name")]
    public string OriginalName { get; set; } = string.Empty;

    [Required]
    [StringLength(80)]
    [Column("content_type")]
    public string ContentType { get; set; } = string.Empty;

    [Column("size_bytes")]
    public long SizeBytes { get; set; }

    /// <summary>convention | reglement | accord | autre</summary>
    [StringLength(20)]
    [Column("category")]
    public string Category { get; set; } = "autre";

    [StringLength(20)]
    [Column("uploaded_by")]
    public string? UploadedBy { get; set; }

    [Column("uploaded_at")]
    public DateTime UploadedAt { get; set; } = DateTime.UtcNow;

    /// <summary>pending | indexed | failed</summary>
    [StringLength(12)]
    [Column("status")]
    public string Status { get; set; } = "pending";

    [Column("chunks_count")]
    public int? ChunksCount { get; set; }

    [StringLength(500)]
    [Column("error_message")]
    public string? ErrorMessage { get; set; }
}
