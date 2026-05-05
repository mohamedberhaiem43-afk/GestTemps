namespace ABRPOINT.Server.Services.Rag;

/// <summary>
/// Pipeline d'indexation : lit le fichier disque, le pousse au sidecar Python pour
/// chunking + embeddings + upsert Qdrant, et met à jour le statut SQL.
/// </summary>
public interface IDocumentIngestionService
{
    Task IngestAsync(int documentId, CancellationToken ct = default);
}
