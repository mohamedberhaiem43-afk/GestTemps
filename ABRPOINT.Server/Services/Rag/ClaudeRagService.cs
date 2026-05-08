using System.Diagnostics;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;
using ABRPOINT.Server.Data;
using ABRPOINT.Server.Dtaos;
using ABRPOINT.Server.Models;
using ABRPOINT.Server.Tenancy;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace ABRPOINT.Server.Services.Rag;

public sealed class ClaudeRagService : IClaudeRagService
{
    private readonly IRagSidecarService _sidecar;
    private readonly HttpClient _http;
    private readonly RagOptions _options;
    private readonly IConfiguration _config;
    private readonly ApplicationDbContext _db;
    private readonly ICurrentTenant _currentTenant;
    private readonly ILogger<ClaudeRagService> _logger;

    // Regex grossière pour masquer les CIN françaises/tunisiennes (8-13 chiffres consécutifs).
    // Pas parfait, mais suffisant pour ne pas envoyer un CIN clair à un LLM externe.
    private static readonly Regex PiiMaskCin = new(@"\b\d{8,13}\b", RegexOptions.Compiled);

    public ClaudeRagService(
        IRagSidecarService sidecar,
        HttpClient http,
        IOptions<RagOptions> options,
        IConfiguration config,
        ApplicationDbContext db,
        ICurrentTenant currentTenant,
        ILogger<ClaudeRagService> logger)
    {
        _sidecar = sidecar;
        _http = http;
        _options = options.Value;
        _config = config;
        _db = db;
        _currentTenant = currentTenant;
        _logger = logger;
    }

    public async Task<RagChatAnswer> AskAsync(string question, int topK, string? uticod, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(question))
            throw new ArgumentException("Question vide.", nameof(question));

        var soccod = _currentTenant.Current?.LegacySoccod
            ?? throw new InvalidOperationException("Tenant context manquant.");

        var sw = Stopwatch.StartNew();

        // 1. Retrieve top-k via sidecar (filtré soccod côté Python). Si le sidecar est
        //    indisponible (Connection refused), on continue avec un contexte vide plutôt
        //    que de planter — l'utilisateur recevra une réponse "pas d'info" plutôt qu'une
        //    erreur 500. La cause sera visible dans les logs et le healthcheck.
        IReadOnlyList<RagChunk> chunks;
        try
        {
            chunks = await _sidecar.RetrieveAsync(soccod, question, Math.Clamp(topK, 1, 20), ct);
        }
        catch (HttpRequestException ex)
        {
            _logger.LogWarning(ex, "Sidecar RAG indisponible pendant retrieve — réponse sans contexte");
            chunks = Array.Empty<RagChunk>();
        }

        // 2. Masquage PII avant inclusion dans le prompt.
        var contextBlocks = chunks
            .Select((c, i) => new
            {
                Index = i + 1,
                Document = c.DocumentName ?? $"Document #{c.DocumentId}",
                Page = c.Page,
                Text = MaskPii(c.Text),
                c.DocumentId,
                c.Score
            })
            .ToList();

        var contextText = contextBlocks.Count == 0
            ? "(aucun extrait pertinent trouvé dans les documents du tenant)"
            : string.Join("\n\n", contextBlocks.Select(b =>
                $"[Source {b.Index}] {b.Document}{(b.Page.HasValue ? $", page {b.Page}" : "")}\n{b.Text}"));

        // 3. Construction du prompt système.
        const string systemPrompt = @"Tu es l'assistant juridique RH de Concorde Workforce, la plateforme française de gestion du temps et de la paie.
Réponds UNIQUEMENT à partir des extraits fournis ci-dessous. Si l'information manque ou
n'est pas dans les sources, dis-le explicitement et propose une reformulation.
Cite chaque affirmation entre crochets avec le numéro de source : [Source 1], [Source 2]...
N'invente jamais de chiffre, de date ou d'article de loi qui ne figure pas dans le contexte.
Réponds en français, dans un ton professionnel et concis.";

        var userMessage = $"Question : {question}\n\nExtraits disponibles :\n{contextText}";

        // 4. Appel LLM (OpenRouter par défaut, Anthropic direct si configuré).
        var (answer, tokensIn, tokensOut) = await CallLlmAsync(systemPrompt, userMessage, ct);

        sw.Stop();
        var latencyMs = (int)sw.ElapsedMilliseconds;

        // 5. Persiste l'audit (sources stockées en JSON pour ré-affichage).
        var sources = contextBlocks.Select(b => new RagChatSource
        {
            DocumentId = b.DocumentId,
            DocumentName = b.Document,
            Page = b.Page,
            Snippet = Truncate(b.Text, 280),
            Score = b.Score
        }).ToList();

        var log = new RagChatLog
        {
            Soccod = soccod,
            Uticod = uticod,
            Category = "chat",
            Question = Truncate(question, 1000),
            Answer = answer,
            SourcesJson = JsonSerializer.Serialize(sources),
            TokensIn = tokensIn,
            TokensOut = tokensOut,
            LatencyMs = latencyMs,
            CreatedAt = DateTime.UtcNow
        };
        _db.RagChatLogs.Add(log);
        await _db.SaveChangesAsync(ct);

        return new RagChatAnswer
        {
            LogId = log.Id,
            Answer = answer,
            Sources = sources,
            TokensIn = tokensIn,
            TokensOut = tokensOut,
            LatencyMs = latencyMs
        };
    }

    public async Task<string> PolishAsync(string content, string? toneHint, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(content)) return content;

        var tone = string.IsNullOrWhiteSpace(toneHint) ? "professionnel et formel" : toneHint!.Trim();
        var systemPrompt = $@"Tu es un assistant rédactionnel RH. On te fournit un courrier français au format HTML
(les variables ont déjà été substituées). Reformule UNIQUEMENT le texte pour qu'il soit
{tone}, en conservant strictement :
- le contenu informatif et les chiffres,
- la structure HTML (mêmes balises, mêmes attributs),
- les noms propres et dates inchangés.
Ne commente pas, ne préfixe pas — renvoie directement le HTML reformulé.";

        var (answer, _, _) = await CallLlmAsync(systemPrompt, content, ct);
        return answer;
    }

    public async Task<bool> RecordFeedbackAsync(long logId, byte score, string? comment, CancellationToken ct = default)
    {
        if (score < 1 || score > 5) return false;

        var soccod = _currentTenant.Current?.LegacySoccod;
        var log = await _db.RagChatLogs.FirstOrDefaultAsync(l => l.Id == logId && l.Soccod == soccod, ct);
        if (log == null) return false;

        log.FeedbackScore = score;
        log.FeedbackComment = string.IsNullOrWhiteSpace(comment) ? null : Truncate(comment, 500);
        await _db.SaveChangesAsync(ct);
        return true;
    }

    /// <summary>
    /// Dispatcher : appelle OpenRouter (Chat Completions, OpenAI-compatible) par défaut,
    /// ou Anthropic direct (Messages) si l'utilisateur a configuré une clé Anthropic
    /// avec <c>UseOpenRouter=false</c>.
    /// </summary>
    private async Task<(string Answer, int? TokensIn, int? TokensOut)> CallLlmAsync(string systemPrompt, string userMessage, CancellationToken ct)
    {
        if (_options.Anthropic.UseOpenRouter)
        {
            return await CallOpenRouterAsync(systemPrompt, userMessage, ct);
        }
        if (string.IsNullOrEmpty(_options.Anthropic.ApiKey))
            throw new InvalidOperationException("Aucune clé LLM configurée (Rag:Anthropic:ApiKey ou OpenRouter:ApiKey).");
        return await CallAnthropicAsync(systemPrompt, userMessage, ct);
    }

    private async Task<(string Answer, int? TokensIn, int? TokensOut)> CallOpenRouterAsync(string systemPrompt, string userMessage, CancellationToken ct)
    {
        var key = _config["OpenRouter:ApiKey"];
        if (string.IsNullOrEmpty(key))
            throw new InvalidOperationException("OpenRouter:ApiKey non configurée.");

        var model = _options.Anthropic.OpenRouterModel;

        // Format Chat Completions (OpenAI-compatible). OpenRouter accepte aussi
        // optionnellement les headers HTTP-Referer/X-Title pour l'attribution.
        var requestBody = new
        {
            model,
            max_tokens = _options.Anthropic.MaxTokens,
            temperature = _options.Anthropic.Temperature,
            messages = new[]
            {
                new { role = "system", content = systemPrompt },
                new { role = "user", content = userMessage }
            }
        };

        using var req = new HttpRequestMessage(HttpMethod.Post, "https://openrouter.ai/api/v1/chat/completions");
        req.Headers.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", key);
        req.Headers.TryAddWithoutValidation("HTTP-Referer", "https://concorde-work-force.com");
        req.Headers.TryAddWithoutValidation("X-Title", "Concorde Workforce RAG");
        req.Content = new StringContent(JsonSerializer.Serialize(requestBody), Encoding.UTF8, "application/json");

        using var resp = await _http.SendAsync(req, ct);
        var raw = await resp.Content.ReadAsStringAsync(ct);

        if (!resp.IsSuccessStatusCode)
        {
            _logger.LogError("OpenRouter error {Status}: {Body}", (int)resp.StatusCode, raw);
            throw new HttpRequestException($"OpenRouter error {(int)resp.StatusCode}: {raw}");
        }

        using var doc = JsonDocument.Parse(raw);
        var root = doc.RootElement;

        // Réponse Chat Completions : { choices:[{ message:{ content } }], usage:{ prompt_tokens, completion_tokens } }
        var text = "";
        if (root.TryGetProperty("choices", out var choices) && choices.ValueKind == JsonValueKind.Array && choices.GetArrayLength() > 0)
        {
            var msg = choices[0].GetProperty("message");
            if (msg.TryGetProperty("content", out var contentEl))
            {
                text = contentEl.GetString() ?? "";
            }
        }

        int? inT = null, outT = null;
        if (root.TryGetProperty("usage", out var usage))
        {
            if (usage.TryGetProperty("prompt_tokens", out var i) && i.ValueKind == JsonValueKind.Number) inT = i.GetInt32();
            if (usage.TryGetProperty("completion_tokens", out var o) && o.ValueKind == JsonValueKind.Number) outT = o.GetInt32();
        }

        return (string.IsNullOrEmpty(text) ? "(réponse vide)" : text, inT, outT);
    }

    private async Task<(string Answer, int? TokensIn, int? TokensOut)> CallAnthropicAsync(string systemPrompt, string userMessage, CancellationToken ct)
    {
        var requestBody = new
        {
            model = _options.Anthropic.Model,
            max_tokens = _options.Anthropic.MaxTokens,
            temperature = _options.Anthropic.Temperature,
            system = systemPrompt,
            messages = new[]
            {
                new { role = "user", content = userMessage }
            }
        };

        var url = $"{_options.Anthropic.BaseUrl.TrimEnd('/')}/v1/messages";
        using var req = new HttpRequestMessage(HttpMethod.Post, url);
        req.Headers.Add("x-api-key", _options.Anthropic.ApiKey);
        req.Headers.Add("anthropic-version", "2023-06-01");
        req.Content = new StringContent(JsonSerializer.Serialize(requestBody), Encoding.UTF8, "application/json");

        using var resp = await _http.SendAsync(req, ct);
        var raw = await resp.Content.ReadAsStringAsync(ct);

        if (!resp.IsSuccessStatusCode)
        {
            _logger.LogError("Anthropic error {Status}: {Body}", (int)resp.StatusCode, raw);
            throw new HttpRequestException($"Anthropic API error {(int)resp.StatusCode}: {raw}");
        }

        using var doc = JsonDocument.Parse(raw);
        var root = doc.RootElement;

        var text = "";
        if (root.TryGetProperty("content", out var content) && content.ValueKind == JsonValueKind.Array)
        {
            foreach (var part in content.EnumerateArray())
            {
                if (part.TryGetProperty("type", out var type) &&
                    type.GetString() == "text" &&
                    part.TryGetProperty("text", out var t))
                {
                    text += t.GetString();
                }
            }
        }

        int? inT = null, outT = null;
        if (root.TryGetProperty("usage", out var usage))
        {
            if (usage.TryGetProperty("input_tokens", out var i) && i.ValueKind == JsonValueKind.Number) inT = i.GetInt32();
            if (usage.TryGetProperty("output_tokens", out var o) && o.ValueKind == JsonValueKind.Number) outT = o.GetInt32();
        }

        return (string.IsNullOrEmpty(text) ? "(réponse vide)" : text, inT, outT);
    }

    private static string MaskPii(string s)
        => string.IsNullOrEmpty(s) ? s : PiiMaskCin.Replace(s, "[REDACTED-ID]");

    private static string Truncate(string s, int max)
        => string.IsNullOrEmpty(s) ? s : (s.Length <= max ? s : s[..max]);
}
