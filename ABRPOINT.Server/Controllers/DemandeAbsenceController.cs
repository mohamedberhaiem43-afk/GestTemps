using ABRPOINT.Server.Authorization;
using ABRPOINT.Server.Data;
using ABRPOINT.Server.Helpers;
using ABRPOINT.Server.Interfaces;
using ABRPOINT.Server.Models;
using ABRPOINT.Server.Services;
using ABRPOINT.Server.Tenancy;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;

namespace ABRPOINT.Server.Controllers;

/// <summary>
/// Workflow de demandes d'absence avec justificatif (certificat médical,
/// convocation, attestation…). Endpoints :
///   • POST   /api/DemandeAbsence                — multipart : champs + fichier
///   • POST   /api/DemandeAbsence/{id}/cancel    — annulation par le demandeur
///   • GET    /api/DemandeAbsence/me             — mes demandes
///   • GET    /api/DemandeAbsence/pending        — demandes à valider (admin/manager)
///   • GET    /api/DemandeAbsence?status=…       — liste filtrée (admin/manager)
///   • POST   /api/DemandeAbsence/{id}/approve   — approuve (admin/manager)
///   • POST   /api/DemandeAbsence/{id}/reject    — refuse, motif obligatoire
///
/// Plan gating : <c>LeaveManagement</c> (ouvert à tous les packs, comme
/// Teletravail). Gardé pour homogénéité ; restriction possible plus tard sans
/// toucher au contrôleur si la politique commerciale change.
///
/// La création passe par un multipart/form-data car on accepte un fichier
/// justificatif. C'est le point qui diffère de TeletravailController (qui prend
/// du JSON pur).
/// </summary>
[Route("api/[controller]")]
[ApiController]
[Authorize]
[RequirePlanFeature(nameof(PlanFeatures.LeaveManagement))]
public class DemandeAbsenceController : ControllerBase
{
    private readonly ApplicationDbContext _db;
    private readonly ICurrentTenant _currentTenant;
    private readonly ILogger<DemandeAbsenceController> _log;
    // Notifications best-effort — pattern aligné sur TeletravailController et
    // AutorisersController. Champs nullable + try/catch autour de chaque envoi.
    private readonly IUserNotificationService? _notify;
    private readonly IEmailService? _email;

    public DemandeAbsenceController(
        ApplicationDbContext db,
        ICurrentTenant currentTenant,
        ILogger<DemandeAbsenceController> log,
        IUserNotificationService? notify = null,
        IEmailService? email = null)
    {
        _db = db;
        _currentTenant = currentTenant;
        _log = log;
        _notify = notify;
        _email = email;
    }

    // ───────────────────────────────────────────────────────────────────────
    // DTOs
    // ───────────────────────────────────────────────────────────────────────
    public sealed class DecisionRequest
    {
        public string? Comment { get; set; }
    }

    public sealed class DemandeAbsenceDto
    {
        public int Id { get; set; }
        public string? Empcod { get; set; }
        public string? EmployeeName { get; set; }
        public DateTime RequestedAt { get; set; }
        public DateTime StartDate { get; set; }
        public DateTime EndDate { get; set; }
        public float? DaysCount { get; set; }
        public string? Abscod { get; set; }
        public string? AbsenceLabel { get; set; }
        public string? Reason { get; set; }
        public string? JustificationUrl { get; set; }
        public string? JustificationFilename { get; set; }
        public string? JustificationMime { get; set; }
        public long? JustificationSize { get; set; }
        public string Status { get; set; } = "Pending";
        public string? DecidedBy { get; set; }
        public string? DecidedByName { get; set; }
        public DateTime? DecidedAt { get; set; }
        public string? DecisionComment { get; set; }
    }

    // ───────────────────────────────────────────────────────────────────────
    // POST /api/DemandeAbsence — création (multipart/form-data)
    // Champs attendus : StartDate, EndDate, Abscod (opt), Reason (opt), file (opt).
    // ───────────────────────────────────────────────────────────────────────
    [HttpPost]
    [RequestSizeLimit(15_000_000)] // 15 Mo : un certificat médical scanné = ~5 Mo max
    [RequestFormLimits(MultipartBodyLengthLimit = 15_000_000)]
    public async Task<IActionResult> Create(CancellationToken ct)
    {
        var caller = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        if (string.IsNullOrEmpty(caller)) return Unauthorized();

        // Convention Uticod == Empcod (cf. note dans TeletravailController.Create).
        var employe = await _db.Employes.AsNoTracking()
            .Where(e => e.Empcod == caller)
            .Select(e => new { e.Empcod, e.Soccod })
            .FirstOrDefaultAsync(ct);
        if (employe == null)
            return BadRequest(new { error = "Compte non rattaché à un collaborateur." });

        var form = await Request.ReadFormAsync(ct);
        if (!DateTime.TryParse(form["StartDate"].ToString(), out var startDate))
            return BadRequest(new { error = "StartDate invalide." });
        if (!DateTime.TryParse(form["EndDate"].ToString(), out var endDate))
            return BadRequest(new { error = "EndDate invalide." });
        if (endDate.Date < startDate.Date)
            return BadRequest(new { error = "La date de fin doit être ≥ à la date de début." });

        var abscod = form["Abscod"].ToString();
        var reason = form["Reason"].ToString();
        if (!string.IsNullOrEmpty(reason) && reason.Length > 1000)
            return BadRequest(new { error = "Motif trop long (1000 caractères max)." });

        var entity = new DemandeAbsence
        {
            Soccod = employe.Soccod,
            Empcod = employe.Empcod,
            StartDate = startDate.Date,
            EndDate = endDate.Date,
            Abscod = string.IsNullOrWhiteSpace(abscod) ? null : abscod.Trim(),
            Reason = string.IsNullOrWhiteSpace(reason) ? null : reason.Trim(),
            DaysCount = CountBusinessDays(startDate.Date, endDate.Date),
            Status = "Pending",
            RequestedAt = DateTime.UtcNow,
            CreatedAt = DateTime.UtcNow,
        };

        // Sauvegarde du justificatif (facultatif côté API ; côté UI on le
        // recommande fortement pour qu'une demande médicale ait du sens).
        var file = form.Files.FirstOrDefault();
        if (file != null && file.Length > 0)
        {
            var slug = _currentTenant.Current?.Slug;
            var (success, filePath, error) = await FileHelper.SaveFile(file, slug);
            if (!success)
                return BadRequest(new { error = error ?? "Échec de l'upload du justificatif." });
            entity.JustificationUrl = filePath;
            entity.JustificationFilename = file.FileName;
            entity.JustificationMime = file.ContentType;
            entity.JustificationSize = file.Length;
        }

        _db.DemandesAbsence.Add(entity);
        await _db.SaveChangesAsync(ct);

        // ─── Notification managers/admins (best-effort) ───
        // Push/in-app uniquement (pas d'email aux managers → trop spammy en
        // cas de pic d'absences saisonnier). L'email part lors de la décision
        // côté employé. On précise dans le body si un justificatif est joint
        // — info utile pour le manager qui priorise sa file de validation.
        try
        {
            if (_notify != null)
            {
                var who = await _db.Employes.AsNoTracking()
                    .Where(e => e.Soccod == entity.Soccod && e.Empcod == entity.Empcod)
                    .Select(e => e.Emplib)
                    .FirstOrDefaultAsync(ct) ?? entity.Empcod ?? "Un collaborateur";
                var period = entity.StartDate.Date == entity.EndDate.Date
                    ? entity.StartDate.ToString("dd/MM/yyyy")
                    : $"{entity.StartDate:dd/MM/yyyy} → {entity.EndDate:dd/MM/yyyy}";
                var justifBadge = entity.JustificationUrl != null ? " (justificatif joint)" : " (sans justificatif)";
                _ = _notify.NotifyManagersAsync(
                    "🏥 Demande d'absence à valider",
                    $"{who} demande une absence du {period}{justifBadge}.",
                    new { type = "absence_request_created", id = entity.Id, soccod = entity.Soccod });
            }
        }
        catch (Exception notifyEx)
        {
            _log.LogWarning(notifyEx, "DemandeAbsence.Create — notification managers ignorée (record sauvegardé).");
        }

        return Ok(await ProjectAsync(entity.Id, ct));
    }

    // ───────────────────────────────────────────────────────────────────────
    // POST /api/DemandeAbsence/{id}/cancel
    // ───────────────────────────────────────────────────────────────────────
    [HttpPost("{id:int}/cancel")]
    public async Task<IActionResult> Cancel(int id, CancellationToken ct)
    {
        var caller = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        if (string.IsNullOrEmpty(caller)) return Unauthorized();

        var entity = await _db.DemandesAbsence.FirstOrDefaultAsync(d => d.Id == id, ct);
        if (entity == null) return NotFound();
        if (!string.Equals(entity.Empcod, caller, StringComparison.OrdinalIgnoreCase))
            return Forbid();
        if (!string.Equals(entity.Status, "Pending", StringComparison.OrdinalIgnoreCase))
            return Conflict(new { error = "Seules les demandes en attente peuvent être annulées." });

        entity.Status = "Cancelled";
        entity.DecidedAt = DateTime.UtcNow;
        entity.DecidedBy = caller;
        await _db.SaveChangesAsync(ct);

        try
        {
            if (_notify != null)
            {
                var period = entity.StartDate.Date == entity.EndDate.Date
                    ? entity.StartDate.ToString("dd/MM/yyyy")
                    : $"{entity.StartDate:dd/MM/yyyy} → {entity.EndDate:dd/MM/yyyy}";
                _ = _notify.NotifyManagersAsync(
                    "🏥 Demande d'absence annulée",
                    $"La demande du {period} a été annulée par le collaborateur.",
                    new { type = "absence_request_cancelled", id = entity.Id, soccod = entity.Soccod });
            }
        }
        catch (Exception notifyEx)
        {
            _log.LogWarning(notifyEx, "DemandeAbsence.Cancel — notification managers ignorée.");
        }

        return Ok(await ProjectAsync(entity.Id, ct));
    }

    // ───────────────────────────────────────────────────────────────────────
    // GET /api/DemandeAbsence/me
    // ───────────────────────────────────────────────────────────────────────
    [HttpGet("me")]
    public async Task<IActionResult> ListMine(CancellationToken ct)
    {
        var caller = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        if (string.IsNullOrEmpty(caller)) return Unauthorized();
        var items = await ProjectListAsync(q => q.Where(d => d.Empcod == caller), ct);
        return Ok(items);
    }

    [HttpGet("pending")]
    public async Task<IActionResult> ListPending(CancellationToken ct)
    {
        if (!await CallerCanDecideAsync(ct)) return Forbid();
        var items = await ProjectListAsync(q => q.Where(d => d.Status == "Pending"), ct);
        return Ok(items);
    }

    [HttpGet]
    public async Task<IActionResult> List([FromQuery] string? status, [FromQuery] string? empcod, CancellationToken ct)
    {
        if (!await CallerCanDecideAsync(ct)) return Forbid();
        var items = await ProjectListAsync(q =>
        {
            if (!string.IsNullOrWhiteSpace(status)) q = q.Where(d => d.Status == status);
            if (!string.IsNullOrWhiteSpace(empcod)) q = q.Where(d => d.Empcod == empcod);
            return q;
        }, ct);
        return Ok(items);
    }

    // ───────────────────────────────────────────────────────────────────────
    // Approve / Reject
    // ───────────────────────────────────────────────────────────────────────
    [HttpPost("{id:int}/approve")]
    public async Task<IActionResult> Approve(int id, [FromBody] DecisionRequest req, CancellationToken ct)
        => await DecideAsync(id, accept: true, req?.Comment, ct);

    [HttpPost("{id:int}/reject")]
    public async Task<IActionResult> Reject(int id, [FromBody] DecisionRequest req, CancellationToken ct)
    {
        if (req == null || string.IsNullOrWhiteSpace(req.Comment))
            return BadRequest(new { error = "Motif de refus obligatoire." });
        return await DecideAsync(id, accept: false, req.Comment, ct);
    }

    private async Task<IActionResult> DecideAsync(int id, bool accept, string? comment, CancellationToken ct)
    {
        var caller = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        if (string.IsNullOrEmpty(caller)) return Unauthorized();
        if (!await CallerCanDecideAsync(ct)) return Forbid();

        var entity = await _db.DemandesAbsence.FirstOrDefaultAsync(d => d.Id == id, ct);
        if (entity == null) return NotFound();
        if (!string.Equals(entity.Status, "Pending", StringComparison.OrdinalIgnoreCase))
            return Conflict(new { error = "Demande déjà traitée." });

        entity.Status = accept ? "Approved" : "Rejected";
        entity.DecidedBy = caller;
        entity.DecidedAt = DateTime.UtcNow;
        entity.DecisionComment = string.IsNullOrWhiteSpace(comment) ? null : comment.Trim();
        await _db.SaveChangesAsync(ct);

        // ─── Insertion automatique dans Absences et Sanctions (uniquement à l'approbation) ───
        // Exigence produit 2026-05 : « toute demande d'absence acceptée doit
        // être ajoutée systématiquement à la liste Absences et Sanctions ».
        // Sans cela, le RH devait recopier manuellement chaque demande validée
        // dans l'écran Sanctions pour qu'elle remonte dans le pointage et la
        // paie — source d'oubli et de double saisie.
        //
        // Best-effort : si l'insertion Sanction échoue (collision PK persistante,
        // contrainte FK manquante…), on log mais la demande reste validée. Le
        // manager peut toujours recréer manuellement via /dashboard/absence-et-sanction.
        if (accept)
        {
            try
            {
                await InsertSanctionFromDemandeAsync(entity, ct);
            }
            catch (Exception sanctEx)
            {
                _log.LogWarning(sanctEx,
                    "DemandeAbsence.DecideAsync — insertion Sanction échouée pour DemandeAbsence id={Id} (demande quand même approuvée).",
                    entity.Id);
            }
        }

        // ─── Notification employé : push/in-app + email best-effort ───
        try
        {
            var employee = await _db.Employes.AsNoTracking()
                .Where(e => e.Soccod == entity.Soccod && e.Empcod == entity.Empcod)
                .Select(e => new { e.Emplib, e.Empemail })
                .FirstOrDefaultAsync(ct);

            // Libellé du type d'absence (ex: "Maladie") — utile dans le mail.
            // Null-safe : on tolère un Abscod non renseigné côté demande.
            string? absenceLabel = null;
            if (!string.IsNullOrEmpty(entity.Abscod))
            {
                absenceLabel = await _db.Absences.AsNoTracking()
                    .Where(a => a.Abscod == entity.Abscod)
                    .Select(a => a.Abslib)
                    .FirstOrDefaultAsync(ct);
            }

            var period = entity.StartDate.Date == entity.EndDate.Date
                ? entity.StartDate.ToString("dd/MM/yyyy")
                : $"{entity.StartDate:dd/MM/yyyy} → {entity.EndDate:dd/MM/yyyy}";

            // 1. Push + centre de notifications
            if (_notify != null && !string.IsNullOrEmpty(entity.Empcod))
            {
                var title = accept ? "✅ Absence validée" : "❌ Absence refusée";
                var bodyText = accept
                    ? $"Votre demande du {period} a été validée."
                        + (string.IsNullOrWhiteSpace(entity.DecisionComment) ? "" : $" Note : {entity.DecisionComment}")
                    : $"Votre demande du {period} a été refusée. Motif : {entity.DecisionComment}";
                _ = _notify.NotifyUserAsync(entity.Empcod, title, bodyText,
                    new { type = accept ? "absence_request_approved" : "absence_request_rejected", id = entity.Id, soccod = entity.Soccod });
            }

            // 2. Email
            if (_email != null && !string.IsNullOrWhiteSpace(employee?.Empemail))
            {
                try
                {
                    var subject = accept
                        ? "Votre demande d'absence a été validée"
                        : "Votre demande d'absence a été refusée";
                    var html = BuildAbsenceDecisionEmail(
                        employeeName: employee.Emplib ?? entity.Empcod ?? "",
                        approved: accept,
                        period: period,
                        absenceLabel: absenceLabel,
                        reason: entity.Reason,
                        commentaire: entity.DecisionComment);
                    await _email.SendEmailAsync(employee.Empemail!, subject, html);
                }
                catch (Exception emailEx)
                {
                    _log.LogWarning(emailEx, "Email de notification absence non envoyé — id={Id} empcod={Empcod}", entity.Id, entity.Empcod);
                }
            }
        }
        catch (Exception notifyEx)
        {
            _log.LogWarning(notifyEx, "DemandeAbsence.DecideAsync — notification employé ignorée (record sauvegardé).");
        }

        return Ok(await ProjectAsync(entity.Id, ct));
    }

    /// <summary>
    /// Crée une ligne dans la table <c>sanction</c> à partir d'une DemandeAbsence
    /// approuvée. Mapping :
    ///   - <c>Condep</c> = StartDate
    ///   - <c>Conret</c> = EndDate + 1 jour (convention : Conret est le jour de
    ///     RETOUR au travail quand <c>Conamret = "0"</c> — cf. SanctionRepository
    ///     .GetSanctionDateAsync ligne ~358 qui exclut Conret si Conamret≠"1").
    ///   - <c>Conjour = "J"</c>, <c>Conamdep/Conamret = "0"</c> (journée complète).
    ///   - <c>Consanc = "N"</c> (aligné sur le hardcoding du formulaire UI, cf.
    ///     AbsenceSanctionModern.tsx:172 — signifie « absence non disciplinaire »).
    ///   - <c>Conmotif</c> = motif libre tronqué à 50 caractères (limite colonne).
    ///   - <c>Conref = "DA{id}"</c> : back-référence pour tracer la sanction
    ///     vers la demande source (utile pour audit + éventuelle suppression
    ///     en cas de revert).
    ///
    /// Génération du <c>Concod</c> côté serveur avec retry sur collision PK
    /// (pattern repris de DemCongesController : on calcule MAX une fois, on
    /// tente l'insert, si conflit on incrémente et on retente jusqu'à 10 essais).
    /// </summary>
    private async Task InsertSanctionFromDemandeAsync(DemandeAbsence entity, CancellationToken ct)
    {
        // Sécurité : on ne réinsère pas si une sanction porte déjà la référence
        // DA{id}. Couvre le cas (en théorie impossible vu le garde Pending dans
        // DecideAsync) où DecideAsync serait appelé deux fois suite à un retry
        // réseau côté front.
        var backref = $"DA{entity.Id}";
        var alreadyExists = await _db.Sanctions.AsNoTracking()
            .AnyAsync(s => s.Soccod == entity.Soccod && s.Conref == backref, ct);
        if (alreadyExists)
        {
            _log.LogInformation("InsertSanctionFromDemandeAsync — sanction déjà présente pour DemandeAbsence id={Id}, skip.", entity.Id);
            return;
        }

        var now = DateTime.Now;
        // Prefix "A" (Absence) + yyMM, 5 caractères → laisse 5 chiffres pour la
        // séquence dans la limite Concod[10]. Distingue de "D" (DemConge).
        var prefix = "A" + now.ToString("yyMM");

        // Bootstrap nextSeq depuis le max actuel pour la société + le préfixe.
        int nextSeq;
        {
            var maxConcod = await _db.Sanctions.AsNoTracking()
                .Where(s => s.Soccod == entity.Soccod && s.Concod!.StartsWith(prefix))
                .OrderByDescending(s => s.Concod)
                .Select(s => s.Concod)
                .FirstOrDefaultAsync(ct);

            nextSeq = 1;
            if (!string.IsNullOrEmpty(maxConcod) && maxConcod.Length > prefix.Length
                && int.TryParse(maxConcod.Substring(prefix.Length), out int lastSeq))
            {
                nextSeq = lastSeq + 1;
            }
        }

        // Reason tronqué à 50 car la colonne Conmotif accepte 50 max alors que
        // DemandeAbsence.Reason accepte 1000. Tronquer côté serveur évite un
        // DbUpdateException sur StringLength validator.
        var motif = string.IsNullOrWhiteSpace(entity.Reason)
            ? null
            : (entity.Reason.Length > 50 ? entity.Reason.Substring(0, 50) : entity.Reason);

        const int maxRetries = 10;
        for (int attempt = 0; attempt < maxRetries; attempt++)
        {
            var sanction = new Sanction
            {
                Soccod = entity.Soccod,
                Concod = prefix + nextSeq.ToString("D5"),
                Empcod = entity.Empcod,
                Condat = (entity.DecidedAt ?? DateTime.UtcNow).Date,
                Condep = entity.StartDate.Date,
                Conamdep = "0",
                // Conret = jour de RETOUR (exclusif quand Conamret="0").
                Conret = entity.EndDate.Date.AddDays(1),
                Conamret = "0",
                Conjour = "J",
                Abscod = entity.Abscod, // peut être null — le RH complétera dans l'écran Sanctions
                Conmotif = motif,
                Consanc = "N",
                Connbjour = entity.DaysCount,
                Conref = backref,
            };

            try
            {
                _db.Sanctions.Add(sanction);
                await _db.SaveChangesAsync(ct);
                return; // succès
            }
            catch (DbUpdateException ex) when (IsUniqueViolation(ex))
            {
                // Collision PK : un autre flux a pris notre numéro entre temps.
                // On detach l'entité (sinon EF essaie de la réinsérer au prochain
                // SaveChanges) et on incrémente pour réessayer.
                _db.Entry(sanction).State = EntityState.Detached;
                nextSeq++;
            }
        }

        // Si on arrive ici, on a épuisé les retries — log mais on ne fait pas
        // remonter d'exception (best-effort, cf. appelant).
        _log.LogWarning(
            "InsertSanctionFromDemandeAsync — abandon après {Max} tentatives (collisions PK persistantes) pour DemandeAbsence id={Id} Soccod={Soccod}.",
            maxRetries, entity.Id, entity.Soccod);
    }

    /// <summary>
    /// Détecte une violation de contrainte unique (PK ou UNIQUE INDEX), portable
    /// Postgres (SQLSTATE 23505) / SQL Server (2627/2601). Repris du même helper
    /// inline dans DemCongesController — à factoriser si un 3e contrôleur en a besoin.
    /// </summary>
    private static bool IsUniqueViolation(DbUpdateException ex)
    {
        var inner = ex.InnerException;
        if (inner == null) return false;
        var msg = inner.Message ?? string.Empty;
        return msg.Contains("23505", StringComparison.OrdinalIgnoreCase)       // Postgres unique_violation
            || msg.Contains("duplicate key", StringComparison.OrdinalIgnoreCase)
            || msg.Contains("PRIMARY KEY", StringComparison.OrdinalIgnoreCase) // SQL Server 2627
            || msg.Contains("UNIQUE", StringComparison.OrdinalIgnoreCase);     // SQL Server 2601 + Sqlite
    }

    /// <summary>Email HTML aligné stylistiquement sur BuildTeletravailDecisionEmail
    /// et BuildOvertimeDecisionEmail. À factoriser dans EmailTemplates.cs si un
    /// 4e flux gagne le même format.</summary>
    private static string BuildAbsenceDecisionEmail(string employeeName, bool approved, string period, string? absenceLabel, string? reason, string? commentaire)
    {
        var statusLabel = approved ? "validée" : "refusée";
        var statusColor = approved ? "#16a34a" : "#dc2626";
        var statusIcon = approved ? "✅" : "❌";
        var commentaireBlock = string.IsNullOrWhiteSpace(commentaire)
            ? ""
            : $"<p style='margin:12px 0;padding:12px;background:#f8fafc;border-left:3px solid {statusColor};border-radius:4px;'><strong>{(approved ? "Note du validateur" : "Motif du refus")} :</strong><br>{System.Net.WebUtility.HtmlEncode(commentaire)}</p>";

        return $@"<!DOCTYPE html>
<html><body style='font-family:Arial,Helvetica,sans-serif;color:#1e293b;max-width:560px;margin:0 auto;padding:24px;'>
  <h2 style='color:{statusColor};margin:0 0 16px;'>{statusIcon} Demande d'absence {statusLabel}</h2>
  <p>Bonjour {System.Net.WebUtility.HtmlEncode(employeeName)},</p>
  <p>Votre demande d'absence a été <strong style='color:{statusColor};'>{statusLabel}</strong>.</p>
  <table style='width:100%;border-collapse:collapse;margin:16px 0;font-size:14px;'>
    <tr><td style='padding:8px;border-bottom:1px solid #e2e8f0;color:#64748b;'>Période</td><td style='padding:8px;border-bottom:1px solid #e2e8f0;'><strong>{System.Net.WebUtility.HtmlEncode(period)}</strong></td></tr>
    <tr><td style='padding:8px;border-bottom:1px solid #e2e8f0;color:#64748b;'>Type</td><td style='padding:8px;border-bottom:1px solid #e2e8f0;'>{System.Net.WebUtility.HtmlEncode(absenceLabel ?? "—")}</td></tr>
    <tr><td style='padding:8px;color:#64748b;'>Motif</td><td style='padding:8px;'>{System.Net.WebUtility.HtmlEncode(reason ?? "—")}</td></tr>
  </table>
  {commentaireBlock}
  <p style='margin-top:24px;font-size:12px;color:#94a3b8;'>Concorde Workly — Notification automatique</p>
</body></html>";
    }

    // ───────────────────────────────────────────────────────────────────────
    // Helpers — repris à l'identique de TeletravailController pour cohérence.
    // ───────────────────────────────────────────────────────────────────────
    private async Task<bool> CallerCanDecideAsync(CancellationToken ct)
    {
        var caller = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        if (string.IsNullOrEmpty(caller)) return false;
        return await _db.Utilisateurs.AsNoTracking()
            .Where(u => u.Uticod == caller)
            .Select(u => u.Utiadm == "1"
                      || PermissionCatalog.IsAdminRole(u.Utirole)
                      || u.Utirole == PermissionCatalog.Roles.Manager)
            .FirstOrDefaultAsync(ct);
    }

    private Task<DemandeAbsenceDto?> ProjectAsync(int id, CancellationToken ct)
        => BaseProjection().Where(d => d.Id == id).FirstOrDefaultAsync(ct);

    private async Task<List<DemandeAbsenceDto>> ProjectListAsync(
        Func<IQueryable<DemandeAbsence>, IQueryable<DemandeAbsence>> filter,
        CancellationToken ct)
    {
        var filtered = filter(_db.DemandesAbsence.AsNoTracking()).Select(d => d.Id);
        return await BaseProjection()
            .Where(p => filtered.Contains(p.Id))
            .OrderByDescending(p => p.RequestedAt)
            .ToListAsync(ct);
    }

    /// <summary>
    /// Projection enrichie : nom collaborateur (Employes.Emplib), libellé du type
    /// d'absence (Absence.Abslib) si renseigné, nom du décideur (Utilisateurs).
    /// </summary>
    private IQueryable<DemandeAbsenceDto> BaseProjection()
    {
        return from d in _db.DemandesAbsence.AsNoTracking()
               join e in _db.Employes.AsNoTracking() on d.Empcod equals e.Empcod into ej
               from e in ej.DefaultIfEmpty()
               join a in _db.Absences.AsNoTracking() on d.Abscod equals a.Abscod into aj
               from a in aj.DefaultIfEmpty()
               join u in _db.Utilisateurs.AsNoTracking() on d.DecidedBy equals u.Uticod into uj
               from u in uj.DefaultIfEmpty()
               select new DemandeAbsenceDto
               {
                   Id = d.Id,
                   Empcod = d.Empcod,
                   EmployeeName = e != null ? e.Emplib : null,
                   RequestedAt = d.RequestedAt,
                   StartDate = d.StartDate,
                   EndDate = d.EndDate,
                   DaysCount = d.DaysCount,
                   Abscod = d.Abscod,
                   AbsenceLabel = a != null ? a.Abslib : null,
                   Reason = d.Reason,
                   JustificationUrl = d.JustificationUrl,
                   JustificationFilename = d.JustificationFilename,
                   JustificationMime = d.JustificationMime,
                   JustificationSize = d.JustificationSize,
                   Status = d.Status,
                   DecidedBy = d.DecidedBy,
                   DecidedByName = u != null ? ((u.Utiprn ?? "") + " " + (u.Utinom ?? "")).Trim() : null,
                   DecidedAt = d.DecidedAt,
                   DecisionComment = d.DecisionComment,
               };
    }

    private static float CountBusinessDays(DateTime start, DateTime end)
    {
        var d = start.Date;
        var last = end.Date;
        int count = 0;
        while (d <= last)
        {
            if (d.DayOfWeek != DayOfWeek.Saturday && d.DayOfWeek != DayOfWeek.Sunday) count++;
            d = d.AddDays(1);
        }
        return count;
    }
}
