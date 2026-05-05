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
    private readonly IConfiguration _config;

    public RagController(IRagSidecarService sidecar, IOptions<RagOptions> options, IConfiguration config)
    {
        _sidecar = sidecar;
        _options = options.Value;
        _config = config;
    }

    /// <summary>
    /// Sanity check : sidecar joignable + clé LLM présente (OpenRouter par défaut,
    /// Anthropic direct si <c>UseOpenRouter=false</c>). Ne consomme aucun crédit —
    /// on vérifie juste la présence de la clé.
    /// </summary>
    [HttpGet("health")]
    [AllowAnonymous]
    public async Task<IActionResult> Health(CancellationToken ct)
    {
        var enabled = _options.Enabled;
        var sidecarOk = enabled && await _sidecar.HealthAsync(ct);

        var useOpenRouter = _options.Anthropic.UseOpenRouter;
        var openRouterKey = _config["OpenRouter:ApiKey"];
        var llmConfigured = useOpenRouter
            ? !string.IsNullOrEmpty(openRouterKey)
            : !string.IsNullOrEmpty(_options.Anthropic.ApiKey);

        var provider = useOpenRouter ? "openrouter" : "anthropic";
        var activeModel = useOpenRouter ? _options.Anthropic.OpenRouterModel : _options.Anthropic.Model;

        return Ok(new
        {
            ok = enabled && sidecarOk && llmConfigured,
            enabled,
            sidecar = sidecarOk,
            sidecarUrl = _options.Sidecar.BaseUrl,
            provider,
            llmConfigured,
            model = activeModel,
            // Champs legacy (pour ne pas casser le frontend) :
            anthropicConfigured = llmConfigured,
            anthropicModel = activeModel
        });
    }
}
