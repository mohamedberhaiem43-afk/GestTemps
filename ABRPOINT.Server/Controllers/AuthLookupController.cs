using ABRPOINT.Server.Data;
using ABRPOINT.Server.Interfaces;
using ABRPOINT.Server.Tenancy;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
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
    private readonly ILogger<AuthLookupController> _log;

    public AuthLookupController(
        IDbContextFactory<MasterDbContext> masterFactory,
        IConfiguration cfg,
        IEmailService emailService,
        ILogger<AuthLookupController> log)
    {
        _masterFactory = masterFactory;
        _cfg = cfg;
        _emailService = emailService;
        _log = log;
    }

    public sealed record LookupTenantRequest(string Email);

    [HttpPost("lookup-tenant")]
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
        if (string.IsNullOrWhiteSpace(template))
            return NotFound(new { error = "Aucun compte trouvé pour cet email." });

        var tenants = await master.Tenants.AsNoTracking()
            .Where(t => t.Status == "Active" || t.Status == "Trialing" || t.Status == "Provisioning")
            .ToListAsync(ct);

        foreach (var t in tenants)
        {
            try
            {
                var connStr = template.Replace("{DbName}", t.DbName);
                var options = new DbContextOptionsBuilder<ApplicationDbContext>()
                    .UseSqlServer(connStr, sql => sql.EnableRetryOnFailure())
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

        return NotFound(new { error = "Aucun compte trouvé pour cet email." });
    }

    public sealed record ForgotPasswordPublicRequest(string Email);
    public sealed record ResetPasswordPublicRequest(string Email, string Code, string NewPassword);

    /// <summary>
    /// Demande publique de réinitialisation de mot de passe : on retrouve le tenant via l'email,
    /// on génère un code à 6 chiffres, on le persiste sur l'utilisateur et on l'envoie par email.
    /// Réponse toujours 200 (réponse générique pour ne pas révéler l'existence des comptes).
    /// </summary>
    [HttpPost("forgot-password")]
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
                return Ok(new { message = genericResponse });

            await using var tdb = CreateTenantDb(tenantDbName);
            var user = await tdb.Utilisateurs.FirstOrDefaultAsync(u => u.Utimail != null && u.Utimail.ToLower() == email, ct);
            if (user is null)
                return Ok(new { message = genericResponse });

            var resetCode = RandomNumberGenerator.GetInt32(100000, 1000000).ToString("D6");
            user.UtiResetCode = resetCode;
            user.UtiResetCodeExpiry = DateTime.UtcNow.AddMinutes(15);
            await tdb.SaveChangesAsync(ct);

            var safeName = System.Net.WebUtility.HtmlEncode(string.IsNullOrWhiteSpace(user.Utiprn) ? user.Utinom ?? email : $"{user.Utiprn} {user.Utinom}");
            var safeCode = System.Net.WebUtility.HtmlEncode(resetCode);
            var subject = "GestTemps — Code de réinitialisation de votre mot de passe";
            var body =
                $"<p>Bonjour {safeName},</p>" +
                "<p>Vous avez demandé la réinitialisation de votre mot de passe sur <strong>GestTemps</strong>.</p>" +
                $"<p>Votre code de réinitialisation est : <strong style=\"font-size:20px;letter-spacing:4px\">{safeCode}</strong></p>" +
                "<p>Ce code est valable 15 minutes. Si vous n'êtes pas à l'origine de cette demande, ignorez cet email.</p>" +
                "<p>Cordialement,<br/>L'équipe GestTemps</p>";

            await _emailService.SendEmailAsync(email, subject, body);
            return Ok(new { message = genericResponse });
        }
        catch (Exception ex)
        {
            _log.LogError(ex, "Échec ForgotPassword pour {Email}", email);
            // On reste générique côté client mais on log côté serveur.
            return Ok(new { message = genericResponse });
        }
    }

    [HttpPost("reset-password")]
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
            .UseSqlServer(connStr, sql => sql.EnableRetryOnFailure())
            .Options;
        return new ApplicationDbContext(options);
    }
}
