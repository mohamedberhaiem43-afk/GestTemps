using ABRPOINT.Server.Authorization;
using ABRPOINT.Server.Data;
using ABRPOINT.Server.Interfaces;
using ABRPOINT.Server.Models;
using ABRPOINT.Server.Services;
using ABRPOINT.Server.Tenancy;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Globalization;
using System.Security.Claims;

namespace ABRPOINT.Server.Controllers;

/// <summary>
/// Workflow de demandes de télétravail. Endpoints publics :
///   • POST   /api/Teletravail                    — employé crée une demande
///   • POST   /api/Teletravail/{id}/cancel        — employé annule sa demande Pending
///   • GET    /api/Teletravail/me                 — employé liste ses propres demandes
///   • GET    /api/Teletravail/pending            — manager/admin liste les demandes à valider
///   • GET    /api/Teletravail?status=…&empcod=…  — manager/admin liste avec filtres
///   • POST   /api/Teletravail/{id}/approve       — manager/admin approuve
///   • POST   /api/Teletravail/{id}/reject        — manager/admin refuse (motif obligatoire)
///
/// Gating plan : <c>LeaveManagement</c>. Tous les packs (Starter / Standard / Premium)
/// l'ont activé, donc la feature est ouverte partout — on garde le gating pour homogénéité
/// avec <see cref="DemCongesController"/> et pour pouvoir restreindre plus tard sans
/// modifier le contrôleur si la politique commerciale change.
/// </summary>
[Route("api/[controller]")]
[ApiController]
[Authorize]
[RequirePlanFeature(nameof(PlanFeatures.LeaveManagement))]
public class TeletravailController : ControllerBase
{
    private readonly ApplicationDbContext _db;
    private readonly ILogger<TeletravailController> _log;
    // Notifications best-effort : un push/email qui échoue ne doit jamais
    // faire retomber l'action métier sur "Impossible de créer la demande"
    // alors que la ligne est bien persistée. Champs nullable + try/catch
    // autour de chaque appel — pattern repris d'AutorisersController et
    // DemCongesController.
    private readonly IUserNotificationService? _notify;
    private readonly IEmailService? _email;

    public TeletravailController(
        ApplicationDbContext db,
        ILogger<TeletravailController> log,
        IUserNotificationService? notify = null,
        IEmailService? email = null)
    {
        _db = db;
        _log = log;
        _notify = notify;
        _email = email;
    }

    // ───────────────────────────────────────────────────────────────────────
    // DTOs — exposés au front pour ne pas leaker l'entité brute (le binding
    // direct de Teletravail laisserait l'employé écrire `status` ou
    // `decided_by` à la création, court-circuitant le workflow).
    // ───────────────────────────────────────────────────────────────────────
    public sealed class CreateRequest
    {
        public DateTime StartDate { get; set; }
        public DateTime EndDate { get; set; }
        public string? Reason { get; set; }
    }

    public sealed class DecisionRequest
    {
        // Pour /approve : optionnel (commentaire d'accompagnement).
        // Pour /reject : obligatoire (motif visible par l'employé).
        public string? Comment { get; set; }
    }

    public sealed class TeletravailDto
    {
        public int Id { get; set; }
        public string? Empcod { get; set; }
        public string? EmployeeName { get; set; }
        public DateTime RequestedAt { get; set; }
        public DateTime StartDate { get; set; }
        public DateTime EndDate { get; set; }
        public float? DaysCount { get; set; }
        public string? Reason { get; set; }
        public string Status { get; set; } = "Pending";
        public string? DecidedBy { get; set; }
        public string? DecidedByName { get; set; }
        public DateTime? DecidedAt { get; set; }
        public string? DecisionComment { get; set; }
    }

    // ───────────────────────────────────────────────────────────────────────
    // POST /api/Teletravail — création par un collaborateur
    // ───────────────────────────────────────────────────────────────────────
    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreateRequest req, CancellationToken ct)
    {
        var caller = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        if (string.IsNullOrEmpty(caller)) return Unauthorized();

        // Validations métier strictes — on refuse plutôt que de tronquer/corriger
        // côté serveur, pour que le front affiche un message clair.
        if (req.StartDate == default || req.EndDate == default)
            return BadRequest(new { error = "Dates de début et fin requises." });
        if (req.EndDate.Date < req.StartDate.Date)
            return BadRequest(new { error = "La date de fin doit être ≥ à la date de début." });
        if (req.StartDate.Date < DateTime.UtcNow.Date.AddDays(-1))
            return BadRequest(new { error = "Impossible de demander un télétravail dans le passé." });
        if (!string.IsNullOrEmpty(req.Reason) && req.Reason.Length > 500)
            return BadRequest(new { error = "Motif trop long (500 caractères max)." });

        // Convention projet : `Uticod == Empcod` pour un compte rattaché à un
        // collaborateur (cf. EmployesController:900, VaultController:311…). Le
        // claim NameIdentifier sert donc directement de clé Employe. On vérifie
        // qu'une fiche existe — sinon c'est un admin sans Employe et le TT n'a
        // pas de sens (on rejette plutôt que de créer une demande orpheline).
        var employe = await _db.Employes.AsNoTracking()
            .Where(e => e.Empcod == caller)
            .Select(e => new { e.Empcod, e.Soccod, e.EmpTeletravailEligible })
            .FirstOrDefaultAsync(ct);
        if (employe == null)
            return BadRequest(new { error = "Compte non rattaché à un collaborateur." });

        // Éligibilité : un salarié marqué non éligible ("0") ne peut pas soumettre de
        // demande. null/"1" = éligible (défaut), pour ne pas bloquer les fiches existantes.
        if (employe.EmpTeletravailEligible == "0")
            return BadRequest(new { error = "Vous n'êtes pas éligible au télétravail. Rapprochez-vous de votre RH." });

        // Anti-collision : on bloque les demandes Pending OU Approved qui se
        // chevauchent avec la nouvelle plage. Évite qu'un employé fasse 3
        // demandes pour les mêmes jours et que le manager les valide toutes.
        var overlap = await _db.Teletravails.AsNoTracking()
            .AnyAsync(t => t.Empcod == employe.Empcod
                        && (t.Status == "Pending" || t.Status == "Approved")
                        && t.StartDate.Date <= req.EndDate.Date
                        && t.EndDate.Date   >= req.StartDate.Date, ct);
        if (overlap)
            return Conflict(new { error = "Une demande de télétravail couvre déjà ces dates." });

        // Politique société : délai de prévenance + quota hebdomadaire (cf. Parametre).
        var policyError = await ValidatePolicyAsync(employe.Soccod!, employe.Empcod!, req.StartDate.Date, req.EndDate.Date, ct);
        if (policyError != null)
            return BadRequest(new { error = policyError });

        var entity = new Teletravail
        {
            Soccod = employe.Soccod,
            Empcod = employe.Empcod,
            StartDate = req.StartDate.Date,
            EndDate = req.EndDate.Date,
            Reason = string.IsNullOrWhiteSpace(req.Reason) ? null : req.Reason.Trim(),
            // DaysCount = jours ouvrés (lun-ven) dans la plage, indicatif pour
            // l'UI manager. On ne soustrait pas les jours fériés ici (pas de
            // calendrier férié branché à ce stade) — c'est un compteur brut.
            DaysCount = CountBusinessDays(req.StartDate.Date, req.EndDate.Date),
            Status = "Pending",
            RequestedAt = DateTime.UtcNow,
            CreatedAt = DateTime.UtcNow,
        };
        _db.Teletravails.Add(entity);
        await _db.SaveChangesAsync(ct);

        // ─── Notification managers/admins (best-effort) ───
        // On notifie ceux qui peuvent valider qu'une nouvelle demande arrive.
        // Pas d'email côté managers (trop spammy en cas de pic de demandes) :
        // push/in-app seulement. L'email part lors de la décision côté employé.
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
                _ = _notify.NotifyManagersAsync(
                    "🏠 Demande de télétravail à valider",
                    $"{who} demande le télétravail du {period}.",
                    new { type = "teletravail_request_created", id = entity.Id, soccod = entity.Soccod });
            }
        }
        catch (Exception notifyEx)
        {
            _log.LogWarning(notifyEx, "Teletravail.Create — notification managers ignorée (record sauvegardé).");
        }

        return Ok(await ProjectAsync(entity.Id, ct));
    }

    // ───────────────────────────────────────────────────────────────────────
    // POST /api/Teletravail/{id}/cancel — annulation par le demandeur tant
    // que la demande est encore Pending.
    // ───────────────────────────────────────────────────────────────────────
    [HttpPost("{id:int}/cancel")]
    public async Task<IActionResult> Cancel(int id, CancellationToken ct)
    {
        var caller = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        if (string.IsNullOrEmpty(caller)) return Unauthorized();

        var entity = await _db.Teletravails.FirstOrDefaultAsync(t => t.Id == id, ct);
        if (entity == null) return NotFound();
        // L'annulation est un acte du demandeur : un admin n'annule pas à sa place
        // (il refuse via /reject avec motif). Ça simplifie l'audit trail.
        // Convention Uticod == Empcod.
        if (!string.Equals(entity.Empcod, caller, StringComparison.OrdinalIgnoreCase))
            return Forbid();
        if (!string.Equals(entity.Status, "Pending", StringComparison.OrdinalIgnoreCase))
            return Conflict(new { error = "Seules les demandes en attente peuvent être annulées." });

        entity.Status = "Cancelled";
        entity.DecidedAt = DateTime.UtcNow;
        entity.DecidedBy = caller;
        await _db.SaveChangesAsync(ct);

        // Courtoisie : on prévient les managers que la demande qu'ils avaient
        // peut-être dans leur file "à valider" a disparu. Évite qu'ils ouvrent
        // l'écran de validation pour découvrir une demande déjà annulée.
        try
        {
            if (_notify != null)
            {
                var period = entity.StartDate.Date == entity.EndDate.Date
                    ? entity.StartDate.ToString("dd/MM/yyyy")
                    : $"{entity.StartDate:dd/MM/yyyy} → {entity.EndDate:dd/MM/yyyy}";
                _ = _notify.NotifyManagersAsync(
                    "🏠 Demande de télétravail annulée",
                    $"La demande du {period} a été annulée par le collaborateur.",
                    new { type = "teletravail_request_cancelled", id = entity.Id, soccod = entity.Soccod });
            }
        }
        catch (Exception notifyEx)
        {
            _log.LogWarning(notifyEx, "Teletravail.Cancel — notification managers ignorée.");
        }

        return Ok(await ProjectAsync(entity.Id, ct));
    }

    // ───────────────────────────────────────────────────────────────────────
    // GET /api/Teletravail/me — liste personnelle (toutes les demandes du caller)
    // ───────────────────────────────────────────────────────────────────────
    [HttpGet("me")]
    public async Task<IActionResult> ListMine(CancellationToken ct)
    {
        var caller = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        if (string.IsNullOrEmpty(caller)) return Unauthorized();
        // Convention Uticod == Empcod (cf. note dans Create).
        var items = await ProjectListAsync(q => q.Where(t => t.Empcod == caller), ct);
        return Ok(items);
    }

    // ───────────────────────────────────────────────────────────────────────
    // GET /api/Teletravail/pending — liste des demandes à traiter pour les
    // décideurs (admin / manager). Le front l'utilise pour le badge de
    // notification dans la sidebar « Validation télétravail ».
    // ───────────────────────────────────────────────────────────────────────
    [HttpGet("pending")]
    public async Task<IActionResult> ListPending(CancellationToken ct)
    {
        if (!await CallerCanDecideAsync(ct)) return Forbid();
        var items = await ProjectListAsync(q => q.Where(t => t.Status == "Pending"), ct);
        return Ok(items);
    }

    // ───────────────────────────────────────────────────────────────────────
    // GET /api/Teletravail — liste générale avec filtres (admin/manager)
    // ───────────────────────────────────────────────────────────────────────
    [HttpGet]
    public async Task<IActionResult> List([FromQuery] string? status, [FromQuery] string? empcod, CancellationToken ct)
    {
        if (!await CallerCanDecideAsync(ct)) return Forbid();
        var items = await ProjectListAsync(q =>
        {
            if (!string.IsNullOrWhiteSpace(status)) q = q.Where(t => t.Status == status);
            if (!string.IsNullOrWhiteSpace(empcod)) q = q.Where(t => t.Empcod == empcod);
            return q;
        }, ct);
        return Ok(items);
    }

    // ───────────────────────────────────────────────────────────────────────
    // POST /api/Teletravail/{id}/approve
    // POST /api/Teletravail/{id}/reject
    // ───────────────────────────────────────────────────────────────────────
    // ───────────────────────────────────────────────────────────────────────
    // GET /api/Teletravail/on-date/{soccod}?date=yyyy-MM-dd — collaborateurs en
    // télétravail APPROUVÉ couvrant la date donnée (défaut : aujourd'hui). Sert
    // à l'affichage « qui est en télétravail » (pointage du jour, calendrier
    // d'équipe, suivi positions). Réservé aux décideurs (admin/manager).
    // ───────────────────────────────────────────────────────────────────────
    [HttpGet("on-date/{soccod}")]
    public async Task<IActionResult> OnDate(string soccod, [FromQuery] string? date, CancellationToken ct)
    {
        if (!await CallerCanDecideAsync(ct)) return Forbid();
        var d = DateTime.TryParse(date, out var parsed) ? parsed.Date : DateTime.UtcNow.Date;

        var rows = await (
            from t in _db.Teletravails.AsNoTracking()
            join e in _db.Employes.AsNoTracking() on t.Empcod equals e.Empcod into ej
            from e in ej.DefaultIfEmpty()
            where t.Soccod == soccod && t.Status == "Approved"
                  && t.StartDate.Date <= d && t.EndDate.Date >= d
            select new
            {
                empcod = t.Empcod,
                employeeName = e != null ? e.Emplib : null,
                startDate = t.StartDate,
                endDate = t.EndDate,
            }).ToListAsync(ct);

        return Ok(rows);
    }

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

        var entity = await _db.Teletravails.FirstOrDefaultAsync(t => t.Id == id, ct);
        if (entity == null) return NotFound();
        if (!string.Equals(entity.Status, "Pending", StringComparison.OrdinalIgnoreCase))
            return Conflict(new { error = "Demande déjà traitée." });

        entity.Status = accept ? "Approved" : "Rejected";
        entity.DecidedBy = caller;
        entity.DecidedAt = DateTime.UtcNow;
        entity.DecisionComment = string.IsNullOrWhiteSpace(comment) ? null : comment.Trim();
        await _db.SaveChangesAsync(ct);

        // ─── Notification employé : push/in-app + email best-effort ───
        // Pattern aligné sur AutorisersController.HandleOvertimeDecisionAsync.
        // Tous les envois sont fail-silent : l'action métier est déjà persistée
        // et un échec downstream (provider push down, SMTP en rade) ne doit
        // pas renvoyer 5xx au front qui invaliderait son cache de demandes.
        try
        {
            var employee = await _db.Employes.AsNoTracking()
                .Where(e => e.Soccod == entity.Soccod && e.Empcod == entity.Empcod)
                .Select(e => new { e.Emplib, e.Empemail })
                .FirstOrDefaultAsync(ct);

            var period = entity.StartDate.Date == entity.EndDate.Date
                ? entity.StartDate.ToString("dd/MM/yyyy")
                : $"{entity.StartDate:dd/MM/yyyy} → {entity.EndDate:dd/MM/yyyy}";

            // 1. Push + centre de notifications
            if (_notify != null && !string.IsNullOrEmpty(entity.Empcod))
            {
                var title = accept ? "✅ Télétravail validé" : "❌ Télétravail refusé";
                var bodyText = accept
                    ? $"Votre demande du {period} a été validée."
                        + (string.IsNullOrWhiteSpace(entity.DecisionComment) ? "" : $" Note : {entity.DecisionComment}")
                    : $"Votre demande du {period} a été refusée. Motif : {entity.DecisionComment}";
                _ = _notify.NotifyUserAsync(entity.Empcod, title, bodyText,
                    new { type = accept ? "teletravail_request_approved" : "teletravail_request_rejected", id = entity.Id, soccod = entity.Soccod });
            }

            // 2. Email — seulement si l'employé a un Empemail valide. Échec silencieux.
            if (_email != null && !string.IsNullOrWhiteSpace(employee?.Empemail))
            {
                try
                {
                    var subject = accept
                        ? "Votre demande de télétravail a été validée"
                        : "Votre demande de télétravail a été refusée";
                    var html = BuildTeletravailDecisionEmail(
                        employeeName: employee.Emplib ?? entity.Empcod ?? "",
                        approved: accept,
                        period: period,
                        reason: entity.Reason,
                        commentaire: entity.DecisionComment);
                    await _email.SendEmailAsync(employee.Empemail!, subject, html);
                }
                catch (Exception emailEx)
                {
                    _log.LogWarning(emailEx, "Email de notification télétravail non envoyé — id={Id} empcod={Empcod}", entity.Id, entity.Empcod);
                }
            }
        }
        catch (Exception notifyEx)
        {
            _log.LogWarning(notifyEx, "Teletravail.DecideAsync — notification employé ignorée (record sauvegardé).");
        }

        return Ok(await ProjectAsync(entity.Id, ct));
    }

    /// <summary>Email HTML simple aligné stylistiquement sur BuildOvertimeDecisionEmail
    /// (cf. AutorisersController). À factoriser dans EmailTemplates.cs si un 3e
    /// flux gagne le même mail de décision.</summary>
    private static string BuildTeletravailDecisionEmail(string employeeName, bool approved, string period, string? reason, string? commentaire)
    {
        var statusLabel = approved ? "validée" : "refusée";
        var statusColor = approved ? "#16a34a" : "#dc2626";
        var statusIcon = approved ? "✅" : "❌";
        var commentaireBlock = string.IsNullOrWhiteSpace(commentaire)
            ? ""
            : $"<p style='margin:12px 0;padding:12px;background:#f8fafc;border-left:3px solid {statusColor};border-radius:4px;'><strong>{(approved ? "Note du validateur" : "Motif du refus")} :</strong><br>{System.Net.WebUtility.HtmlEncode(commentaire)}</p>";

        return $@"<!DOCTYPE html>
<html><body style='font-family:Arial,Helvetica,sans-serif;color:#1e293b;max-width:560px;margin:0 auto;padding:24px;'>
  <h2 style='color:{statusColor};margin:0 0 16px;'>{statusIcon} Demande de télétravail {statusLabel}</h2>
  <p>Bonjour {System.Net.WebUtility.HtmlEncode(employeeName)},</p>
  <p>Votre demande de télétravail a été <strong style='color:{statusColor};'>{statusLabel}</strong>.</p>
  <table style='width:100%;border-collapse:collapse;margin:16px 0;font-size:14px;'>
    <tr><td style='padding:8px;border-bottom:1px solid #e2e8f0;color:#64748b;'>Période</td><td style='padding:8px;border-bottom:1px solid #e2e8f0;'><strong>{System.Net.WebUtility.HtmlEncode(period)}</strong></td></tr>
    <tr><td style='padding:8px;color:#64748b;'>Motif</td><td style='padding:8px;'>{System.Net.WebUtility.HtmlEncode(reason ?? "—")}</td></tr>
  </table>
  {commentaireBlock}
  <p style='margin-top:24px;font-size:12px;color:#94a3b8;'>Concorde Workly — Notification automatique</p>
</body></html>";
    }

    // ───────────────────────────────────────────────────────────────────────
    // Helpers
    // ───────────────────────────────────────────────────────────────────────

    /// <summary>
    /// Vrai si le caller a le droit d'instruire une demande (admin tenant ou
    /// manager de service). On reste minimal : pas de granularité par RP module
    /// dédié — l'utilisateur final voit l'écran via la sidebar (qui gate déjà
    /// sur isManager || isAdminEffective).
    /// </summary>
    private async Task<bool> CallerCanDecideAsync(CancellationToken ct)
    {
        var caller = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        if (string.IsNullOrEmpty(caller)) return false;
        // Manager : pas de helper IsManagerRole dans PermissionCatalog — on compare
        // directement à la constante Roles.Manager (cf. PermissionCatalog.Roles).
        return await _db.Utilisateurs.AsNoTracking()
            .Where(u => u.Uticod == caller)
            .Select(u => u.Utiadm == "1"
                      || PermissionCatalog.IsAdminRole(u.Utirole)
                      || u.Utirole == PermissionCatalog.Roles.Manager)
            .FirstOrDefaultAsync(ct);
    }

    private Task<TeletravailDto?> ProjectAsync(int id, CancellationToken ct)
        => BaseProjection().Where(d => d.Id == id).FirstOrDefaultAsync(ct);

    private async Task<List<TeletravailDto>> ProjectListAsync(
        Func<IQueryable<Teletravail>, IQueryable<Teletravail>> filter,
        CancellationToken ct)
    {
        // On applique le filtre sur l'entité, puis on projette via la base
        // pour conserver le JOIN employé/utilisateur.
        var filtered = filter(_db.Teletravails.AsNoTracking())
            .Select(t => t.Id);
        return await BaseProjection()
            .Where(d => filtered.Contains(d.Id))
            .OrderByDescending(d => d.RequestedAt)
            .ToListAsync(ct);
    }

    /// <summary>Projection enrichie : nom du collaborateur + nom du décideur.</summary>
    private IQueryable<TeletravailDto> BaseProjection()
    {
        return from t in _db.Teletravails.AsNoTracking()
               join e in _db.Employes.AsNoTracking() on t.Empcod equals e.Empcod into ej
               from e in ej.DefaultIfEmpty()
               join u in _db.Utilisateurs.AsNoTracking() on t.DecidedBy equals u.Uticod into uj
               from u in uj.DefaultIfEmpty()
               select new TeletravailDto
               {
                   Id = t.Id,
                   Empcod = t.Empcod,
                   EmployeeName = e != null ? e.Emplib : null,
                   RequestedAt = t.RequestedAt,
                   StartDate = t.StartDate,
                   EndDate = t.EndDate,
                   DaysCount = t.DaysCount,
                   Reason = t.Reason,
                   Status = t.Status,
                   DecidedBy = t.DecidedBy,
                   // Utilisateur n'a pas de champ display unique : on concatène
                   // « Prénom Nom » (Utiprn + Utinom) ; les espaces vides sont
                   // gérés côté front si l'un des deux est null.
                   DecidedByName = u != null ? ((u.Utiprn ?? "") + " " + (u.Utinom ?? "")).Trim() : null,
                   DecidedAt = t.DecidedAt,
                   DecisionComment = t.DecisionComment,
               };
    }

    // ───────────────────────────────────────────────────────────────────────
    // Politique télétravail (quota hebdo + délai de prévenance) — config société
    // ───────────────────────────────────────────────────────────────────────
    public sealed class TtParamsDto
    {
        public string Soccod { get; set; } = string.Empty;
        /// <summary>Quota de jours de télétravail par semaine (0 = pas de quota).</summary>
        public float? MaxParSemaine { get; set; }
        /// <summary>Délai de prévenance minimum en jours (0 = aucun).</summary>
        public int? PrevenanceJours { get; set; }
        /// <summary>Indemnité forfaitaire par jour télétravaillé (montant, axe E). 0 = aucune.</summary>
        public float? IndemniteParJour { get; set; }
        /// <summary>Neutraliser le ticket-restaurant / panier les jours TT (axe E).</summary>
        public bool NeutraliserTicketResto { get; set; }
    }

    [HttpGet("parametres/{soccod}")]
    public async Task<IActionResult> GetParametres(string soccod, CancellationToken ct)
    {
        var p = await _db.Parametres.AsNoTracking().FirstOrDefaultAsync(x => x.Soccod == soccod, ct);
        return Ok(new TtParamsDto
        {
            Soccod = soccod,
            MaxParSemaine = p?.Parttmaxsem ?? 0f,
            PrevenanceJours = p?.Parttprevenance ?? 0,
            IndemniteParJour = p?.Parttindemnite ?? 0f,
            NeutraliserTicketResto = p?.Parttneutralisetr == "1",
        });
    }

    [HttpPut("parametres")]
    public async Task<IActionResult> UpdateParametres([FromBody] TtParamsDto dto, CancellationToken ct)
    {
        if (!await CallerCanDecideAsync(ct)) return Forbid();
        if (string.IsNullOrWhiteSpace(dto.Soccod)) return BadRequest(new { error = "Soccod requis." });
        if (dto.MaxParSemaine is < 0) return BadRequest(new { error = "Le quota hebdomadaire ne peut pas être négatif." });
        if (dto.PrevenanceJours is < 0) return BadRequest(new { error = "Le délai de prévenance ne peut pas être négatif." });
        if (dto.IndemniteParJour is < 0) return BadRequest(new { error = "L'indemnité de télétravail ne peut pas être négative." });

        var p = await _db.Parametres.FirstOrDefaultAsync(x => x.Soccod == dto.Soccod, ct);
        if (p == null)
        {
            p = new Parametre { Soccod = dto.Soccod };
            _db.Parametres.Add(p);
        }
        p.Parttmaxsem = dto.MaxParSemaine;
        p.Parttprevenance = dto.PrevenanceJours;
        p.Parttindemnite = dto.IndemniteParJour;
        p.Parttneutralisetr = dto.NeutraliserTicketResto ? "1" : "0";
        await _db.SaveChangesAsync(ct);
        return Ok(new { success = true });
    }

    // ───────────────────────────────────────────────────────────────────────
    // GET /api/Teletravail/recap/{soccod}?from=yyyy-MM-dd&to=yyyy-MM-dd
    // Récapitulatif paie (axes D + E) : par collaborateur, nb de jours ouvrés
    // télétravaillés (TT approuvé) sur la période + montant d'indemnité forfaitaire.
    // Sert d'alimentation paie / export CSE. Réservé admin/manager.
    // ───────────────────────────────────────────────────────────────────────
    public sealed class TtRecapRow
    {
        public string? Empcod { get; set; }
        public string? EmployeeName { get; set; }
        public float JoursTeletravail { get; set; }
        public float MontantIndemnite { get; set; }
    }

    [HttpGet("recap/{soccod}")]
    public async Task<IActionResult> Recap(string soccod, [FromQuery] string? from, [FromQuery] string? to, CancellationToken ct)
    {
        if (!await CallerCanDecideAsync(ct)) return Forbid();

        var today = DateTime.UtcNow.Date;
        var start = DateTime.TryParse(from, out var f) ? f.Date : new DateTime(today.Year, today.Month, 1);
        var end = DateTime.TryParse(to, out var t) ? t.Date : start.AddMonths(1).AddDays(-1);
        if (end < start) return BadRequest(new { error = "La date de fin doit être ≥ à la date de début." });

        var indemnite = await _db.Parametres.AsNoTracking()
            .Where(p => p.Soccod == soccod).Select(p => p.Parttindemnite).FirstOrDefaultAsync(ct) ?? 0f;

        var rows = await (
            from t2 in _db.Teletravails.AsNoTracking()
            join e in _db.Employes.AsNoTracking() on t2.Empcod equals e.Empcod into ej
            from e in ej.DefaultIfEmpty()
            where t2.Soccod == soccod && t2.Status == "Approved"
                  && t2.StartDate.Date <= end && t2.EndDate.Date >= start
            select new { t2.Empcod, EmployeeName = e != null ? e.Emplib : null, t2.StartDate, t2.EndDate }
        ).ToListAsync(ct);

        // Comptage des jours ouvrés effectivement DANS la fenêtre [start, end], dédupliqués
        // par collaborateur (les plages d'un même salarié ne se chevauchent pas — anti-collision
        // appliquée à la création — mais on dédupe les dates par sécurité).
        var byEmp = new Dictionary<string, (string? name, HashSet<DateTime> days)>();
        foreach (var r in rows)
        {
            if (string.IsNullOrEmpty(r.Empcod)) continue;
            if (!byEmp.TryGetValue(r.Empcod, out var agg))
            {
                agg = (r.EmployeeName, new HashSet<DateTime>());
                byEmp[r.Empcod] = agg;
            }
            var s = r.StartDate.Date < start ? start : r.StartDate.Date;
            var e2 = r.EndDate.Date > end ? end : r.EndDate.Date;
            for (var d = s; d <= e2; d = d.AddDays(1))
                if (d.DayOfWeek != DayOfWeek.Saturday && d.DayOfWeek != DayOfWeek.Sunday)
                    agg.days.Add(d);
        }

        var result = byEmp
            .Select(kv => new TtRecapRow
            {
                Empcod = kv.Key,
                EmployeeName = kv.Value.name,
                JoursTeletravail = kv.Value.days.Count,
                MontantIndemnite = kv.Value.days.Count * indemnite,
            })
            .OrderBy(x => x.EmployeeName ?? x.Empcod)
            .ToList();

        return Ok(new { from = start, to = end, indemniteParJour = indemnite, rows = result });
    }

    /// <summary>
    /// Contrôle la politique société : délai de prévenance puis quota hebdomadaire.
    /// Retourne un message d'erreur explicite si la demande viole une règle, sinon null.
    /// Le quota est évalué par semaine ISO : pour chaque semaine touchée par la demande,
    /// jours déjà posés (Pending+Approved) + nouveaux jours ouvrés ≤ quota.
    /// </summary>
    private async Task<string?> ValidatePolicyAsync(string soccod, string empcod, DateTime start, DateTime end, CancellationToken ct)
    {
        var param = await _db.Parametres.AsNoTracking().FirstOrDefaultAsync(p => p.Soccod == soccod, ct);
        if (param == null) return null;

        var prevenance = param.Parttprevenance ?? 0;
        if (prevenance > 0 && start.Date < DateTime.UtcNow.Date.AddDays(prevenance))
            return $"Délai de prévenance non respecté : la demande doit être soumise au moins {prevenance} jour(s) avant le début.";

        var maxSem = param.Parttmaxsem ?? 0f;
        if (maxSem <= 0) return null;

        // Jours ouvrés du nouvel intervalle, regroupés par semaine ISO.
        var newByWeek = new Dictionary<string, int>();
        for (var d = start.Date; d <= end.Date; d = d.AddDays(1))
            if (d.DayOfWeek != DayOfWeek.Saturday && d.DayOfWeek != DayOfWeek.Sunday)
            {
                var k = WeekKey(d);
                newByWeek[k] = newByWeek.TryGetValue(k, out var c) ? c + 1 : 1;
            }
        if (newByWeek.Count == 0) return null;

        var rangeStart = MondayOf(start.Date);
        var rangeEnd = MondayOf(end.Date).AddDays(6);
        var existing = await _db.Teletravails.AsNoTracking()
            .Where(t => t.Empcod == empcod
                     && (t.Status == "Pending" || t.Status == "Approved")
                     && t.StartDate.Date <= rangeEnd && t.EndDate.Date >= rangeStart)
            .Select(t => new { t.StartDate, t.EndDate })
            .ToListAsync(ct);

        var existingByWeek = new Dictionary<string, int>();
        foreach (var t in existing)
            for (var d = t.StartDate.Date; d <= t.EndDate.Date; d = d.AddDays(1))
                if (d.DayOfWeek != DayOfWeek.Saturday && d.DayOfWeek != DayOfWeek.Sunday)
                {
                    var k = WeekKey(d);
                    if (newByWeek.ContainsKey(k))
                        existingByWeek[k] = existingByWeek.TryGetValue(k, out var c) ? c + 1 : 1;
                }

        foreach (var kv in newByWeek)
        {
            var total = kv.Value + (existingByWeek.TryGetValue(kv.Key, out var e) ? e : 0);
            if (total > maxSem)
                return $"Quota de télétravail dépassé : maximum {maxSem:0.#} jour(s) par semaine (semaine {kv.Key}).";
        }
        return null;
    }

    private static string WeekKey(DateTime d) => $"{ISOWeek.GetYear(d):D4}-S{ISOWeek.GetWeekOfYear(d):D2}";

    /// <summary>Lundi de la semaine contenant <paramref name="d"/> (semaine ISO, lun→dim).</summary>
    private static DateTime MondayOf(DateTime d) => d.Date.AddDays(-(((int)d.DayOfWeek + 6) % 7));

    /// <summary>Compte les jours ouvrés (lun→ven) inclusifs entre deux dates.</summary>
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
