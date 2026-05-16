using ABRPOINT.Server.Data;
using ABRPOINT.Server.Interfaces;
using ABRPOINT.Server.Services;
using ABRPOINT.Server.Tenancy;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using System.Net;
using System.Security.Cryptography;

namespace ABRPOINT.Server.Controllers;

/// <summary>
/// Endpoint public (control plane) : la page de login l'appelle avant /Utilisateurs/connect
/// pour résoudre le tenant à partir de l'email saisi. Évite de demander le code société
/// à l'utilisateur quand l'app est servie depuis le domaine racine (sans wildcard subdomain).
/// </summary>
[ApiController]
[Route("api/auth")]
[AllowAnonymous]
public class AuthLookupController : ControllerBase
{
    private readonly IDbContextFactory<MasterDbContext> _masterFactory;
    private readonly IConfiguration _cfg;
    private readonly IEmailService _emailService;
    private readonly ISuspiciousLoginTokenService _suspiciousTokens;
    private readonly ILogger<AuthLookupController> _log;

    public AuthLookupController(
        IDbContextFactory<MasterDbContext> masterFactory,
        IConfiguration cfg,
        IEmailService emailService,
        ISuspiciousLoginTokenService suspiciousTokens,
        ILogger<AuthLookupController> log)
    {
        _masterFactory = masterFactory;
        _cfg = cfg;
        _emailService = emailService;
        _suspiciousTokens = suspiciousTokens;
        _log = log;
    }

    public sealed record LookupTenantRequest(string Email);

    [HttpPost("lookup-tenant")]
    // SEC — Rate limit dédié (policy "tenant-lookup" dans Program.cs) : 30/h/IP.
    // Anti-énumération réelle = uniformité de la réponse, pas le throttling. La
    // limite est donc large pour ne pas casser l'UX (retry login, déconnexion/
    // reconnexion, NAT d'entreprise). L'ancienne limite 5/h/IP partagée avec
    // /api/contact générait des 429 spurieux après quelques tentatives légitimes.
    [EnableRateLimiting("tenant-lookup")]
    public async Task<IActionResult> LookupTenant([FromBody] LookupTenantRequest req, CancellationToken ct)
    {
        var email = (req?.Email ?? string.Empty).Trim().ToLowerInvariant();
        if (string.IsNullOrEmpty(email) || !email.Contains('@'))
            return BadRequest(new { error = "Email invalide." });

        await using var master = await _masterFactory.CreateDbContextAsync(ct);
        var entry = await master.TenantEmailIndex.AsNoTracking()
            .FirstOrDefaultAsync(x => x.Email == email, ct);
        if (entry is not null)
            return Ok(new { slug = entry.Slug });

        // Fallback : email pas (encore) indexé. Cas typique : employés/admins créés avant que
        // l'upsert TenantEmailIndex ne soit en place, ou dont l'index a échoué silencieusement.
        // On scanne les bases des tenants actifs pour retrouver l'utilisateur via Utilisateurs.Utimail
        // ou Employes.Empemail, et on backfill l'index pour les prochains logins.
        var template = _cfg.GetConnectionString("TenantTemplate");
        if (!string.IsNullOrWhiteSpace(template))
        {
            var tenants = await master.Tenants.AsNoTracking()
                .Where(t => t.Status == "Active" || t.Status == "Trialing" || t.Status == "Provisioning")
                .ToListAsync(ct);

            foreach (var t in tenants)
            {
                try
                {
                    var connStr = template.Replace("{DbName}", t.DbName);
                    var options = new DbContextOptionsBuilder<ApplicationDbContext>()
                        .UseNpgsql(connStr, npg => npg.EnableRetryOnFailure())
                        .Options;
                    await using var tdb = new ApplicationDbContext(options);

                    var found = await tdb.Utilisateurs.AsNoTracking()
                        .AnyAsync(u => u.Utimail == email, ct);
                    if (!found)
                    {
                        found = await tdb.Employes.AsNoTracking()
                            .AnyAsync(e => e.Empemail != null && e.Empemail.ToLower() == email, ct);
                    }

                    if (found)
                    {
                        // Backfill l'index pour court-circuiter le scan au prochain login.
                        var existing = await master.TenantEmailIndex
                            .FirstOrDefaultAsync(x => x.Email == email, ct);
                        if (existing == null)
                        {
                            master.TenantEmailIndex.Add(new TenantEmailIndex
                            {
                                Email = email,
                                Slug = t.Slug,
                                CreatedAt = DateTime.UtcNow,
                            });
                            await master.SaveChangesAsync(ct);
                        }
                        return Ok(new { slug = t.Slug });
                    }
                }
                catch (Exception ex)
                {
                    // Une base tenant indisponible ne doit pas faire échouer le lookup global.
                    _log.LogWarning(ex, "Scan tenant {Slug} ({DbName}) échoué pour lookup email", t.Slug, t.DbName);
                }
            }
        }

        // SEC — Réponse 200 + slug=null au lieu de 404 : ne révèle pas l'existence du
        // compte, et n'a pas de signature différente (status code, longueur) facilement
        // distinguable par un attaquant qui voudrait scanner.
        return Ok(new { slug = (string?)null });
    }

    public sealed record ForgotPasswordPublicRequest(string Email);
    public sealed record ResetPasswordPublicRequest(string Email, string Code, string NewPassword);

    /// <summary>
    /// Demande publique de réinitialisation de mot de passe : on retrouve le tenant via l'email,
    /// on génère un code à 6 chiffres, on le persiste sur l'utilisateur et on l'envoie par email.
    /// Réponse toujours 200 (réponse générique pour ne pas révéler l'existence des comptes).
    /// </summary>
    // A7 — Rate limiting recovery.
    [HttpPost("forgot-password")]
    [EnableRateLimiting("auth-recovery")]
    public async Task<IActionResult> ForgotPassword([FromBody] ForgotPasswordPublicRequest req, CancellationToken ct)
    {
        var email = (req?.Email ?? string.Empty).Trim().ToLowerInvariant();
        const string genericResponse = "Si un compte existe avec cet email, un code de réinitialisation a été envoyé.";

        if (string.IsNullOrEmpty(email) || !email.Contains('@'))
            return BadRequest(new { message = "Email invalide." });

        try
        {
            var tenantDbName = await ResolveTenantDbNameAsync(email, ct);
            if (string.IsNullOrEmpty(tenantDbName))
            {
                // Diagnostic léger : on ne révèle PAS au client mais on logge pour l'admin.
                // Sans ça, "no email received" peut signifier 3 choses (email inconnu,
                // SMTP cassé, ou user inconnu côté tenant) et l'admin ne peut pas
                // trancher sans accéder au flow back-end.
                _log.LogInformation("ForgotPassword — aucun tenant trouvé pour {Email}. Réponse générique renvoyée.", email);
                return Ok(new { message = genericResponse });
            }

            await using var tdb = CreateTenantDb(tenantDbName);
            var user = await tdb.Utilisateurs.FirstOrDefaultAsync(u => u.Utimail != null && u.Utimail.ToLower() == email, ct);
            if (user is null)
            {
                _log.LogInformation("ForgotPassword — tenant {Tenant} trouvé mais utilisateur {Email} absent de Utilisateurs. Réponse générique renvoyée.", tenantDbName, email);
                return Ok(new { message = genericResponse });
            }

            var resetCode = RandomNumberGenerator.GetInt32(100000, 1000000).ToString("D6");
            user.UtiResetCode = resetCode;
            user.UtiResetCodeExpiry = DateTime.UtcNow.AddMinutes(15);
            await tdb.SaveChangesAsync(ct);

            var displayName = string.IsNullOrWhiteSpace(user.Utiprn) ? user.Utinom ?? email : $"{user.Utiprn} {user.Utinom}";
            var safeName = System.Net.WebUtility.HtmlEncode(displayName);
            var safeCode = System.Net.WebUtility.HtmlEncode(resetCode);
            var subject = "Concorde Workforce — Code de réinitialisation";

            // Code formaté en gros avec espacements pour faciliter la lecture / copie.
            var codeBox =
                $"<div style=\"text-align:center;margin:24px 0;\">" +
                $"  <div style=\"display:inline-block;background:linear-gradient(135deg,#eff6ff 0%,#dbeafe 100%);border:1px solid #bfdbfe;border-radius:14px;padding:20px 32px;\">" +
                $"    <div style=\"font-size:11px;font-weight:700;color:#1e40af;letter-spacing:0.18em;text-transform:uppercase;margin-bottom:6px;\">Code de réinitialisation</div>" +
                $"    <div style=\"font-size:34px;font-weight:800;color:#0040a1;letter-spacing:10px;font-family:'Courier New',monospace;\">{safeCode}</div>" +
                $"  </div>" +
                $"</div>";

            var inner =
                $"<p>Bonjour <strong>{safeName}</strong>,</p>" +
                $"<p>Vous avez demandé la réinitialisation de votre mot de passe sur <strong>{Services.EmailTemplates.BrandName}</strong>.</p>" +
                codeBox +
                Services.EmailTemplates.StatusBanner(
                    "Ce code expire dans 15 minutes. Si vous n'êtes pas à l'origine de cette demande, ignorez simplement cet email.",
                    Services.EmailTemplates.StatusKind.Warning) +
                "<p style=\"margin-top:24px;\">Cordialement,<br/><strong>L'équipe Concorde Workforce</strong></p>";

            var body = Services.EmailTemplates.Wrap(
                title: "Réinitialisation de votre mot de passe",
                preview: $"Votre code à usage unique : {resetCode}",
                innerHtml: inner);

            try
            {
                await _emailService.SendEmailAsync(email, subject, body);
                _log.LogInformation("ForgotPassword — code envoyé à {Email} (tenant {Tenant}).", email, tenantDbName);
            }
            catch (Exception sendEx)
            {
                // Marquer clairement dans les logs : c'est un échec D'ENVOI (user trouvé,
                // code généré, SMTP cassé). L'admin doit corriger la config SMTP, sinon
                // tous les forgot-password échoueront silencieusement côté client.
                // `Console.WriteLine` redonde le LogError au cas où le niveau de log
                // global filtrerait — la criticité justifie le doublon.
                _log.LogError(sendEx, "ForgotPassword — code généré pour {Email} (tenant {Tenant}) mais ENVOI SMTP ÉCHOUÉ. Tester /api/admin/diagnostics/test-email pour diagnostiquer.", email, tenantDbName);
                Console.WriteLine($"[ForgotPassword] SMTP send failed for {email}: {sendEx.GetType().Name}: {sendEx.Message}");
            }
            return Ok(new { message = genericResponse });
        }
        catch (Exception ex)
        {
            _log.LogError(ex, "Échec ForgotPassword pour {Email}", email);
            // On reste générique côté client mais on log côté serveur.
            return Ok(new { message = genericResponse });
        }
    }

    // A7 — Reset = consommation du code OTP (6 chiffres). Bloquer brute-force du code reset.
    [HttpPost("reset-password")]
    [EnableRateLimiting("auth-recovery")]
    public async Task<IActionResult> ResetPassword([FromBody] ResetPasswordPublicRequest req, CancellationToken ct)
    {
        var email = (req?.Email ?? string.Empty).Trim().ToLowerInvariant();
        var code = (req?.Code ?? string.Empty).Trim();
        var newPassword = req?.NewPassword ?? string.Empty;

        if (string.IsNullOrEmpty(email) || string.IsNullOrEmpty(code) || string.IsNullOrEmpty(newPassword))
            return BadRequest(new { message = "Tous les champs sont requis." });
        if (newPassword.Length < 6)
            return BadRequest(new { message = "Le mot de passe doit contenir au moins 6 caractères." });

        try
        {
            var tenantDbName = await ResolveTenantDbNameAsync(email, ct);
            if (string.IsNullOrEmpty(tenantDbName))
                return BadRequest(new { message = "Code invalide ou expiré." });

            await using var tdb = CreateTenantDb(tenantDbName);
            var user = await tdb.Utilisateurs.FirstOrDefaultAsync(u => u.Utimail != null && u.Utimail.ToLower() == email, ct);
            if (user is null || user.UtiResetCode != code || !user.UtiResetCodeExpiry.HasValue || user.UtiResetCodeExpiry < DateTime.UtcNow)
                return BadRequest(new { message = "Code invalide ou expiré." });

            user.Utimps = BCrypt.Net.BCrypt.HashPassword(newPassword);
            user.UtiResetCode = null;
            user.UtiResetCodeExpiry = null;
            await tdb.SaveChangesAsync(ct);

            return Ok(new { message = "Mot de passe réinitialisé avec succès." });
        }
        catch (Exception ex)
        {
            _log.LogError(ex, "Échec ResetPassword pour {Email}", email);
            return StatusCode(500, new { message = "Erreur lors de la réinitialisation. Réessayez plus tard." });
        }
    }

    private async Task<string?> ResolveTenantDbNameAsync(string email, CancellationToken ct)
    {
        await using var master = await _masterFactory.CreateDbContextAsync(ct);
        var entry = await master.TenantEmailIndex.AsNoTracking()
            .FirstOrDefaultAsync(x => x.Email == email, ct);
        if (entry is not null)
        {
            var tenant = await master.Tenants.AsNoTracking()
                .FirstOrDefaultAsync(t => t.Slug == entry.Slug, ct);
            if (tenant is not null) return tenant.DbName;
        }

        var template = _cfg.GetConnectionString("TenantTemplate");
        if (string.IsNullOrWhiteSpace(template)) return null;

        var tenants = await master.Tenants.AsNoTracking()
            .Where(t => t.Status == "Active" || t.Status == "Trialing" || t.Status == "Provisioning")
            .ToListAsync(ct);

        foreach (var t in tenants)
        {
            try
            {
                await using var tdb = CreateTenantDb(t.DbName);
                var found = await tdb.Utilisateurs.AsNoTracking()
                    .AnyAsync(u => u.Utimail != null && u.Utimail.ToLower() == email, ct);
                if (found) return t.DbName;
            }
            catch (Exception ex)
            {
                _log.LogWarning(ex, "Scan tenant {Slug} ({DbName}) échoué pour reset password", t.Slug, t.DbName);
            }
        }
        return null;
    }

    private ApplicationDbContext CreateTenantDb(string dbName)
    {
        var template = _cfg.GetConnectionString("TenantTemplate")
            ?? throw new InvalidOperationException("TenantTemplate connection string manquante.");
        var connStr = template.Replace("{DbName}", dbName);
        var options = new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseNpgsql(connStr, npg => npg.EnableRetryOnFailure())
            .Options;
        return new ApplicationDbContext(options);
    }

    /// <summary>
    /// Endpoint cliqué depuis l'email d'alerte "Ce n'était pas moi". GET car invoqué
    /// par un mail client (lien) — c'est un trade-off conscient sur la convention REST :
    /// l'utilisateur arrivant ici via le mail n'a pas de session active, donc on ne peut
    /// pas exiger un POST CSRF-safe. La protection vient de la signature HMAC du token
    /// (Jwt:Key) + single-use anti-replay via IMemoryCache + TTL 7 jours.
    ///
    /// Actions effectuées :
    ///   1) Révoque TOUS les refresh tokens de l'utilisateur (kick toutes les sessions actives).
    ///   2) Réinitialise le compteur d'échecs de login (pour éviter qu'un user légitime soit
    ///      bloqué après avoir révoqué l'attaquant).
    ///   3) Génère un code de reset à 6 chiffres et envoie un email de récupération.
    ///   4) Affiche une page HTML de confirmation.
    /// </summary>
    [HttpGet("revoke-suspicious-login")]
    [EnableRateLimiting("auth-recovery")]
    public async Task<IActionResult> RevokeSuspiciousLogin([FromQuery] string? t, [FromQuery] string? slug, CancellationToken ct)
    {
        // Validation token. On retourne TOUJOURS une page HTML pour ne pas casser
        // l'expérience email (l'utilisateur a cliqué depuis sa boîte mail, il ne devrait
        // jamais voir un JSON brut). Les cas d'erreur sont volontairement génériques
        // pour ne pas donner d'info utile à un attaquant qui forgerait des tokens.
        if (!_suspiciousTokens.TryValidate(t, out var tokenSlug, out var uticod))
            return RenderHtmlPage("Lien invalide ou expiré",
                "Ce lien de révocation n'est pas valide. Il a peut-être déjà été utilisé, ou il a expiré (validité 7 jours).",
                isError: true);

        // Le slug fourni en query string DOIT correspondre à celui signé dans le token —
        // empêche un attaquant qui aurait un token valide pour le tenant A de viser le tenant B.
        if (!string.Equals(tokenSlug, (slug ?? string.Empty).Trim(), StringComparison.OrdinalIgnoreCase))
            return RenderHtmlPage("Lien invalide ou expiré",
                "Ce lien de révocation n'est pas valide.",
                isError: true);

        await using var master = await _masterFactory.CreateDbContextAsync(ct);
        var tenant = await master.Tenants.AsNoTracking().FirstOrDefaultAsync(t2 => t2.Slug == tokenSlug, ct);
        if (tenant == null || string.IsNullOrEmpty(tenant.DbName))
            return RenderHtmlPage("Tenant introuvable",
                "Le compte associé à ce lien n'existe plus.",
                isError: true);

        try
        {
            await using var tdb = CreateTenantDb(tenant.DbName);

            // 1) Révoque tous les refresh tokens. ExecuteUpdateAsync = un seul UPDATE ciblé.
            var revoked = await tdb.RefreshTokens
                .Where(r => r.Uticod == uticod && !r.Revoked)
                .ExecuteUpdateAsync(s => s.SetProperty(r => r.Revoked, true), ct);

            // 2) Charge l'utilisateur pour les opérations suivantes (compteur + code reset).
            var user = await tdb.Utilisateurs.FirstOrDefaultAsync(u => u.Uticod == uticod, ct);
            if (user == null)
            {
                // Cas dégénéré : utilisateur supprimé entre-temps. On a déjà révoqué les
                // tokens, on signale OK à l'utilisateur final.
                _suspiciousTokens.MarkConsumed(t!);
                return RenderHtmlPage("Sessions révoquées",
                    $"{revoked} session(s) ont été déconnectées. Veuillez contacter le support pour la suite.",
                    isError: false);
            }

            // 3) Reset compteur de lockout (l'attaquant peut avoir saturé le compte, on
            //    nettoie pour que l'utilisateur légitime puisse se reconnecter).
            user.UtiFailedLogins = 0;
            user.UtiLockoutUntil = null;

            // 4) Génère un code de reset 6 chiffres, expiration 30 min. Email envoyé séparément
            //    pour donner les étapes : code reçu = preuve que la boîte mail est sous contrôle.
            var resetCode = RandomNumberGenerator.GetInt32(0, 1_000_000).ToString("D6");
            user.UtiResetCode = resetCode;
            user.UtiResetCodeExpiry = DateTime.UtcNow.AddMinutes(30);
            await tdb.SaveChangesAsync(ct);

            // 5) Email de récupération avec le code. On utilise l'email persisté en base
            //    (pas celui d'un payload non-signé) → un attaquant qui forge un token ne
            //    peut pas rediriger l'email vers sa propre boîte.
            if (!string.IsNullOrWhiteSpace(user.Utimail))
            {
                _ = SendRecoveryEmailAsync(user.Utimail!, resetCode);
            }

            // 6) Marque le token comme consommé pour empêcher la réutilisation.
            _suspiciousTokens.MarkConsumed(t!);

            _log.LogInformation("Révocation suspicious-login : tenant={Slug} uticod={Uticod} sessions_revoked={Count}",
                tokenSlug, uticod, revoked);

            return RenderHtmlPage("Sessions déconnectées",
                $"<p>{revoked} session(s) active(s) ont été déconnectées immédiatement.</p>" +
                "<p>Un email de récupération avec un code à 6 chiffres vient de vous être envoyé. Utilisez-le pour réinitialiser votre mot de passe et reprendre le contrôle de votre compte.</p>" +
                "<p>Si vous activez l'authentification à deux facteurs (2FA) après reconnexion, vous serez encore mieux protégé contre les futures tentatives.</p>",
                isError: false);
        }
        catch (Exception ex)
        {
            _log.LogError(ex, "Échec révocation suspicious-login pour tenant={Slug} uticod={Uticod}", tokenSlug, uticod);
            return RenderHtmlPage("Erreur",
                "Une erreur est survenue. Réessayez dans quelques minutes ou contactez le support.",
                isError: true);
        }
    }

    private async Task SendRecoveryEmailAsync(string toEmail, string code)
    {
        try
        {
            var subject = "🔑 Récupération de votre compte Concorde Workforce";
            var body = $@"
<html><body style=""font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #0f172a; max-width: 560px; margin: 0 auto; padding: 24px;"">
  <h2 style=""color: #0040a1; margin: 0 0 16px;"">Réinitialisation de mot de passe</h2>
  <p>Vos sessions actives ont été déconnectées suite à votre signalement d'une connexion suspecte.</p>
  <p>Utilisez le code suivant sur l'écran ""Mot de passe oublié"" pour définir un nouveau mot de passe :</p>
  <div style=""background: #f8fafc; border: 2px dashed #0040a1; border-radius: 8px; padding: 20px; margin: 20px 0; text-align: center; font-family: 'Courier New', monospace; font-size: 32px; font-weight: 800; letter-spacing: 8px; color: #0040a1;"">
    {WebUtility.HtmlEncode(code)}
  </div>
  <p style=""font-size: 13px; color: #64748b;"">Ce code expire dans 30 minutes. Si vous n'avez pas demandé cette récupération, ignorez ce message et contactez le support.</p>
</body></html>";
            await _emailService.SendEmailAsync(toEmail, subject, body);
        }
        catch (Exception ex)
        {
            _log.LogWarning(ex, "Envoi email récupération à {Email} a échoué.", toEmail);
        }
    }

    /// <summary>
    /// Construit une page HTML standalone pour l'utilisateur qui arrive depuis son client mail.
    /// Volontairement minimaliste — pas de dépendance frontend, pas de JS, charge instantanément.
    /// </summary>
    private ContentResult RenderHtmlPage(string title, string bodyHtml, bool isError)
    {
        var color = isError ? "#dc2626" : "#15803d";
        var icon = isError ? "⚠" : "✓";
        var html = $@"<!doctype html>
<html lang=""fr""><head>
  <meta charset=""UTF-8"" />
  <meta name=""viewport"" content=""width=device-width, initial-scale=1"" />
  <title>{WebUtility.HtmlEncode(title)} — Concorde Workforce</title>
</head>
<body style=""font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f7f9fb; margin: 0; padding: 48px 16px; color: #0f172a;"">
  <div style=""max-width: 540px; margin: 0 auto; background: #fff; border-radius: 16px; padding: 40px; box-shadow: 0 4px 24px rgba(15, 23, 42, 0.08); border: 1px solid #e2e8f0;"">
    <div style=""font-size: 48px; color: {color}; text-align: center; margin-bottom: 16px;"">{icon}</div>
    <h1 style=""text-align: center; font-size: 22px; margin: 0 0 24px; color: #0f172a;"">{WebUtility.HtmlEncode(title)}</h1>
    <div style=""font-size: 15px; line-height: 1.6; color: #334155;"">{bodyHtml}</div>
    <hr style=""border: none; border-top: 1px solid #e2e8f0; margin: 32px 0 16px;"" />
    <p style=""text-align: center; font-size: 12px; color: #94a3b8; margin: 0;"">Concorde Workforce — Vous pouvez fermer cette fenêtre.</p>
  </div>
</body></html>";
        return new ContentResult { Content = html, ContentType = "text/html; charset=utf-8", StatusCode = 200 };
    }
}
