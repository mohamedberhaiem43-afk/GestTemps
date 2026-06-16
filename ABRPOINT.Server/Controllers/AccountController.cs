using ABRPOINT.Server.Data;
using ABRPOINT.Server.Interfaces;
using ABRPOINT.Server.Tenancy;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;
using System.Security.Cryptography;

namespace ABRPOINT.Server.Controllers
{
    /// <summary>
    /// Compte utilisateur — actions self-service. Aujourd'hui : suppression de compte
    /// (exigence Google Play « Data deletion » + RGPD droit à l'effacement).
    ///
    /// Flux SÉCURISÉ en 2 étapes (preuve de maîtrise de l'email) :
    ///   1. POST request-deletion  → génère un code 6 chiffres, l'envoie par email à
    ///      l'utilisateur. Aucune demande n'est encore transmise.
    ///   2. POST confirm-deletion  → l'utilisateur saisit le code ; s'il est valide,
    ///      on notifie le support ET l'admin du tenant (= demande effective).
    ///
    /// Pourquoi une DEMANDE et non un hard-delete immédiat : Concorde Workly est un
    /// service RH B2B. Les données d'un salarié sont aussi les registres légaux de son
    /// employeur (paie, pointage, contrats) à conserver pour la durée légale. Le support
    /// révoque l'accès puis supprime / anonymise selon la politique de rétention du
    /// tenant (cf. RetentionPolicyController). La page publique /suppression-compte
    /// documente la procédure et les durées.
    /// </summary>
    [ApiController]
    [Route("api/account")]
    [Authorize]
    public class AccountController : ControllerBase
    {
        // Boîte support / DPO — même destinataire que ContactController.
        private const string SupportInbox = "postmaster@concorde-work-force.com";
        private const int CodeTtlMinutes = 15;
        private const int MaxConfirmAttempts = 5;

        private readonly ApplicationDbContext _db;
        private readonly IEmailService _email;
        private readonly ICurrentTenant _currentTenant;
        private readonly ILogger<AccountController> _log;

        public AccountController(
            ApplicationDbContext db,
            IEmailService email,
            ICurrentTenant currentTenant,
            ILogger<AccountController> log)
        {
            _db = db;
            _email = email;
            _currentTenant = currentTenant;
            _log = log;
        }

        public sealed class ConfirmDeletionRequest
        {
            public string? Code { get; set; }
            /// <summary>Motif libre optionnel.</summary>
            public string? Reason { get; set; }
        }

        // ── Étape 1 : demande → envoi du code par email à l'utilisateur ──────────
        // POST api/account/request-deletion
        [HttpPost("request-deletion")]
        [EnableRateLimiting("public-form")]
        public async Task<IActionResult> RequestDeletion()
        {
            var uticod = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (string.IsNullOrEmpty(uticod))
                return Unauthorized(new { message = "Session invalide." });

            var user = await _db.Utilisateurs.FirstOrDefaultAsync(u => u.Uticod == uticod);
            if (user == null)
                return NotFound(new { message = "Utilisateur introuvable." });

            if (string.IsNullOrWhiteSpace(user.Utimail))
                return BadRequest(new
                {
                    message = $"Aucune adresse email n'est associée à votre compte. Écrivez à {SupportInbox} (objet : « Suppression de compte »).",
                });

            // Génère un code 6 chiffres, le stocke BCrypt-hashé (jamais en clair) avec
            // expiry court + compteur de tentatives remis à zéro.
            var code = RandomNumberGenerator.GetInt32(100000, 1000000).ToString("D6");
            user.UtiDelOtpCode = BCrypt.Net.BCrypt.HashPassword(code);
            user.UtiDelOtpExpiry = DateTime.UtcNow.AddMinutes(CodeTtlMinutes);
            user.UtiDelOtpAttempts = 0;
            await _db.SaveChangesAsync();

            var displayName = string.IsNullOrWhiteSpace(user.Utiprn) ? (user.Utinom ?? user.Utimail) : $"{user.Utiprn} {user.Utinom}";
            var safeName = System.Net.WebUtility.HtmlEncode(displayName);
            var safeCode = System.Net.WebUtility.HtmlEncode(code);

            var codeBox =
                "<div style=\"text-align:center;margin:24px 0;\">" +
                "  <div style=\"display:inline-block;background:linear-gradient(135deg,#fef2f2 0%,#fee2e2 100%);border:1px solid #fecaca;border-radius:14px;padding:20px 32px;\">" +
                "    <div style=\"font-size:11px;font-weight:700;color:#b91c1c;letter-spacing:0.18em;text-transform:uppercase;margin-bottom:6px;\">Code de confirmation</div>" +
                $"    <div style=\"font-size:34px;font-weight:800;color:#dc2626;letter-spacing:10px;font-family:'Courier New',monospace;\">{safeCode}</div>" +
                "  </div>" +
                "</div>";

            var inner =
                $"<p>Bonjour <strong>{safeName}</strong>,</p>" +
                $"<p>Vous avez demandé la <strong>suppression de votre compte</strong> sur <strong>{Services.EmailTemplates.BrandName}</strong>. " +
                "Saisissez ce code dans l'application pour confirmer votre demande :</p>" +
                codeBox +
                Services.EmailTemplates.StatusBanner(
                    $"Ce code expire dans {CodeTtlMinutes} minutes. Si vous n'êtes pas à l'origine de cette demande, ignorez cet email : aucun changement ne sera effectué.",
                    Services.EmailTemplates.StatusKind.Warning) +
                "<p style=\"margin-top:24px;\">Cordialement,<br/><strong>L'équipe Concorde Workforce</strong></p>";

            var body = Services.EmailTemplates.Wrap(
                title: "Confirmation de suppression de compte",
                preview: $"Votre code de confirmation : {code}",
                innerHtml: inner);

            try
            {
                await _email.SendEmailAsync(user.Utimail!, "Concorde Workforce — Code de suppression de compte", body);
            }
            catch (Exception ex)
            {
                _log.LogError(ex, "Échec envoi code de suppression à {Email} (uticod={Uticod})", user.Utimail, uticod);
                return StatusCode(502, new { message = $"L'envoi du code a échoué. Réessayez ou écrivez à {SupportInbox}." });
            }

            _log.LogInformation("Code de suppression de compte envoyé pour uticod={Uticod}", uticod);
            return Ok(new
            {
                message = "Un code de confirmation a été envoyé à votre adresse email.",
                email = MaskEmail(user.Utimail!),
                ttlMinutes = CodeTtlMinutes,
            });
        }

        // ── Étape 2 : confirmation par code → notification support + admin ───────
        // POST api/account/confirm-deletion
        [HttpPost("confirm-deletion")]
        [EnableRateLimiting("public-form")]
        public async Task<IActionResult> ConfirmDeletion([FromBody] ConfirmDeletionRequest? body)
        {
            var uticod = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (string.IsNullOrEmpty(uticod))
                return Unauthorized(new { message = "Session invalide." });

            var code = (body?.Code ?? string.Empty).Trim();
            if (code.Length == 0)
                return BadRequest(new { message = "Code requis." });

            var user = await _db.Utilisateurs.FirstOrDefaultAsync(u => u.Uticod == uticod);
            if (user == null)
                return NotFound(new { message = "Utilisateur introuvable." });

            if (string.IsNullOrEmpty(user.UtiDelOtpCode) || user.UtiDelOtpExpiry == null)
                return BadRequest(new { message = "Aucune demande en cours. Recommencez la procédure." });

            if (user.UtiDelOtpExpiry < DateTime.UtcNow)
            {
                user.UtiDelOtpCode = null;
                user.UtiDelOtpExpiry = null;
                await _db.SaveChangesAsync();
                return BadRequest(new { message = "Le code a expiré. Recommencez la procédure.", code = "code_expired" });
            }

            if ((user.UtiDelOtpAttempts ?? 0) >= MaxConfirmAttempts)
            {
                user.UtiDelOtpCode = null;
                user.UtiDelOtpExpiry = null;
                await _db.SaveChangesAsync();
                return BadRequest(new { message = "Trop de tentatives. Recommencez la procédure.", code = "too_many_attempts" });
            }

            if (!BCrypt.Net.BCrypt.Verify(code, user.UtiDelOtpCode))
            {
                user.UtiDelOtpAttempts = (user.UtiDelOtpAttempts ?? 0) + 1;
                await _db.SaveChangesAsync();
                var remaining = Math.Max(0, MaxConfirmAttempts - (user.UtiDelOtpAttempts ?? 0));
                return BadRequest(new { message = $"Code invalide. Tentatives restantes : {remaining}.", remaining });
            }

            // Code valide → on consomme l'OTP puis on transmet la demande effective.
            user.UtiDelOtpCode = null;
            user.UtiDelOtpExpiry = null;
            user.UtiDelOtpAttempts = 0;
            await _db.SaveChangesAsync();

            var soccod = await _db.Socusers.AsNoTracking()
                .Where(s => s.Uticod == uticod)
                .Select(s => s.Soccod)
                .FirstOrDefaultAsync();

            string? soclib = null;
            if (!string.IsNullOrEmpty(soccod))
            {
                soclib = await _db.Societes.AsNoTracking()
                    .Where(s => s.Soccod == soccod)
                    .Select(s => s.Soclib)
                    .FirstOrDefaultAsync();
            }

            var adminEmails = new List<string>();
            if (!string.IsNullOrEmpty(soccod))
            {
                adminEmails = await (
                    from su in _db.Socusers.AsNoTracking()
                    join u in _db.Utilisateurs.AsNoTracking() on su.Uticod equals u.Uticod
                    where su.Soccod == soccod && u.Utiadm == "1"
                          && u.Utimail != null && u.Utimail != ""
                          && u.Uticod != uticod
                    select u.Utimail!
                ).Distinct().ToListAsync();
            }

            var fullName = $"{user.Utiprn} {user.Utinom}".Trim();
            var slug = _currentTenant.Current?.Slug;
            var reason = (body?.Reason ?? string.Empty).Trim();
            var safeReason = System.Net.WebUtility.HtmlEncode(reason).Replace("\n", "<br/>");

            var subject = $"[RGPD] Demande de suppression de compte CONFIRMÉE — {fullName} ({soclib ?? soccod ?? "?"})";
            var bodyHtml =
                "<p>Une demande de <strong>suppression de compte</strong> a été <strong>confirmée par code email</strong> depuis l'application.</p>" +
                "<ul>" +
                $"<li><strong>Utilisateur :</strong> {System.Net.WebUtility.HtmlEncode(fullName)}</li>" +
                $"<li><strong>Identifiant (uticod) :</strong> {System.Net.WebUtility.HtmlEncode(uticod)}</li>" +
                $"<li><strong>Email :</strong> {System.Net.WebUtility.HtmlEncode(user.Utimail ?? "—")}</li>" +
                $"<li><strong>Société :</strong> {System.Net.WebUtility.HtmlEncode(soclib ?? "—")} ({System.Net.WebUtility.HtmlEncode(soccod ?? "—")})</li>" +
                (string.IsNullOrEmpty(slug) ? "" : $"<li><strong>Tenant :</strong> {System.Net.WebUtility.HtmlEncode(slug)}</li>") +
                (reason.Length == 0 ? "" : $"<li><strong>Motif :</strong> {safeReason}</li>") +
                "</ul>" +
                "<p>Action attendue : révoquer l'accès, puis supprimer / anonymiser les données " +
                "personnelles selon la politique de rétention du tenant. Confirmer à l'utilisateur " +
                "par email une fois traité (délai max. 30 jours).</p>";

            // Support (garanti) — si l'envoi échoue, on remonte une erreur claire.
            try
            {
                await _email.SendEmailAsync(SupportInbox, subject, bodyHtml);
            }
            catch (Exception ex)
            {
                _log.LogError(ex, "Échec envoi email demande de suppression (support) pour uticod={Uticod}", uticod);
                return StatusCode(502, new
                {
                    message = $"La demande n'a pas pu être transmise. Merci d'écrire à {SupportInbox} (objet : « Suppression de compte »)."
                });
            }

            // Admins du tenant (best-effort) : informés à l'étape de confirmation.
            foreach (var adminEmail in adminEmails)
            {
                try { await _email.SendEmailAsync(adminEmail, subject, bodyHtml); }
                catch (Exception ex) { _log.LogWarning(ex, "Échec notification admin {Email} (suppression compte)", adminEmail); }
            }

            _log.LogInformation("Demande de suppression CONFIRMÉE pour uticod={Uticod} (soccod={Soccod})", uticod, soccod);
            return Ok(new
            {
                message = "Votre demande de suppression a été confirmée. Elle sera traitée sous 30 jours et vous recevrez une confirmation par email.",
                supportEmail = SupportInbox,
            });
        }

        // Masque l'email pour l'afficher côté client sans le révéler entièrement
        // (ex. "ja***@gmail.com").
        private static string MaskEmail(string email)
        {
            var at = email.IndexOf('@');
            if (at <= 0) return "***";
            var local = email.Substring(0, at);
            var domain = email.Substring(at);
            var keep = local.Length <= 2 ? local.Substring(0, 1) : local.Substring(0, 2);
            return $"{keep}***{domain}";
        }
    }
}
