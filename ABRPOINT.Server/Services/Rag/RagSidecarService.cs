using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Serialization;
using ABRPOINT.Server.Tenancy;
using Microsoft.Extensions.Options;

namespace ABRPOINT.Server.Services.Rag;

/// <summary>
/// Implémentation HTTP de <see cref="IRagSidecarService"/>. Tout passe par le sidecar Python
/// rag-svc — aucune dépendance Qdrant ou modèle ML directement en .NET. La BaseAddress, le
/// timeout et le header d'auth sont configurés au niveau de <c>AddHttpClient</c>.
/// </summary>
public sealed class RagSidecarService : IRagSidecarService
{
    private readonly HttpClient _http;
    private readonly RagOptions _options;
    private readonly ICurrentTenant _currentTenant;
    private readonly ILogger<RagSidecarService> _logger;

    private static readonly JsonSerializerOptions JsonOpts = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.SnakeCaseLower,
        DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull
    };

    public RagSidecarService(
        HttpClient http,
        IOptions<RagOptions> options,
        ICurrentTenant currentTenant,
        ILogger<RagSidecarService> logger)
    {
        _http = http;
        _options = options.Value;
        _currentTenant = currentTenant;
        _logger = logger;
    }

    public async Task<RagIngestResult> IngestAsync(string soccod, int documentId, string originalName, string contentType, Stream content, CancellationToken ct = default)
    {
        AssertSoccodMatchesTenant(soccod);
        EnsureEnabledOrThrow();

        using var form = new MultipartFormDataContent();
        var streamContent = new StreamContent(content);
        streamContent.Headers.ContentType = MediaTypeHeaderValue.Parse(contentType);
        form.Add(streamContent, "file", originalName);
        form.Add(new StringContent(soccod), "soccod");
        form.Add(new StringContent(documentId.ToString()), "document_id");
        form.Add(new StringContent(originalName), "original_name");

        using var resp = await _http.PostAsync("ingest", form, ct);
        await EnsureSuccess(resp, "ingest");
        var payload = await resp.Content.ReadFromJsonAsync<IngestResponse>(JsonOpts, ct)
                      ?? throw new InvalidOperationException("Sidecar /ingest returned empty body.");
        return new RagIngestResult(payload.ChunksCount, payload.Pages);
    }

    public async Task<IReadOnlyList<RagChunk>> RetrieveAsync(string soccod, string query, int topK = 5, CancellationToken ct = default)
    {
        AssertSoccodMatchesTenant(soccod);
        if (!_options.Enabled) return Array.Empty<RagChunk>();

        var request = new RetrieveRequest(soccod, query, topK);
        using var resp = await _http.PostAsJsonAsync("retrieve", request, JsonOpts, ct);
        await EnsureSuccess(resp, "retrieve");
        var payload = await resp.Content.ReadFromJsonAsync<RetrieveResponse>(JsonOpts, ct)
                      ?? throw new InvalidOperationException("Sidecar /retrieve returned empty body.");
        return payload.Results
            .Select(r => new RagChunk(r.Text, r.DocumentId, r.DocumentName, r.Page, r.Score))
            .ToList();
    }

    public async Task<float[][]> EmbedAsync(IEnumerable<string> texts, CancellationToken ct = default)
    {
        EnsureEnabledOrThrow();
        var request = new EmbedRequest(texts.ToArray());
        using var resp = await _http.PostAsJsonAsync("embed", request, JsonOpts, ct);
        await EnsureSuccess(resp, "embed");
        var payload = await resp.Content.ReadFromJsonAsync<EmbedResponse>(JsonOpts, ct)
                      ?? throw new InvalidOperationException("Sidecar /embed returned empty body.");
        return payload.Embeddings;
    }

    public async Task DeleteDocumentAsync(string soccod, int documentId, CancellationToken ct = default)
    {
        AssertSoccodMatchesTenant(soccod);
        if (!_options.Enabled) return;

        using var resp = await _http.DeleteAsync($"documents/{Uri.EscapeDataString(soccod)}/{documentId}", ct);
        await EnsureSuccess(resp, "delete");
    }

    public async Task<bool> HealthAsync(CancellationToken ct = default)
    {
        if (!_options.Enabled) return false;
        try
        {
            using var resp = await _http.GetAsync("health", ct);
            return resp.IsSuccessStatusCode;
        }
        catch (Exception ex)
        {
            // Log silencieux : le healthcheck est appelé en boucle, pas la peine de polluer.
            _logger.LogDebug(ex, "Sidecar health check failed");
            return false;
        }
    }

    private void EnsureEnabledOrThrow()
    {
        if (!_options.Enabled)
            throw new InvalidOperationException("RAG désactivé (Rag:Enabled=false). Démarrez qdrant + rag-svc puis activez la feature.");
    }

    /// <summary>
    /// Garde-fou : le caller doit passer un soccod qui correspond au tenant courant.
    /// Empêche un controller bogué de leak des données entre tenants.
    /// </summary>
    private void AssertSoccodMatchesTenant(string soccod)
    {
        var current = _currentTenant.Current?.LegacySoccod;
        // En mode admin global / batch, _currentTenant peut être null — on tolère mais on log.
        if (string.IsNullOrEmpty(current))
        {
            _logger.LogDebug("RagSidecar called without active tenant context (soccod={Soccod})", soccod);
            return;
        }
        if (!string.Equals(current, soccod, StringComparison.Ordinal))
        {
            throw new UnauthorizedAccessException(
                $"Cross-tenant call rejected: caller soccod={soccod} but current tenant soccod={current}.");
        }
    }

    private static async Task EnsureSuccess(HttpResponseMessage resp, string op)
    {
        if (resp.IsSuccessStatusCode) return;
        var body = await resp.Content.ReadAsStringAsync();
        throw new HttpRequestException(
            $"rag-sidecar /{op} failed with {(int)resp.StatusCode} {resp.ReasonPhrase}: {body}",
            null,
            resp.StatusCode);
    }

    // Wire types — snake_case via JsonOpts pour matcher Pydantic côté Python.
    private sealed record IngestResponse(int ChunksCount, int Pages);
    private sealed record RetrieveRequest(string Soccod, string Query, int TopK);
    private sealed record RetrieveResponse(List<RetrieveItem> Results);
    private sealed record RetrieveItem(string Text, int DocumentId, string? DocumentName, int? Page, float Score);
    private sealed record EmbedRequest(string[] Texts);
    private sealed record EmbedResponse(float[][] Embeddings);
}
