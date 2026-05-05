namespace ABRPOINT.Server.Dtaos;

public sealed class RagChatRequest
{
    public string Question { get; set; } = string.Empty;
    public int TopK { get; set; } = 5;
}

public sealed class RagChatSource
{
    public int DocumentId { get; set; }
    public string? DocumentName { get; set; }
    public int? Page { get; set; }
    public string Snippet { get; set; } = string.Empty;
    public float Score { get; set; }
}

public sealed class RagChatAnswer
{
    public long LogId { get; set; }
    public string Answer { get; set; } = string.Empty;
    public List<RagChatSource> Sources { get; set; } = new();
    public int? TokensIn { get; set; }
    public int? TokensOut { get; set; }
    public int LatencyMs { get; set; }
}

public sealed class RagChatLogDto
{
    public long Id { get; set; }
    public string Category { get; set; } = "chat";
    public string? Uticod { get; set; }
    public string? Question { get; set; }
    public string? Answer { get; set; }
    public List<RagChatSource>? Sources { get; set; }
    public int? TokensIn { get; set; }
    public int? TokensOut { get; set; }
    public int? LatencyMs { get; set; }
    public DateTime CreatedAt { get; set; }
    public byte? FeedbackScore { get; set; }
    public string? FeedbackComment { get; set; }
}

public sealed class RagFeedbackRequest
{
    /// <summary>1 = pas utile, 5 = très utile.</summary>
    public byte Score { get; set; }
    public string? Comment { get; set; }
}
