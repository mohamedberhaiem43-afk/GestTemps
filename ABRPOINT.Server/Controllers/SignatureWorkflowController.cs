using ABRPOINT.Server.Authorization;
using ABRPOINT.Server.Data;
using ABRPOINT.Server.Services.Signature;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;

namespace ABRPOINT.Server.Controllers;

/// <summary>
/// API du workflow de signature électronique (Phase 1 : génération → signature employé →
/// scellement). Gated <see cref="Tenancy.PlanFeatures.ElectronicSignature"/> (Standard+ ;
/// l'addon signatureElectronique l'active sur Starter et cascade DigitalVault pour l'archivage).
/// </summary>
[Route("api/[controller]")]
[ApiController]
[Authorize]
[Tenancy.RequirePlanFeature(nameof(Tenancy.PlanFeatures.ElectronicSignature))]
public class SignaturesController : ControllerBase
{
    private readonly ISignatureWorkflowService _workflow;
    private readonly ISignatureOtpService _otp;
    private readonly ApplicationDbContext _db;
    private readonly ILogger<SignaturesController> _log;

    public SignaturesController(ISignatureWorkflowService workflow, ISignatureOtpService otp, ApplicationDbContext db, ILogger<SignaturesController> log)
    {
        _workflow = workflow;
        _otp = otp;
        _db = db;
        _log = log;
    }

    public sealed record StartBody(string SourceType, string? SourceId, string Empcod, string? DocName, Dictionary<string, string>? ExtraVars, int ApproverLevels = 1);
    public sealed record SignBody(string SignatureData, string? SignerName, string? Mention, string? Location, string? OtpCode, string? OtpMethod);
    public sealed record RejectBody(string Motif);
    public sealed record DelegateBody(string ToEmpcod);

    // POST api/Signatures/start
    [HttpPost("start")]
    public async Task<IActionResult> Start([FromBody] StartBody body, CancellationToken ct)
    {
        if (body is null || string.IsNullOrWhiteSpace(body.SourceType) || string.IsNullOrWhiteSpace(body.Empcod))
            return BadRequest(new { error = "sourceType et empcod sont obligatoires." });

        var caller = Caller();
        if (string.IsNullOrEmpty(caller)) return Unauthorized();
        // Lancement : le demandeur lui-même, ou un admin pour le compte d'un salarié.
        // (Le lancement « manager pour son équipe » via l'organigramme arrive en Phase 2.)
        if (!string.Equals(caller, body.Empcod, StringComparison.OrdinalIgnoreCase) && !await CallerIsAdminAsync())
            return Forbid();

        try
        {
            var res = await _workflow.StartAsync(
                new SignatureStartRequest(body.SourceType, body.SourceId, body.Empcod, body.DocName, body.ExtraVars, body.ApproverLevels),
                caller, ct);
            return Ok(new { requestId = res.RequestId, documentVaultId = res.DocumentVaultId, docName = res.DocName });
        }
        catch (NotSupportedException ex) { return BadRequest(new { error = ex.Message, code = "template_kind_unsupported" }); }
        catch (InvalidOperationException ex) { return BadRequest(new { error = ex.Message }); }
        catch (ArgumentException ex) { return BadRequest(new { error = ex.Message }); }
        catch (Exception ex)
        {
            _log.LogError(ex, "Échec démarrage workflow signature (source={Src}/{Id}, emp={Emp}).", body.SourceType, body.SourceId, body.Empcod);
            return StatusCode(500, new { error = "Échec du démarrage du parcours de signature." });
        }
    }

    // GET api/Signatures/inbox — étapes en attente pour l'appelant
    [HttpGet("inbox")]
    public async Task<IActionResult> Inbox(CancellationToken ct)
    {
        var caller = Caller();
        if (string.IsNullOrEmpty(caller)) return Unauthorized();
        var items = await _workflow.InboxAsync(caller, ct);
        return Ok(items);
    }

    // GET api/Signatures/{id} — vue d'état (demande + étapes + registre)
    [HttpGet("{id:int}")]
    public async Task<IActionResult> Get(int id, CancellationToken ct)
    {
        var view = await _workflow.GetAsync(id, ct);
        if (view == null) return NotFound();

        // Accès : un acteur du circuit (signataire/délégué/demandeur) ou un admin/manager.
        var caller = Caller();
        var isActor = view.Steps.Any(s => string.Equals(s.SignerEmpcod, caller, StringComparison.OrdinalIgnoreCase)
                                          || string.Equals(s.DelegatedTo, caller, StringComparison.OrdinalIgnoreCase));
        if (!isActor && !await CallerIsAdminAsync()) return Forbid();
        return Ok(view);
    }

    // POST api/Signatures/{id}/steps/{stepId}/sign
    [HttpPost("{id:int}/steps/{stepId:int}/sign")]
    public async Task<IActionResult> Sign(int id, int stepId, [FromBody] SignBody body, CancellationToken ct)
    {
        if (body is null || string.IsNullOrWhiteSpace(body.SignatureData))
            return BadRequest(new { error = "signatureData requis." });

        var caller = Caller();
        if (string.IsNullOrEmpty(caller)) return Unauthorized();

        // Ownership : seul le signataire (ou son délégué) signe — la signature engage
        // personnellement. Un admin peut signer en rattrapage.
        var step = await _db.SignatureSteps.AsNoTracking()
            .FirstOrDefaultAsync(s => s.Id == stepId && s.RequestId == id, ct);
        if (step == null) return NotFound(new { error = "Étape introuvable." });
        var owns = string.Equals(step.SignerEmpcod, caller, StringComparison.OrdinalIgnoreCase)
                   || string.Equals(step.DelegatedTo, caller, StringComparison.OrdinalIgnoreCase);
        if (!owns && !await CallerIsAdminAsync()) return Forbid();

        try
        {
            var ip = HttpContext.Connection.RemoteIpAddress?.ToString();
            var ua = Request.Headers.UserAgent.ToString();
            if (ua.Length > 256) ua = ua.Substring(0, 256);
            var res = await _workflow.SignStepAsync(id, stepId,
                new SignStepInput(body.SignatureData, body.SignerName, body.Mention, body.Location, caller, body.OtpCode, body.OtpMethod, ip, ua), ct);
            return Ok(new { completed = res.Completed, certificateId = res.CertificateId, workflowStatus = res.WorkflowStatus, sealHash = res.SealHash });
        }
        catch (UnauthorizedAccessException ex) { return Unauthorized(new { error = ex.Message, code = "otp_invalid" }); }
        catch (InvalidOperationException ex) { return Conflict(new { error = ex.Message }); }
        catch (KeyNotFoundException ex) { return NotFound(new { error = ex.Message }); }
        catch (Exception ex)
        {
            _log.LogError(ex, "Échec signature étape (request={Req}, step={Step}).", id, stepId);
            return StatusCode(500, new { error = "Échec de la signature." });
        }
    }

    // POST api/Signatures/{id}/steps/{stepId}/otp — envoie un OTP email au signataire courant
    // (niveau de garantie « avancé »). Le code est ensuite passé au /sign.
    [HttpPost("{id:int}/steps/{stepId:int}/otp")]
    public async Task<IActionResult> SendOtp(int id, int stepId, CancellationToken ct)
    {
        var caller = Caller();
        if (string.IsNullOrEmpty(caller)) return Unauthorized();
        if (!await OwnsStepOrAdminAsync(id, stepId, caller)) return Forbid();
        try
        {
            var masked = await _otp.SendEmailOtpAsync(caller, ct);
            return Ok(new { sent = true, email = masked });
        }
        catch (InvalidOperationException ex) { return BadRequest(new { error = ex.Message, code = "no_email" }); }
        catch (KeyNotFoundException ex) { return NotFound(new { error = ex.Message }); }
    }

    // POST api/Signatures/{id}/steps/{stepId}/reject
    [HttpPost("{id:int}/steps/{stepId:int}/reject")]
    public async Task<IActionResult> Reject(int id, int stepId, [FromBody] RejectBody body, CancellationToken ct)
    {
        var caller = Caller();
        if (string.IsNullOrEmpty(caller)) return Unauthorized();
        if (!await OwnsStepOrAdminAsync(id, stepId, caller)) return Forbid();

        try
        {
            var ip = HttpContext.Connection.RemoteIpAddress?.ToString();
            var ua = Request.Headers.UserAgent.ToString();
            if (ua.Length > 256) ua = ua.Substring(0, 256);
            await _workflow.RejectStepAsync(id, stepId, caller, body?.Motif ?? string.Empty, ip, ua, ct);
            return Ok(new { rejected = true });
        }
        catch (InvalidOperationException ex) { return Conflict(new { error = ex.Message }); }
        catch (KeyNotFoundException ex) { return NotFound(new { error = ex.Message }); }
    }

    // POST api/Signatures/{id}/steps/{stepId}/delegate
    [HttpPost("{id:int}/steps/{stepId:int}/delegate")]
    public async Task<IActionResult> Delegate(int id, int stepId, [FromBody] DelegateBody body, CancellationToken ct)
    {
        if (body is null || string.IsNullOrWhiteSpace(body.ToEmpcod))
            return BadRequest(new { error = "toEmpcod requis." });
        var caller = Caller();
        if (string.IsNullOrEmpty(caller)) return Unauthorized();
        if (!await OwnsStepOrAdminAsync(id, stepId, caller)) return Forbid();

        try
        {
            await _workflow.DelegateStepAsync(id, stepId, caller, body.ToEmpcod, ct);
            return Ok(new { delegated = true, toEmpcod = body.ToEmpcod });
        }
        catch (InvalidOperationException ex) { return Conflict(new { error = ex.Message }); }
        catch (ArgumentException ex) { return BadRequest(new { error = ex.Message }); }
        catch (KeyNotFoundException ex) { return NotFound(new { error = ex.Message }); }
    }

    /// <summary>Le caller est-il le signataire de l'étape (ou son délégué), ou un admin ?</summary>
    private async Task<bool> OwnsStepOrAdminAsync(int requestId, int stepId, string caller)
    {
        var step = await _db.SignatureSteps.AsNoTracking()
            .FirstOrDefaultAsync(s => s.Id == stepId && s.RequestId == requestId);
        if (step == null) return false;
        var owns = string.Equals(step.SignerEmpcod, caller, StringComparison.OrdinalIgnoreCase)
                   || string.Equals(step.DelegatedTo, caller, StringComparison.OrdinalIgnoreCase);
        return owns || await CallerIsAdminAsync();
    }

    // POST api/Signatures/verify-seal/{documentVaultId} — vérification d'intégrité (lecture)
    [HttpPost("verify-seal/{documentVaultId:int}")]
    public async Task<IActionResult> VerifySeal(int documentVaultId, CancellationToken ct)
    {
        try
        {
            var res = await _workflow.VerifySealAsync(documentVaultId, ct);
            return Ok(new { sealed_ = res.Sealed, valid = res.Valid, storedHash = res.StoredHash, computedHash = res.ComputedHash });
        }
        catch (KeyNotFoundException ex) { return NotFound(new { error = ex.Message }); }
    }

    private string? Caller() => User.FindFirst(ClaimTypes.NameIdentifier)?.Value;

    private async Task<bool> CallerIsAdminAsync()
    {
        var caller = Caller();
        if (string.IsNullOrEmpty(caller)) return false;
        return await _db.Utilisateurs.AsNoTracking()
            .Where(u => u.Uticod == caller)
            .Select(u => u.Utiadm == "1" || PermissionCatalog.IsAdminRole(u.Utirole))
            .FirstOrDefaultAsync();
    }
}
