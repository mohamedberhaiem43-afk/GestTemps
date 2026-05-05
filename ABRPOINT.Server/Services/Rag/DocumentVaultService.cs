using ABRPOINT.Server.Data;
using ABRPOINT.Server.Dtaos;
using ABRPOINT.Server.Helpers;
using ABRPOINT.Server.Models;
using ABRPOINT.Server.Tenancy;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace ABRPOINT.Server.Services.Rag;

public sealed class DocumentVaultService : IDocumentVaultService
{
    private readonly ApplicationDbContext _db;
    private readonly ICurrentTenant _currentTenant;
    private readonly IRagSidecarService _sidecar;
    private readonly RagOptions _options;
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly ILogger<DocumentVaultService> _logger;

    private static readonly HashSet<string> _validCategories = new(StringComparer.OrdinalIgnoreCase)
    {
        "convention", "reglement", "accord", "autre"
    };

    public DocumentVaultService(
        ApplicationDbContext db,
        ICurrentTenant currentTenant,
        IRagSidecarService sidecar,
        IOptions<RagOptions> options,
        IServiceScopeFactory scopeFactory,
        ILogger<DocumentVaultService> logger)
    {
        _db = db;
        _currentTenant = currentTenant;
        _sidecar = sidecar;
        _options = options.Value;
        _scopeFactory = scopeFactory;
        _logger = logger;
    }

    public async Task<RagDocumentDto> UploadAsync(IFormFile file, string category, string? uploadedBy, CancellationToken ct = default)
    {
        var soccod = RequireSoccod();

        if (file == null || file.Length == 0)
            throw new ArgumentException("Fichier vide.", nameof(file));

        var maxBytes = _options.Ingestion.MaxFileMb * 1024L * 1024L;
        if (file.Length > maxBytes)
            throw new ArgumentException($"Fichier trop volumineux (max {_options.Ingestion.MaxFileMb} Mo).");

        var contentType = file.ContentType ?? "application/octet-stream";
        if (_options.Ingestion.AllowedTypes.Count > 0 &&
            !_options.Ingestion.AllowedTypes.Contains(contentType, StringComparer.OrdinalIgnoreCase))
        {
            throw new ArgumentException($"Type de fichier non autorisé : {contentType}.");
        }

        var safeCategory = _validCategories.Contains(category) ? category.ToLowerInvariant() : "autre";

        // 1) Persiste les métadonnées d'abord (status='pending') pour récupérer l'Id.
        var entity = new RagDocument
        {
            Soccod = soccod,
            Filename = string.Empty, // rempli après écriture disque
            OriginalName = SanitizeFileName(file.FileName ?? "document"),
            ContentType = contentType,
            SizeBytes = file.Length,
            Category = safeCategory,
            UploadedBy = uploadedBy,
            UploadedAt = DateTime.UtcNow,
            Status = "pending"
        };
        _db.RagDocuments.Add(entity);
        await _db.SaveChangesAsync(ct);

        // 2) Écrit le fichier sur disque sous ./uploads/{soccod}/rag/{id}_{name}.
        var ext = Path.GetExtension(entity.OriginalName);
        var diskName = $"{entity.Id}_{Guid.NewGuid():N}{ext}";
        var dir = GetTenantRagDir(soccod);
        Directory.CreateDirectory(dir);
        var fullPath = Path.Combine(dir, diskName);

        await using (var fs = new FileStream(fullPath, FileMode.Create))
        {
            await file.CopyToAsync(fs, ct);
        }

        entity.Filename = diskName;
        await _db.SaveChangesAsync(ct);

        // 3) Lance l'ingestion en arrière-plan (fire-and-forget). Une nouvelle scope est
        //    indispensable car _db (scoped) sera disposé à la fin de la requête HTTP.
        var docId = entity.Id;
        _ = Task.Run(async () =>
        {
            using var scope = _scopeFactory.CreateScope();
            // Propage le tenant courant dans la nouvelle scope (AsyncLocal n'est pas garanti
            // ici car Task.Run peut tourner sur un autre thread sans flow). On set explicitement.
            var tenantHolder = scope.ServiceProvider.GetRequiredService<ICurrentTenant>();
            if (_currentTenant.Current is { } activeTenant)
            {
                tenantHolder.Set(activeTenant);
            }
            try
            {
                var ingestion = scope.ServiceProvider.GetRequiredService<IDocumentIngestionService>();
                await ingestion.IngestAsync(docId);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Background ingestion failed for document {Id}", docId);
            }
            finally
            {
                tenantHolder.Clear();
            }
        }, CancellationToken.None);

        return ToDto(entity);
    }

    public async Task<IReadOnlyList<RagDocumentDto>> ListAsync(CancellationToken ct = default)
    {
        var soccod = RequireSoccod();
        return await _db.RagDocuments
            .Where(d => d.Soccod == soccod)
            .OrderByDescending(d => d.UploadedAt)
            .Select(d => new RagDocumentDto
            {
                Id = d.Id,
                OriginalName = d.OriginalName,
                ContentType = d.ContentType,
                SizeBytes = d.SizeBytes,
                Category = d.Category,
                UploadedBy = d.UploadedBy,
                UploadedAt = d.UploadedAt,
                Status = d.Status,
                ChunksCount = d.ChunksCount,
                ErrorMessage = d.ErrorMessage
            })
            .ToListAsync(ct);
    }

    public async Task<bool> DeleteAsync(int id, CancellationToken ct = default)
    {
        var soccod = RequireSoccod();
        var doc = await _db.RagDocuments.FirstOrDefaultAsync(d => d.Id == id && d.Soccod == soccod, ct);
        if (doc == null) return false;

        // 1) Supprime les vecteurs Qdrant via le sidecar (idempotent côté Python).
        try
        {
            await _sidecar.DeleteDocumentAsync(soccod, id, ct);
        }
        catch (Exception ex)
        {
            // Non bloquant : un sidecar HS ne doit pas empêcher la purge SQL/disque.
            _logger.LogWarning(ex, "Sidecar delete failed for document {Id}, continuing", id);
        }

        // 2) Supprime le fichier disque.
        try
        {
            var path = Path.Combine(GetTenantRagDir(soccod), doc.Filename);
            if (File.Exists(path)) File.Delete(path);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to delete file for document {Id}", id);
        }

        // 3) Supprime la ligne SQL.
        _db.RagDocuments.Remove(doc);
        await _db.SaveChangesAsync(ct);
        return true;
    }

    public async Task<(Stream Stream, string ContentType, string FileName)?> DownloadAsync(int id, CancellationToken ct = default)
    {
        var soccod = RequireSoccod();
        var doc = await _db.RagDocuments.FirstOrDefaultAsync(d => d.Id == id && d.Soccod == soccod, ct);
        if (doc == null) return null;

        var path = Path.Combine(GetTenantRagDir(soccod), doc.Filename);
        if (!File.Exists(path)) return null;

        var stream = new FileStream(path, FileMode.Open, FileAccess.Read, FileShare.Read, 4096, useAsync: true);
        return (stream, doc.ContentType, doc.OriginalName);
    }

    public async Task<bool> ReindexAsync(int id, CancellationToken ct = default)
    {
        var soccod = RequireSoccod();
        var doc = await _db.RagDocuments.FirstOrDefaultAsync(d => d.Id == id && d.Soccod == soccod, ct);
        if (doc == null) return false;

        doc.Status = "pending";
        doc.ErrorMessage = null;
        await _db.SaveChangesAsync(ct);

        var docId = doc.Id;
        _ = Task.Run(async () =>
        {
            using var scope = _scopeFactory.CreateScope();
            var tenantHolder = scope.ServiceProvider.GetRequiredService<ICurrentTenant>();
            if (_currentTenant.Current is { } activeTenant)
            {
                tenantHolder.Set(activeTenant);
            }
            try
            {
                var ingestion = scope.ServiceProvider.GetRequiredService<IDocumentIngestionService>();
                await ingestion.IngestAsync(docId);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Background reindex failed for document {Id}", docId);
            }
            finally
            {
                tenantHolder.Clear();
            }
        }, CancellationToken.None);

        return true;
    }

    private string RequireSoccod()
    {
        var soccod = _currentTenant.Current?.LegacySoccod;
        if (string.IsNullOrEmpty(soccod))
            throw new InvalidOperationException("No active tenant — Soccod is required.");
        return soccod;
    }

    internal static string GetTenantRagDir(string soccod)
    {
        // Concatène par-dessus FileHelper.GetUploadsPath pour rester cohérent avec les
        // autres uploads (logo société, profils utilisateurs, etc.).
        return Path.Combine(FileHelper.GetUploadsPath(), soccod, "rag");
    }

    private static string SanitizeFileName(string name)
    {
        var safe = Path.GetFileName(name); // strip directory traversal
        foreach (var c in Path.GetInvalidFileNameChars()) safe = safe.Replace(c, '_');
        return string.IsNullOrWhiteSpace(safe) ? "document" : safe;
    }

    private static RagDocumentDto ToDto(RagDocument d) => new()
    {
        Id = d.Id,
        OriginalName = d.OriginalName,
        ContentType = d.ContentType,
        SizeBytes = d.SizeBytes,
        Category = d.Category,
        UploadedBy = d.UploadedBy,
        UploadedAt = d.UploadedAt,
        Status = d.Status,
        ChunksCount = d.ChunksCount,
        ErrorMessage = d.ErrorMessage
    };
}
