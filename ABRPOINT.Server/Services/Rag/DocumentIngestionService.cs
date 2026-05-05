using ABRPOINT.Server.Data;
using ABRPOINT.Server.Helpers;
using Microsoft.EntityFrameworkCore;

namespace ABRPOINT.Server.Services.Rag;

public sealed class DocumentIngestionService : IDocumentIngestionService
{
    private readonly ApplicationDbContext _db;
    private readonly IRagSidecarService _sidecar;
    private readonly ILogger<DocumentIngestionService> _logger;

    public DocumentIngestionService(
        ApplicationDbContext db,
        IRagSidecarService sidecar,
        ILogger<DocumentIngestionService> logger)
    {
        _db = db;
        _sidecar = sidecar;
        _logger = logger;
    }

    public async Task IngestAsync(int documentId, CancellationToken ct = default)
    {
        var doc = await _db.RagDocuments.FirstOrDefaultAsync(d => d.Id == documentId, ct);
        if (doc == null)
        {
            _logger.LogWarning("Ingestion: document {Id} not found", documentId);
            return;
        }

        var path = Path.Combine(DocumentVaultService.GetTenantRagDir(doc.Soccod), doc.Filename);
        if (!File.Exists(path))
        {
            doc.Status = "failed";
            doc.ErrorMessage = "Fichier introuvable sur disque.";
            await _db.SaveChangesAsync(ct);
            _logger.LogWarning("Ingestion: file missing for document {Id} at {Path}", documentId, path);
            return;
        }

        try
        {
            await using var fs = new FileStream(path, FileMode.Open, FileAccess.Read, FileShare.Read);
            var result = await _sidecar.IngestAsync(doc.Soccod, doc.Id, doc.OriginalName, doc.ContentType, fs, ct);

            doc.Status = "indexed";
            doc.ChunksCount = result.ChunksCount;
            doc.ErrorMessage = null;
            await _db.SaveChangesAsync(ct);
            _logger.LogInformation("Ingestion OK for {Id}: {Chunks} chunks across {Pages} pages", documentId, result.ChunksCount, result.Pages);
        }
        catch (Exception ex)
        {
            doc.Status = "failed";
            doc.ErrorMessage = Truncate(ex.Message, 500);
            await _db.SaveChangesAsync(CancellationToken.None);
            _logger.LogError(ex, "Ingestion failed for document {Id}", documentId);
        }
    }

    private static string Truncate(string s, int max)
        => string.IsNullOrEmpty(s) ? s : (s.Length <= max ? s : s[..max]);
}
