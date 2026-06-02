namespace ABRPOINT.Server.Services.Rag;

/// <summary>
/// Configuration injectée via <c>builder.Services.Configure&lt;RagOptions&gt;(builder.Configuration.GetSection("Rag"))</c>.
/// La clé Anthropic ne doit jamais être exposée au sidecar Python — elle reste côté .NET.
/// </summary>
public sealed class RagOptions
{
    /// <summary>
    /// Coupe-circuit global. Quand <c>false</c>, aucun appel HTTP n'est fait au sidecar
    /// (utile quand qdrant/rag-svc ne sont pas déployés). Les controllers Documents/ChatRag
    /// renvoient un 503 ou une réponse vide selon le cas, et l'ingestion marque les docs
    /// comme <c>failed</c> avec un message "service IA désactivé".
    /// Default true pour que la feature marche dès que le sidecar est lancé.
    /// </summary>
    public bool Enabled { get; set; } = true;

    public AnthropicOptions Anthropic { get; set; } = new();
    public SidecarOptions Sidecar { get; set; } = new();
    public IngestionOptions Ingestion { get; set; } = new();
    public RateLimitOptions RateLimit { get; set; } = new();
}

public sealed class AnthropicOptions
{
    /// <summary>
    /// RGPD — défaut désormais <c>false</c> : on appelle directement l'API
    /// Messages Anthropic, qui peut être servie depuis la région UE pour les
    /// comptes Enterprise (cf. <see cref="BaseUrl"/>). Cela élimine tout
    /// transfert hors UE.
    ///
    /// Quand <c>true</c>, le service RAG passe par OpenRouter (clé partagée
    /// <c>OpenRouter:ApiKey</c>) au format Chat Completions. À utiliser
    /// uniquement en environnement de développement ou si une décision
    /// documentée encadre le transfert hors UE (CCT + clause « no training »).
    /// Les appels OpenRouter ajoutent <c>provider.data_collection=deny</c> et
    /// <c>provider.allow_fallbacks=false</c> en defense in depth.
    /// </summary>
    public bool UseOpenRouter { get; set; } = false;

    /// <summary>
    /// Modèle OpenRouter utilisé quand <see cref="UseOpenRouter"/> est true.
    /// Défaut : Gemini 2.0 Flash — modèle stable et très bon marché (~$0.075/M tokens),
    /// déjà utilisé par le chatbot Gemini existant (clé OpenRouter partagée). Les modèles
    /// `:free` sont régulièrement rate-limited en amont par leurs providers — préférer
    /// un modèle payant léger pour la production.
    /// </summary>
    public string OpenRouterModel { get; set; } = "google/gemini-3.5-flash";

    /// <summary>
    /// Endpoint Anthropic. Par défaut <c>https://api.anthropic.com</c>. Pour
    /// garantir l'absence de transfert hors UE, configurer un compte Anthropic
    /// Enterprise avec résidence des données en UE (clause contractuelle) et
    /// conserver cette URL — Anthropic route les requêtes vers ses datacenters
    /// UE pour ces comptes. Alternative : passer par Vertex AI région
    /// <c>europe-west*</c> ou AWS Bedrock <c>eu-*</c> (SDK différent, non
    /// supporté par ce service).
    /// </summary>
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
