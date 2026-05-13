using System.Security.Claims;
using ABRPOINT.Server.Annotations.AdminAttributes;
using ABRPOINT.Server.Services.Rag;
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
public class DocumentsController : ControllerBase
{
    private readonly IDocumentVaultService _vault;

    public DocumentsController(IDocumentVaultService vault)
    {
        _vault = vault;
    }

    /// <summary>POST /api/Documents/upload — multipart : file + category.</summary>
    [HttpPost("upload")]
    [RequestSizeLimit(40 * 1024 * 1024)] // 40 Mo (config service plafonne à 25 par défaut)
    public async Task<IActionResult> Upload([FromForm] IFormFile file, [FromForm] string? category, CancellationToken ct)
    {
        try
        {
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
