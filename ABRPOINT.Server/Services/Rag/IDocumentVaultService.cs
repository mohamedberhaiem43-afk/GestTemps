using ABRPOINT.Server.Dtaos;

namespace ABRPOINT.Server.Services.Rag;

/// <summary>
/// CRUD du coffre-fort de documents juridiques par tenant. Gère le fichier physique
/// sur disque et la métadonnée SQL ; délègue l'indexation Qdrant à
/// <see cref="IDocumentIngestionService"/>.
/// </summary>
public interface IDocumentVaultService
{
    Task<RagDocumentDto> UploadAsync(IFormFile file, string category, string? uploadedBy, CancellationToken ct = default);
    Task<IReadOnlyList<RagDocumentDto>> ListAsync(CancellationToken ct = default);
    Task<bool> DeleteAsync(int id, CancellationToken ct = default);
    Task<(Stream Stream, string ContentType, string FileName)?> DownloadAsync(int id, CancellationToken ct = default);
    /// <summary>Relance l'ingestion d'un document existant (utile après échec d'index).</summary>
    Task<bool> ReindexAsync(int id, CancellationToken ct = default);
}
