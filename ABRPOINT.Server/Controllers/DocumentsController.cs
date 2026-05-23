using System.Security.Claims;
using ABRPOINT.Server.Annotations.AdminAttributes;
using ABRPOINT.Server.Billing;
using ABRPOINT.Server.Services.Rag;
using ABRPOINT.Server.Tenancy;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace ABRPOINT.Server.Controllers;

/// <summary>
/// Coffre-fort de documents juridiques par tenant. Upload + liste + suppression + réindexation.
/// L'isolation soccod est garantie par <see cref="DocumentVaultService"/> qui lit
/// <c>ICurrentTenant</c> ; les paramètres de route ne portent pas le soccod pour éviter
/// toute usurpation côté client.
/// </summary>
[Route("api/[controller]")]
[ApiController]
[Authorize]
[Admin]
// Coffre-fort de documents juridiques = même feature commerciale que VaultController
// (DigitalVault). Sur Starter (DigitalVault=false), le backend renvoie 402 ; le sidebar
// est déjà masqué côté front (cf. Navigation.tsx, gating planAllows('digitalVault')).
[RequirePlanFeature(nameof(PlanFeatures.DigitalVault))]
public class DocumentsController : ControllerBase
{
    private readonly IDocumentVaultService _vault;
    private readonly IStorageQuotaGuard _quotaGuard;
    private readonly ICurrentTenant _currentTenant;

    public DocumentsController(
        IDocumentVaultService vault,
        IStorageQuotaGuard quotaGuard,
        ICurrentTenant currentTenant)
    {
        _vault = vault;
        _quotaGuard = quotaGuard;
        _currentTenant = currentTenant;
    }

    /// <summary>POST /api/Documents/upload — multipart : file + category.</summary>
    [HttpPost("upload")]
    [RequestSizeLimit(40 * 1024 * 1024)] // 40 Mo (config service plafonne à 25 par défaut)
    public async Task<IActionResult> Upload([FromForm] IFormFile file, [FromForm] string? category, CancellationToken ct)
    {
        try
        {
            // Garde quota : on bloque AVANT d'invoquer _vault.UploadAsync (qui écrit
            // le fichier + indexe dans Qdrant). 507 Insufficient Storage côté HTTP.
            if (file is not null && file.Length > 0 && _currentTenant.Current is { } tenant)
            {
                var snap = await _quotaGuard.CheckAsync(tenant.Id, file.Length, ct);
                if (snap.WouldExceed)
                {
                    return StatusCode(507, new
                    {
                        code = "storage_quota_exceeded",
                        message = $"Quota de stockage atteint ({snap.UsedMb} Mo / {snap.QuotaMb} Mo). " +
                                  "Supprimez des documents ou passez à un pack supérieur.",
                        usedMb = snap.UsedMb,
                        quotaMb = snap.QuotaMb,
                        percentUsed = snap.PercentUsed,
                    });
                }
            }
            var uploadedBy = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            var dto = await _vault.UploadAsync(file, category ?? "autre", uploadedBy, ct);
            return Ok(dto);
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { error = "Erreur interne. Consultez les logs serveur pour le détail." });
        }
    }

    /// <summary>GET /api/Documents — liste les documents du tenant courant.</summary>
    [HttpGet]
    public async Task<IActionResult> List(CancellationToken ct)
    {
        var docs = await _vault.ListAsync(ct);
        return Ok(docs);
    }

    /// <summary>DELETE /api/Documents/{id} — supprime fichier + chunks Qdrant + ligne SQL.</summary>
    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Delete(int id, CancellationToken ct)
    {
        var ok = await _vault.DeleteAsync(id, ct);
        return ok ? NoContent() : NotFound();
    }

    /// <summary>POST /api/Documents/{id}/reindex — relance l'indexation après échec.</summary>
    [HttpPost("{id:int}/reindex")]
    public async Task<IActionResult> Reindex(int id, CancellationToken ct)
    {
        var ok = await _vault.ReindexAsync(id, ct);
        return ok ? Accepted() : NotFound();
    }

    /// <summary>GET /api/Documents/{id}/download — récupère le fichier original.</summary>
    [HttpGet("{id:int}/download")]
    public async Task<IActionResult> Download(int id, CancellationToken ct)
    {
        var file = await _vault.DownloadAsync(id, ct);
        if (file == null) return NotFound();
        var (stream, contentType, fileName) = file.Value;
        return File(stream, contentType, fileName);
    }
}
