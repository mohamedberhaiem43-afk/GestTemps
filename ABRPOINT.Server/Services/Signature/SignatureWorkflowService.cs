using System.Security.Cryptography;
using ABRPOINT.Server.Data;
using ABRPOINT.Server.Dtaos;
using ABRPOINT.Server.Helpers;
using ABRPOINT.Server.Interfaces;
using ABRPOINT.Server.Models;
using ABRPOINT.Server.Services;
using ABRPOINT.Server.Services.Rag;
using ABRPOINT.Server.Tenancy;
using Microsoft.EntityFrameworkCore;

namespace ABRPOINT.Server.Services.Signature;

/// <summary>
/// Implémentation Phase 1 du workflow de signature : génère le PDF depuis un modèle de
/// courrier (réutilise <see cref="ILetterGenerationService"/>), l'archive dans le coffre,
/// le fait signer par l'employé (tampon PDF via <see cref="PdfSignatureStamper"/>), puis
/// scelle le PDF GELÉ (SHA-256 chaîné). Le coffre et le générateur sont réutilisés tels
/// quels — cette classe n'ajoute QUE l'orchestration + le scellement.
/// </summary>
public sealed class SignatureWorkflowService : ISignatureWorkflowService
{
    private readonly ApplicationDbContext _db;
    private readonly ILetterGenerationService _letter;
    private readonly IVaultRepository _vault;
    private readonly EncryptionService _enc;
    private readonly ICurrentTenant _tenant;
    private readonly ILogger<SignatureWorkflowService> _log;

    public SignatureWorkflowService(
        ApplicationDbContext db,
        ILetterGenerationService letter,
        IVaultRepository vault,
        EncryptionService enc,
        ICurrentTenant tenant,
        ILogger<SignatureWorkflowService> log)
    {
        _db = db;
        _letter = letter;
        _vault = vault;
        _enc = enc;
        _tenant = tenant;
        _log = log;
    }

    public async Task<SignatureStartResult> StartAsync(SignatureStartRequest req, string requestedByEmpcod, CancellationToken ct = default)
    {
        var soccod = _tenant.Current?.LegacySoccod;
        if (string.IsNullOrEmpty(soccod)) throw new InvalidOperationException("Tenant non résolu.");
        if (string.IsNullOrWhiteSpace(req.Empcod)) throw new ArgumentException("empcod requis.");

        // 1. Résolution du modèle : on prend la liaison spécifique société, sinon le défaut global (soccod NULL).
        var maps = await _db.SignatureTemplateMaps
            .Where(m => m.SourceType == req.SourceType && (m.Soccod == soccod || m.Soccod == null))
            .ToListAsync(ct);
        var map = maps.FirstOrDefault(m => m.Soccod == soccod) ?? maps.FirstOrDefault(m => m.Soccod == null);
        if (map == null)
            throw new InvalidOperationException($"Aucun modèle de document configuré pour « {req.SourceType} ». Définissez une liaison dans signature_template_map.");

        // Phase 1 : seul le modèle de courrier (RagLetterTemplate) est supporté comme source.
        if (!string.Equals(map.TemplateKind, "letter", StringComparison.OrdinalIgnoreCase))
            throw new NotSupportedException($"Type de modèle « {map.TemplateKind} » non supporté en Phase 1 (utilisez un modèle de courrier).");
        if (!int.TryParse(map.TemplateRef, out var templateId))
            throw new InvalidOperationException("template_ref doit être l'identifiant numérique d'un modèle de courrier.");

        // 2. Génération du PDF pré-rempli (placeholders employé/société/contrat + ExtraVars).
        var (bytes, _, _) = await _letter.GenerateAsync(
            new RagLetterGenerateRequest { TemplateId = templateId, Empcod = req.Empcod, Format = "pdf", ExtraVars = req.ExtraVars },
            requestedByEmpcod, ct);

        // 3. Archivage du PDF GELÉ dans le coffre, en attente de signature.
        var slug = _tenant.Current?.Slug;
        var (ok, url, err) = await FileHelper.SaveBytes(bytes, ".pdf", slug);
        if (!ok) throw new InvalidOperationException($"Échec d'enregistrement du document : {err}");

        var doc = new DocumentVault
        {
            Soccod = soccod,
            Empcod = req.Empcod,
            DocName = Truncate(string.IsNullOrWhiteSpace(req.DocName) ? $"{req.SourceType}-{req.SourceId}" : req.DocName!, 255),
            DocType = "Signature",
            DocPath = _enc.Encrypt(url),
            DocSize = bytes.LongLength,
            DocDate = DateTime.UtcNow,
            Status = "Pending Signature",
            WorkflowStatus = "awaiting_signatures",
        };
        doc = await _vault.AddDocumentAsync(doc);

        // 4. Demande + étape signataire (Phase 1 : une seule étape = l'employé).
        var sr = new SignatureRequest
        {
            Soccod = soccod,
            SourceType = req.SourceType,
            SourceId = req.SourceId,
            DocumentVaultId = doc.Id,
            RequestedBy = requestedByEmpcod,
            WorkflowStatus = "awaiting_signatures",
            CurrentStep = 1,
            CreatedAt = DateTime.UtcNow,
        };
        _db.SignatureRequests.Add(sr);
        await _db.SaveChangesAsync(ct);

        _db.SignatureSteps.Add(new SignatureStep
        {
            RequestId = sr.Id,
            StepOrder = 1,
            SignerEmpcod = req.Empcod,
            SignerRole = "employee",
            PlaceholderKey = "[Signature_Collaborateur]",
            Status = "pending",
        });
        await _db.SaveChangesAsync(ct);

        _log.LogInformation("Signature workflow démarré (request={Req}, doc={Doc}, source={Src}/{Id}).", sr.Id, doc.Id, req.SourceType, req.SourceId);
        return new SignatureStartResult(sr.Id, doc.Id, doc.DocName);
    }

    public async Task<SignatureSignResult> SignStepAsync(int requestId, int stepId, SignStepInput input, CancellationToken ct = default)
    {
        var sr = await _db.SignatureRequests.FirstOrDefaultAsync(r => r.Id == requestId, ct)
                 ?? throw new KeyNotFoundException("Demande de signature introuvable.");
        var step = await _db.SignatureSteps.FirstOrDefaultAsync(s => s.Id == stepId && s.RequestId == requestId, ct)
                   ?? throw new KeyNotFoundException("Étape introuvable.");

        if (!string.Equals(step.Status, "pending", StringComparison.OrdinalIgnoreCase))
            throw new InvalidOperationException("Cette étape a déjà été traitée.");
        // Garde d'ordonnancement : on ne signe que l'étape courante (anti double-soumission / hors-séquence).
        if (step.StepOrder != sr.CurrentStep)
            throw new InvalidOperationException("Cette étape n'est pas l'étape courante du circuit.");
        if (sr.DocumentVaultId is null)
            throw new InvalidOperationException("Aucun document associé à cette demande.");

        var doc = await _vault.GetDocumentByIdAsync(sr.DocumentVaultId.Value)
                  ?? throw new KeyNotFoundException("Document introuvable.");

        var signedAt = DateTime.UtcNow;
        var certificateId = $"CERT-LEDG-{signedAt.Year}-{Guid.NewGuid().ToString()[..8].ToUpper()}";

        // Image de signature stockée à part (preuve séparée + fallback docs non-PDF).
        string? signaturePath = null;
        var (okImg, imgPath, _) = await FileHelper.SaveBase64Image(input.SignatureData, _tenant.Current?.Slug);
        if (okImg) signaturePath = imgPath;

        // Tampon dans le PDF (inline sur le placeholder de l'étape, sinon boîte de repli).
        try
        {
            var decrypted = _enc.Decrypt(doc.DocPath);
            var fileName = Path.GetFileName(decrypted);
            var sourcePdf = FileHelper.ResolveUploadFilePath(decrypted) ?? Path.Combine(FileHelper.GetUploadsPath(), fileName);
            if (File.Exists(sourcePdf) && string.Equals(Path.GetExtension(sourcePdf), ".pdf", StringComparison.OrdinalIgnoreCase))
            {
                var opts = new PdfSignatureStamper.StampOptions(
                    SignerName: string.IsNullOrWhiteSpace(input.SignerName) ? step.SignerEmpcod : input.SignerName,
                    SignedAtUtc: signedAt,
                    CertificateId: certificateId,
                    Mention: input.Mention,
                    Location: input.Location);

                var placeholder = string.IsNullOrWhiteSpace(step.PlaceholderKey) ? "[Signature_Collaborateur]" : step.PlaceholderKey!;
                var stampedPath = PdfSignatureStamper.StampInline(sourcePdf, input.SignatureData, opts, placeholder)
                                  ?? PdfSignatureStamper.Stamp(sourcePdf, input.SignatureData, opts);

                if (!string.IsNullOrEmpty(stampedPath))
                {
                    var stampedName = Path.GetFileName(stampedPath);
                    var slug = _tenant.Current?.Slug;
                    var newUrl = FileHelper.IsValidTenantSlug(slug)
                                 && decrypted.StartsWith($"/api/uploads/{slug}/", StringComparison.OrdinalIgnoreCase)
                        ? $"/api/uploads/{slug}/{stampedName}"
                        : "/api/uploads/" + stampedName;
                    doc.DocPath = _enc.Encrypt(newUrl);
                    try { doc.DocSize = new FileInfo(stampedPath).Length; } catch { /* best effort */ }
                }
            }
        }
        catch (Exception ex)
        {
            // Échec de tampon = on conserve le document + la signature stockée séparément.
            _log.LogWarning(ex, "Tampon PDF échoué (request={Req}, step={Step}) — signature conservée hors-document.", requestId, stepId);
        }

        // Registre append-only.
        _db.SignatureActions.Add(new SignatureAction
        {
            RequestId = requestId,
            StepId = stepId,
            SignerEmpcod = step.SignerEmpcod,
            Action = "signed",
            SignaturePath = signaturePath,
            CertificateId = certificateId,
            AuthMethod = input.AuthMethod,
            IpAddress = input.Ip,
            UserAgent = input.UserAgent,
            SignedAt = signedAt,
        });
        step.Status = "signed";

        // Avancement du circuit : étape suivante en attente, sinon scellement final.
        var nextStep = await _db.SignatureSteps
            .Where(s => s.RequestId == requestId && s.Status == "pending" && s.StepOrder > step.StepOrder)
            .OrderBy(s => s.StepOrder)
            .FirstOrDefaultAsync(ct);

        string? sealHash = null;
        bool completed = false;
        if (nextStep != null)
        {
            sr.CurrentStep = nextStep.StepOrder;
            sr.WorkflowStatus = "in_validation";
            doc.WorkflowStatus = "in_validation";
        }
        else
        {
            sealHash = await SealInternalAsync(sr, doc, step.SignerEmpcod, ct);
            completed = true;
        }

        await _db.SaveChangesAsync(ct);
        return new SignatureSignResult(completed, certificateId, sr.WorkflowStatus, sealHash);
    }

    /// <summary>Scelle le PDF gelé : SHA-256 des octets finaux, chaîné au sceau précédent du
    /// tenant (la base est déjà isolée par tenant). Met à jour le coffre + la demande.</summary>
    private async Task<string> SealInternalAsync(SignatureRequest sr, DocumentVault doc, string sealedBy, CancellationToken ct)
    {
        var decrypted = _enc.Decrypt(doc.DocPath);
        var fileName = Path.GetFileName(decrypted);
        var pdfPath = FileHelper.ResolveUploadFilePath(decrypted) ?? Path.Combine(FileHelper.GetUploadsPath(), fileName);

        string hash;
        if (File.Exists(pdfPath))
        {
            var bytes = await File.ReadAllBytesAsync(pdfPath, ct);
            hash = Sha256Hex(bytes);
        }
        else
        {
            // Document introuvable sur disque (anomalie) : on scelle un hash vide plutôt que
            // d'échouer le workflow, mais on le journalise — verify-seal remontera l'incohérence.
            _log.LogError("Scellement : PDF introuvable sur disque pour doc={Doc} (request={Req}).", doc.Id, sr.Id);
            hash = new string('0', 64);
        }

        var prev = await _db.SignatureSealLogs
            .OrderByDescending(l => l.SealedAt)
            .Select(l => l.SealHash)
            .FirstOrDefaultAsync(ct);

        var sealedAt = DateTime.UtcNow;
        _db.SignatureSealLogs.Add(new SignatureSealLog
        {
            RequestId = sr.Id,
            DocumentVaultId = doc.Id,
            SealHash = hash,
            PrevSealHash = prev,
            SealedBy = sealedBy,
            SealedAt = sealedAt,
        });

        doc.IsSigned = true;
        doc.SignatureDate = sealedAt;
        doc.Status = "Signed";
        doc.WorkflowStatus = "archived";
        doc.SealHash = hash;
        doc.SealedAt = sealedAt;

        sr.WorkflowStatus = "archived";
        sr.CompletedAt = sealedAt;

        _log.LogInformation("Document scellé (request={Req}, doc={Doc}, hash={Hash}).", sr.Id, doc.Id, hash[..Math.Min(12, hash.Length)]);
        return hash;
    }

    public async Task<SealVerifyResult> VerifySealAsync(int documentVaultId, CancellationToken ct = default)
    {
        var doc = await _vault.GetDocumentByIdAsync(documentVaultId)
                  ?? throw new KeyNotFoundException("Document introuvable.");
        if (string.IsNullOrEmpty(doc.SealHash))
            return new SealVerifyResult(false, false, null, null);

        var decrypted = _enc.Decrypt(doc.DocPath);
        var fileName = Path.GetFileName(decrypted);
        var pdfPath = FileHelper.ResolveUploadFilePath(decrypted) ?? Path.Combine(FileHelper.GetUploadsPath(), fileName);
        if (!File.Exists(pdfPath))
            return new SealVerifyResult(true, false, doc.SealHash, null);

        var bytes = await File.ReadAllBytesAsync(pdfPath, ct);
        var computed = Sha256Hex(bytes);
        return new SealVerifyResult(true, string.Equals(computed, doc.SealHash, StringComparison.OrdinalIgnoreCase), doc.SealHash, computed);
    }

    public async Task<SignatureRequestView?> GetAsync(int requestId, CancellationToken ct = default)
    {
        var sr = await _db.SignatureRequests.AsNoTracking().FirstOrDefaultAsync(r => r.Id == requestId, ct);
        if (sr == null) return null;

        var steps = await _db.SignatureSteps.AsNoTracking()
            .Where(s => s.RequestId == requestId).OrderBy(s => s.StepOrder)
            .Select(s => new SignatureStepView(s.Id, s.StepOrder, s.SignerEmpcod, s.SignerRole, s.Status, s.PlaceholderKey, s.DelegatedTo))
            .ToListAsync(ct);

        var actions = await _db.SignatureActions.AsNoTracking()
            .Where(a => a.RequestId == requestId).OrderBy(a => a.SignedAt)
            .Select(a => new SignatureActionView(a.StepId, a.SignerEmpcod, a.Action, a.CertificateId, a.AuthMethod, a.SignedAt, a.Motif))
            .ToListAsync(ct);

        bool? sealValid = null;
        string? sealHash = null;
        if (sr.DocumentVaultId is int dvId)
        {
            try
            {
                var v = await VerifySealAsync(dvId, ct);
                sealValid = v.Sealed ? v.Valid : (bool?)null;
                sealHash = v.StoredHash;
            }
            catch { /* best effort */ }
        }

        return new SignatureRequestView(
            sr.Id, sr.SourceType, sr.SourceId, sr.DocumentVaultId, sr.WorkflowStatus, sr.CurrentStep,
            sr.CreatedAt, sr.CompletedAt, sealValid, sealHash,
            steps, actions);
    }

    public async Task<IReadOnlyList<SignatureInboxItem>> InboxAsync(string empcod, CancellationToken ct = default)
    {
        // Étapes en attente assignées au signataire (ou qui lui sont déléguées), à l'étape courante.
        var query =
            from s in _db.SignatureSteps.AsNoTracking()
            join r in _db.SignatureRequests.AsNoTracking() on s.RequestId equals r.Id
            where s.Status == "pending"
                  && s.StepOrder == r.CurrentStep
                  && (s.SignerEmpcod == empcod || s.DelegatedTo == empcod)
                  && r.WorkflowStatus != "rejected" && r.WorkflowStatus != "archived"
            join d in _db.DocumentVaults.AsNoTracking() on r.DocumentVaultId equals d.Id into dj
            from d in dj.DefaultIfEmpty()
            orderby r.CreatedAt descending
            select new SignatureInboxItem(
                r.Id, s.Id, s.StepOrder, r.SourceType, r.SourceId, r.DocumentVaultId,
                d != null ? d.DocName : "(document)", r.CreatedAt);

        return await query.ToListAsync(ct);
    }

    private static string Sha256Hex(byte[] bytes)
    {
        var hash = SHA256.HashData(bytes);
        return Convert.ToHexString(hash).ToLowerInvariant();
    }

    private static string Truncate(string s, int max) => s.Length <= max ? s : s.Substring(0, max);
}
