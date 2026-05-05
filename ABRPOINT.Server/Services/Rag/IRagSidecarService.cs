namespace ABRPOINT.Server.Services.Rag;

/// <summary>
/// Façade .NET du sidecar Python <c>rag-svc</c> (FastAPI + LangChain). Toute la chaîne
/// RAG (chunking, embeddings, opérations Qdrant) vit côté Python ; le .NET ne fait que
/// orchestrer et garantir l'isolation tenant. La clé Anthropic n'est jamais transmise
/// au sidecar — Claude est appelé directement depuis <see cref="IClaudeRagService"/>.
/// </summary>
public interface IRagSidecarService
{
    /// <summary>
    /// Déclenche l'ingestion d'un document : le sidecar le charge (PyPDFLoader/Docx2txtLoader/...),
    /// le découpe (RecursiveCharacterTextSplitter), calcule les embeddings <c>multilingual-e5-large</c>
    /// et upserte dans la collection <c>tenant_{soccod}</c> de Qdrant.
    /// </summary>
    Task<RagIngestResult> IngestAsync(string soccod, int documentId, string originalName, string contentType, Stream content, CancellationToken ct = default);

    /// <summary>
    /// Recherche des chunks pertinents pour la question. Le sidecar applique systématiquement
    /// le filtre <c>payload.soccod = {soccod}</c> sur la recherche Qdrant (défense en profondeur).
    /// </summary>
    Task<IReadOnlyList<RagChunk>> RetrieveAsync(string soccod, string query, int topK = 5, CancellationToken ct = default);

    /// <summary>
    /// Calcul d'embeddings ad-hoc (utilisé pour la recherche de similarité de templates de courrier).
    /// </summary>
    Task<float[][]> EmbedAsync(IEnumerable<string> texts, CancellationToken ct = default);

    /// <summary>
    /// Supprime tous les vecteurs d'un document dans Qdrant. Idempotent.
    /// </summary>
    Task DeleteDocumentAsync(string soccod, int documentId, CancellationToken ct = default);

    /// <summary>
    /// Healthcheck léger ; renvoie <c>false</c> si le sidecar ou Qdrant sont indisponibles.
    /// </summary>
    Task<bool> HealthAsync(CancellationToken ct = default);
}

public sealed record RagIngestResult(int ChunksCount, int Pages);

public sealed record RagChunk(
    string Text,
    int DocumentId,
    string? DocumentName,
    int? Page,
    float Score
);
