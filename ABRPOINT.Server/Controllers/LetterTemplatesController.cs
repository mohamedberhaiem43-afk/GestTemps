using System.Security.Claims;
using ABRPOINT.Server.Annotations.AdminAttributes;
using ABRPOINT.Server.Dtaos;
using ABRPOINT.Server.Services.Rag;
using ABRPOINT.Server.Tenancy;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace ABRPOINT.Server.Controllers;

/// <summary>
/// Modèles de courrier (CRUD admin) + génération (admin/manager).
/// La génération produit un binaire DOCX ou PDF prêt à télécharger ; l'éventuel polish IA
/// est tracé dans <c>rag_chat_log</c> avec catégorie <c>letter_gen</c>.
/// </summary>
[Route("api/[controller]")]
[ApiController]
[Authorize]
// Gating plan : les modèles de courrier sont couplés à la génération assistée RAG/IA
// (placeholders + éventuel polish via le ChatRagService). On les bloque donc sur les
// packs qui n'ont pas RagAi (Starter / Standard). Le sidebar est masqué en miroir
// côté front (cf. Navigation.tsx, gating planAllows('ragAi')).
[RequirePlanFeature(nameof(PlanFeatures.RagAi))]
public class LetterTemplatesController : ControllerBase
{
    private readonly ILetterGenerationService _service;

    public LetterTemplatesController(ILetterGenerationService service)
    {
        _service = service;
    }

    [HttpGet]
    public async Task<IActionResult> List(CancellationToken ct)
        => Ok(await _service.ListAsync(ct));

    [HttpGet("{id:int}")]
    public async Task<IActionResult> Get(int id, CancellationToken ct)
    {
        var dto = await _service.GetAsync(id, ct);
        return dto == null ? NotFound() : Ok(dto);
    }

    [HttpPost]
    [Admin]
    public async Task<IActionResult> Create([FromBody] RagLetterTemplateUpsertRequest req, CancellationToken ct)
    {
        try { return Ok(await _service.CreateAsync(req, ct)); }
        catch (ArgumentException ex) { return BadRequest(new { error = "Erreur interne. Consultez les logs serveur pour le détail." }); }
    }

    [HttpPut("{id:int}")]
    [Admin]
    public async Task<IActionResult> Update(int id, [FromBody] RagLetterTemplateUpsertRequest req, CancellationToken ct)
    {
        try
        {
            var dto = await _service.UpdateAsync(id, req, ct);
            return dto == null ? NotFound() : Ok(dto);
        }
        catch (ArgumentException ex) { return BadRequest(new { error = "Erreur interne. Consultez les logs serveur pour le détail." }); }
    }

    [HttpDelete("{id:int}")]
    [Admin]
    public async Task<IActionResult> Delete(int id, CancellationToken ct)
    {
        var ok = await _service.DeleteAsync(id, ct);
        return ok ? NoContent() : NotFound();
    }

    /// <summary>
    /// POST /api/LetterTemplates/generate — produit le DOCX/PDF rempli pour un employé.
    /// Réservé manager+ : l'attribut [Admin] est trop strict (un manager doit pouvoir générer
    /// un courrier), on filtrera la visibilité côté UI selon le rôle. La génération elle-même
    /// reste protégée par [Authorize].
    /// </summary>
    [HttpPost("generate")]
    public async Task<IActionResult> Generate([FromBody] RagLetterGenerateRequest req, CancellationToken ct)
    {
        if (req == null || req.TemplateId <= 0 || string.IsNullOrWhiteSpace(req.Empcod))
            return BadRequest(new { error = "TemplateId et Empcod requis." });

        try
        {
            var uticod = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            var (bytes, contentType, fileName) = await _service.GenerateAsync(req, uticod, ct);
            return File(bytes, contentType, fileName);
        }
        catch (InvalidOperationException ex)
        {
            return StatusCode(404, new { error = "Erreur interne. Consultez les logs serveur pour le détail." });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { error = "Génération échouée", detail = "Erreur interne. Consultez les logs serveur pour le détail." });
        }
    }
}
