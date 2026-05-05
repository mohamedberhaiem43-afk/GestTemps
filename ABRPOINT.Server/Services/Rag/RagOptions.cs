namespace ABRPOINT.Server.Services.Rag;

/// <summary>
/// Configuration injectée via <c>builder.Services.Configure&lt;RagOptions&gt;(builder.Configuration.GetSection("Rag"))</c>.
/// La clé Anthropic ne doit jamais être exposée au sidecar Python — elle reste côté .NET.
/// </summary>
public sealed class RagOptions
{
    public AnthropicOptions Anthropic { get; set; } = new();
    public SidecarOptions Sidecar { get; set; } = new();
    public IngestionOptions Ingestion { get; set; } = new();
    public RateLimitOptions RateLimit { get; set; } = new();
}

public sealed class AnthropicOptions
{
    public string BaseUrl { get; set; } = "https://api.anthropic.com";
    public string ApiKey { get; set; } = string.Empty;
    public string Model { get; set; } = "claude-sonnet-4-6";
    public int MaxTokens { get; set; } = 1024;
    public double Temperature { get; set; } = 0.2;
}

public sealed class SidecarOptions
{
    public string BaseUrl { get; set; } = "http://localhost:8090";
    public int TimeoutSeconds { get; set; } = 120;
    /// <summary>
    /// Secret partagé envoyé en header <c>X-Sidecar-Key</c>. Le sidecar Python rejette
    /// toute requête sans ce header. Empêche l'appel direct depuis l'extérieur du LAN Docker.
    /// </summary>
    public string ApiKey { get; set; } = string.Empty;
}

public sealed class IngestionOptions
{
    public int MaxFileMb { get; set; } = 25;
    public List<string> AllowedTypes { get; set; } = new()
    {
        "application/pdf",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "text/plain",
        "text/markdown"
    };
}

public sealed class RateLimitOptions
{
    public int QuestionsPerUserPerHour { get; set; } = 60;
    public int DocumentsPerTenantTotal { get; set; } = 200;
}
