using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace ABRPOINT.Server.Models;

/// <summary>
/// Journal d'audit RGPD pour chaque interaction IA (chat RAG ou génération de courrier).
/// Permet à l'admin tenant de revoir ce qui a été demandé et limite les abus.
/// </summary>
[Table("rag_chat_log")]
public class RagChatLog
{
    [Key]
    [DatabaseGenerated(DatabaseGeneratedOption.Identity)]
    [Column("id")]
    public long Id { get; set; }

    [Required]
    [StringLength(6)]
    [Column("soccod")]
    public string Soccod { get; set; } = string.Empty;

    [StringLength(20)]
    [Column("uticod")]
    public string? Uticod { get; set; }

    /// <summary>chat | letter_gen</summary>
    [Required]
    [StringLength(20)]
    [Column("category")]
    public string Category { get; set; } = "chat";

    [StringLength(1000)]
    [Column("question")]
    public string? Question { get; set; }

    [Column("answer")]
    public string? Answer { get; set; }

    /// <summary>JSON sérialisé : [{"document_id":1,"document_name":"...","page":3,"score":0.82,"snippet":"..."}, ...]</summary>
    [Column("sources_json")]
    public string? SourcesJson { get; set; }

    [Column("tokens_in")]
    public int? TokensIn { get; set; }

    [Column("tokens_out")]
    public int? TokensOut { get; set; }

    [Column("latency_ms")]
    public int? LatencyMs { get; set; }

    [Column("created_at")]
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    /// <summary>1-5 (utile / pas utile). Null = pas de feedback explicite.</summary>
    [Column("feedback_score")]
    public byte? FeedbackScore { get; set; }

    [StringLength(500)]
    [Column("feedback_comment")]
    public string? FeedbackComment { get; set; }
}
