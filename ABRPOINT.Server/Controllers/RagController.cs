using ABRPOINT.Server.Services.Rag;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Options;

namespace ABRPOINT.Server.Controllers;

/// <summary>
/// Endpoints utilitaires RAG : healthcheck. Les controllers métier (DocumentsController,
/// ChatRagController, LetterTemplatesController) sont ajoutés en PR2/3/4.
/// </summary>
[Route("api/[controller]")]
[ApiController]
[Authorize]
public class RagController : ControllerBase
{
    private readonly IRagSidecarService _sidecar;
    private readonly RagOptions _options;

    public RagController(IRagSidecarService sidecar, IOptions<RagOptions> options)
    {
        _sidecar = sidecar;
        _options = options.Value;
    }

    /// <summary>
    /// Sanity check : sidecar joignable + clé Anthropic présente. Ne consomme aucun
    /// crédit Anthropic — on vérifie juste la présence de la clé. Le vrai test bout-en-bout
    /// se fait via un POST /Rag/{soccod}/ask en PR3.
    /// </summary>
    [HttpGet("health")]
    [AllowAnonymous]
    public async Task<IActionResult> Health(CancellationToken ct)
    {
        var sidecarOk = await _sidecar.HealthAsync(ct);
        var anthropicConfigured = !string.IsNullOrEmpty(_options.Anthropic.ApiKey);

        return Ok(new
        {
            ok = sidecarOk && anthropicConfigured,
            sidecar = sidecarOk,
            sidecarUrl = _options.Sidecar.BaseUrl,
            anthropicConfigured,
            anthropicModel = _options.Anthropic.Model
        });
    }
}
