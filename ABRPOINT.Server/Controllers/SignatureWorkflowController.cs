using ABRPOINT.Server.Authorization;
using ABRPOINT.Server.Data;
using ABRPOINT.Server.Interfaces;
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
    private readonly Tenancy.ICurrentTenant _tenant;
    private readonly IEmployeRepository _employes;

    public SignaturesController(ISignatureWorkflowService workflow, ISignatureOtpService otp, ApplicationDbContext db, ILogger<SignaturesController> log, Tenancy.ICurrentTenant tenant, IEmployeRepository employes)
    {
        _workflow = workflow;
        _otp = otp;
        _db = db;
        _log = log;
        _tenant = tenant;
        _employes = employes;
    }

    // Libellés FR des types de documents signables (clé = source_type configuré dans
    // signature_template_map). Tout type non listé retombe sur son code brut.
    private static readonly Dictionary<string, string> SourceTypeLabels = new(StringComparer.OrdinalIgnoreCase)
    {
        ["DemConge"] = "Demande de congé",
        ["DemandeAutorisation"] = "Demande d'autorisation",
        ["DemandeAbsence"] = "Absence / visite médicale",
        ["Teletravail"] = "Télétravail",
        ["Manual"] = "Document / contrat",
    };

    // GET api/Signatures/source-types — types de documents signables réellement configurés
    // pour le tenant (liaison société + défauts globaux). Alimente le sélecteur du dialog
    // « Nouvelle demande de signature » côté UI.
    [HttpGet("source-types")]
    public async Task<IActionResult> SourceTypes(CancellationToken ct)
    {
        var soccod = _tenant.Current?.LegacySoccod;
        var types = await _db.SignatureTemplateMaps
            .Where(m => m.Soccod == soccod || m.Soccod == null)
            .Select(m => m.SourceType)
            .Distinct()
            .ToListAsync(ct);

        var result = types
            .OrderBy(t => t)
            .Select(t => new { sourceType = t, label = SourceTypeLabels.TryGetValue(t, out var l) ? l : t })
            .ToList();
        return Ok(result);
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
        // Phase 2 — Lancement autorisé pour : le demandeur lui-même ; un admin ; OU un
        // responsable/manager qui a le droit « Gestion Employés » ET dont le périmètre couvre
        // le salarié cible (mêmes sites Socuser ∩ service — exactement le périmètre du sélecteur
        // d'employés du dialog). Empêche un salarié simple de lancer pour un collègue.
        if (!string.Equals(caller, body.Empcod, StringComparison.OrdinalIgnoreCase)
            && !await CallerIsAdminAsync()
            && !await CallerCanManageEmployeeAsync(caller, body.Empcod, ct))
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

    // Phase 2 : un responsable/manager peut lancer une signature pour un salarié de son périmètre.
    // Deux conditions cumulatives, pour ne pas ouvrir la porte à un salarié simple :
    //   1. le rôle de l'appelant accorde « Gestion Employés » (en consultation au minimum) —
    //      le rôle Employee a cette matrice à 0000, il est donc exclu ;
    //   2. le salarié cible figure dans le périmètre EXACT du sélecteur d'employés du dialog
    //      (GetEmpLibs : admin/RH = tous ; manager = ses sites Socuser ∩ son service).
    private async Task<bool> CallerCanManageEmployeeAsync(string caller, string empcod, CancellationToken ct)
    {
        var soccod = _tenant.Current?.LegacySoccod;
        if (string.IsNullOrEmpty(soccod)) return false;

        var role = await _db.Utilisateurs.AsNoTracking()
            .Where(u => u.Uticod == caller)
            .Select(u => u.Utirole)
            .FirstOrDefaultAsync(ct);
        if (string.IsNullOrEmpty(role)) return false;

        var canManage = await _db.RolePermissions.AsNoTracking()
            .AnyAsync(rp => rp.Role!.RoleName == role
                         && rp.RpModule == PermissionCatalog.Modules.GestionEmployes
                         && rp.RpConsult == "1", ct);
        if (!canManage) return false;

        var scoped = await _employes.GetEmpLibs(soccod, caller);
        return scoped.ContainsKey(empcod);
    }
}
