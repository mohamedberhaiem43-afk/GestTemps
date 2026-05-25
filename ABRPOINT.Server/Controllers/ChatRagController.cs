using System.Security.Claims;
using System.Text.Json;
using ABRPOINT.Server.Annotations.AdminAttributes;
using ABRPOINT.Server.Data;
using ABRPOINT.Server.Dtaos;
using ABRPOINT.Server.Services.Rag;
using ABRPOINT.Server.Tenancy;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;

namespace ABRPOINT.Server.Controllers;

/// <summary>
/// Chat RAG : ask, audit (admin), feedback. Le rate-limit "rag-ask" est défini dans
/// <c>Program.cs</c> et appliqué uniquement sur l'endpoint <c>ask</c>.
/// </summary>
[Route("api/[controller]")]
[ApiController]
[Authorize]
[RequirePlanFeature(nameof(PlanFeatures.RagAi))]
public class ChatRagController : ControllerBase
{
    private readonly IClaudeRagService _claude;
    private readonly ApplicationDbContext _db;
    private readonly ICurrentTenant _currentTenant;
    private readonly ILogger<ChatRagController> _logger;

    public ChatRagController(IClaudeRagService claude, ApplicationDbContext db, ICurrentTenant currentTenant, ILogger<ChatRagController> logger)
    {
        _claude = claude;
        _db = db;
        _currentTenant = currentTenant;
        _logger = logger;
    }

    /// <summary>POST /api/ChatRag/ask — pose une question au RAG.</summary>
    [HttpPost("ask")]
    [EnableRateLimiting("rag-ask")]
    public async Task<IActionResult> Ask([FromBody] RagChatRequest req, CancellationToken ct)
    {
        if (req == null || string.IsNullOrWhiteSpace(req.Question))
            return BadRequest(new { error = "Question requise." });

        var uticod = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        try
        {
            var answer = await _claude.AskAsync(req.Question, req.TopK, uticod, ct);
            return Ok(answer);
        }
        catch (InvalidOperationException ex)
        {
            // Les InvalidOperationException du pipeline RAG portent des messages
            // explicitement actionnables (clé LLM absente, sidecar désactivé,
            // tenant manquant) qui n'exposent aucun secret. On les remonte au
            // client pour que l'admin diagnostique sans accès aux logs serveur.
            _logger.LogWarning(ex, "ChatRag/ask : configuration RAG invalide");
            return StatusCode(503, new { error = ex.Message });
        }
        catch (HttpRequestException ex)
        {
            // Erreur réseau vers LLM/sidecar : on log le détail mais on ne remonte
            // pas le body upstream (peut contenir un message d'erreur OpenRouter/Anthropic
            // utile mais aussi parfois un echo du prompt avec PII).
            _logger.LogError(ex, "ChatRag/ask : LLM/sidecar HTTP failure");
            return StatusCode(502, new { error = "Service IA temporairement indisponible (erreur réseau vers le LLM ou le sidecar). Vérifiez les logs serveur." });
        }
    }

    /// <summary>POST /api/ChatRag/{id}/feedback — note la qualité d'une réponse.</summary>
    [HttpPost("{id:long}/feedback")]
    public async Task<IActionResult> Feedback(long id, [FromBody] RagFeedbackRequest req, CancellationToken ct)
    {
        if (req == null) return BadRequest();
        var ok = await _claude.RecordFeedbackAsync(id, req.Score, req.Comment, ct);
        return ok ? NoContent() : NotFound();
    }

    /// <summary>GET /api/ChatRag/audit — liste paginée des questions du tenant. Réservé admin.</summary>
    [HttpGet("audit")]
    [Admin]
    public async Task<IActionResult> Audit([FromQuery] int skip = 0, [FromQuery] int take = 50, CancellationToken ct = default)
    {
        var soccod = _currentTenant.Current?.LegacySoccod;
        if (string.IsNullOrEmpty(soccod)) return Forbid();

        take = Math.Clamp(take, 1, 200);
        skip = Math.Max(0, skip);

        var total = await _db.RagChatLogs.CountAsync(l => l.Soccod == soccod, ct);
        var logs = await _db.RagChatLogs
            .Where(l => l.Soccod == soccod)
            .OrderByDescending(l => l.CreatedAt)
            .Skip(skip)
            .Take(take)
            .ToListAsync(ct);

        var dtos = logs.Select(l => new RagChatLogDto
        {
            Id = l.Id,
            Category = l.Category,
            Uticod = l.Uticod,
            Question = l.Question,
            Answer = l.Answer,
            Sources = TryDeserializeSources(l.SourcesJson),
            TokensIn = l.TokensIn,
            TokensOut = l.TokensOut,
            LatencyMs = l.LatencyMs,
            CreatedAt = l.CreatedAt,
            FeedbackScore = l.FeedbackScore,
            FeedbackComment = l.FeedbackComment
        }).ToList();

        return Ok(new { total, items = dtos });
    }

    private static List<RagChatSource>? TryDeserializeSources(string? json)
    {
        if (string.IsNullOrWhiteSpace(json)) return null;
        try { return JsonSerializer.Deserialize<List<RagChatSource>>(json); }
        catch { return null; }
    }
}
