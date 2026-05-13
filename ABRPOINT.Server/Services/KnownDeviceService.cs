using System.Net;
using System.Security.Cryptography;
using System.Text;
using ABRPOINT.Server.Data;
using ABRPOINT.Server.Interfaces;
using ABRPOINT.Server.Models;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;

namespace ABRPOINT.Server.Services;

/// <summary>
/// Détection de connexion depuis un nouvel appareil/réseau et alerte email. Compare
/// l'empreinte (hash UA + préfixe IP) de la requête courante à <c>known_devices</c> ;
/// si inconnue, persiste la ligne et envoie un email à l'utilisateur.
///
/// Stratégie défensive : best-effort fire-and-forget. Une panne SMTP ou une erreur de
/// résolution ne doit JAMAIS bloquer le login — d'où le try/catch global + log seul.
/// </summary>
public interface IKnownDeviceService
{
    /// <summary>
    /// À appeler après un BCrypt verify réussi. Vrai si l'empreinte a été ajoutée à la
    /// table (premier login depuis ce contexte) — l'appelant n'a pas besoin de cette
    /// info pour son flow, c'est uniquement pour tests/debug.
    /// </summary>
    Task<bool> RegisterAndAlertAsync(string uticod, string? email, HttpContext httpContext, CancellationToken ct);
}

public sealed class KnownDeviceService : IKnownDeviceService
{
    private readonly Tenancy.ITenantDbContextFactory _dbFactory;
    private readonly IEmailService _email;
    private readonly ISuspiciousLoginTokenService _tokens;
    private readonly Tenancy.ICurrentTenant _currentTenant;
    private readonly IConfiguration _cfg;
    private readonly ILogger<KnownDeviceService> _log;

    public KnownDeviceService(
        Tenancy.ITenantDbContextFactory dbFactory,
        IEmailService email,
        ISuspiciousLoginTokenService tokens,
        Tenancy.ICurrentTenant currentTenant,
        IConfiguration cfg,
        ILogger<KnownDeviceService> log)
    {
        // On prend un TenantDbContextFactory plutôt que l'ApplicationDbContext scoped. Raison :
        // CompleteLoginSequence appelle ce service en fire-and-forget (`_ = RegisterAndAlertAsync(...)`)
        // pour ne pas bloquer la réponse de login sur la création de l'empreinte / envoi mail.
        // Si on partageait le DbContext de la requête HTTP, on aurait deux scénarios cassés :
        //   1) Race : le contrôleur fait `await _dbContext.Societes...` en parallèle de notre
        //      `await _db.KnownDevices...` → "A second operation was started on this context"
        //      → 500 sur la réponse du contrôleur (bug observé en prod 2026-05-13).
        //   2) Dispose : si le contrôleur termine avant nous, le scope est disposé, notre
        //      continuation tape un ApplicationDbContext disposé → ObjectDisposedException.
        // Avec ce factory on crée un DbContext dédié, connecté à la base du tenant courant,
        // dont le cycle de vie est entièrement piloté par notre `await using`.
        _dbFactory = dbFactory;
        _email = email;
        _tokens = tokens;
        _currentTenant = currentTenant;
        _cfg = cfg;
        _log = log;
    }

    public async Task<bool> RegisterAndAlertAsync(string uticod, string? email, HttpContext httpContext, CancellationToken ct)
    {
        // Snapshot des données HTTP MAINTENANT (la requête peut se terminer pendant qu'on
        // travaille en fire-and-forget — accéder à httpContext après serait risqué).
        string userAgent;
        string ip;
        try
        {
            userAgent = httpContext.Request.Headers.UserAgent.ToString();
            ip = ResolveClientIp(httpContext);
        }
        catch
        {
            return false;
        }

        try
        {
            var uaHash = HashUa(userAgent);
            var ipPrefix = TruncateIp(ip);

            // Empreinte vide (cas dégénéré : header absent) → on ne crée pas de ligne
            // sentinelle "tout-vide" qui matcherait toute requête sans header.
            if (string.IsNullOrEmpty(uaHash) || string.IsNullOrEmpty(ipPrefix))
                return false;

            // DbContext dédié à cette opération (cf. constructeur pour le pourquoi).
            await using var db = _dbFactory.Create();

            var existing = await db.KnownDevices
                .FirstOrDefaultAsync(d => d.Uticod == uticod && d.UaHash == uaHash && d.IpPrefix == ipPrefix, ct);

            if (existing != null)
            {
                // Appareil déjà connu : on rafraîchit juste last_seen_at — sert au debug
                // ("dernière connexion depuis ce device") sans déclencher d'alerte.
                existing.LastSeenAt = DateTime.UtcNow;
                await db.SaveChangesAsync(ct);
                return false;
            }

            // Empreinte inconnue → c'est soit le 1er login (utilisateur n'a aucun device
            // enregistré), soit un vrai nouveau contexte. On distingue les deux pour ne
            // pas envoyer une alerte lors du tout 1er login (faux positif sécurité).
            var isFirstEverLogin = !await db.KnownDevices.AnyAsync(d => d.Uticod == uticod, ct);

            var label = BuildDeviceLabel(userAgent, ip);
            db.KnownDevices.Add(new KnownDevice
            {
                Uticod = uticod,
                UaHash = uaHash,
                IpPrefix = ipPrefix,
                DeviceLabel = label,
                FirstSeenAt = DateTime.UtcNow,
                LastSeenAt = DateTime.UtcNow,
            });
            await db.SaveChangesAsync(ct);

            if (!isFirstEverLogin && !string.IsNullOrEmpty(email))
            {
                // Fire-and-forget : on ne bloque pas la réponse de login sur l'envoi SMTP.
                // EmailService n'utilise ni le contexte HTTP ni le DbContext — il a son
                // propre SmtpClient, donc safe à appeler hors scope HTTP.
                var slug = _currentTenant.Current?.Slug ?? string.Empty;
                var revokeToken = !string.IsNullOrEmpty(slug) ? _tokens.Generate(slug, uticod) : null;
                _ = SendAlertAsync(email, label, ip, slug, revokeToken);
            }

            return true;
        }
        catch (Exception ex)
        {
            _log.LogWarning(ex, "KnownDeviceService a échoué pour uticod={Uticod} — login non bloqué.", uticod);
            return false;
        }
    }

    private async Task SendAlertAsync(string email, string deviceLabel, string ip, string slug, string? revokeToken)
    {
        try
        {
            var subject = "🔒 Nouvelle connexion à votre compte Concorde Workforce";
            var when = DateTime.Now.ToString("dddd d MMMM yyyy 'à' HH:mm", new System.Globalization.CultureInfo("fr-FR"));

            // URL "Ce n'était pas moi" : prefix configurable (`Hosting:PublicBaseUrl`) car
            // l'app peut être déployée derrière un reverse-proxy avec un domaine différent
            // de celui vu côté serveur (Host header), surtout en dev / Docker. Fallback :
            // construction depuis le slug + RootDomain (prod multi-tenant).
            string? revokeUrl = null;
            if (!string.IsNullOrEmpty(revokeToken) && !string.IsNullOrEmpty(slug))
            {
                var publicBase = _cfg["Hosting:PublicBaseUrl"];
                var rootDomain = _cfg["Hosting:RootDomain"];
                if (!string.IsNullOrWhiteSpace(publicBase))
                {
                    revokeUrl = $"{publicBase.TrimEnd('/')}/api/auth/revoke-suspicious-login?slug={WebUtility.UrlEncode(slug)}&t={WebUtility.UrlEncode(revokeToken)}";
                }
                else if (!string.IsNullOrWhiteSpace(rootDomain))
                {
                    revokeUrl = $"https://{slug}.{rootDomain}/api/auth/revoke-suspicious-login?slug={WebUtility.UrlEncode(slug)}&t={WebUtility.UrlEncode(revokeToken)}";
                }
            }

            // Bouton CTA construit conditionnellement : on n'affiche le bouton "Ce n'était pas
            // moi" que si on a pu construire une URL absolue valide — sinon l'email tomberait
            // sur un lien cassé qui sape la confiance utilisateur.
            var revokeButton = revokeUrl is null ? string.Empty : $@"
  <div style=""margin: 24px 0; text-align: center;"">
    <a href=""{WebUtility.HtmlEncode(revokeUrl)}"" style=""display: inline-block; background: #dc2626; color: #fff; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: 700; font-size: 14px;"">⚠ Ce n'était pas moi — révoquer maintenant</a>
    <p style=""font-size: 11px; color: #64748b; margin-top: 8px;"">Ce lien expire dans 7 jours.</p>
  </div>";

            var body = $@"
<html><body style=""font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #0f172a; max-width: 560px; margin: 0 auto; padding: 24px;"">
  <h2 style=""color: #0040a1; margin: 0 0 16px;"">Nouvelle connexion détectée</h2>
  <p>Bonjour,</p>
  <p>Une connexion à votre compte <strong>Concorde Workforce</strong> vient d'être effectuée depuis un appareil ou un réseau que nous n'avions pas encore vu.</p>
  <div style=""background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; margin: 20px 0;"">
    <p style=""margin: 0 0 8px;""><strong>Appareil :</strong> {WebUtility.HtmlEncode(deviceLabel)}</p>
    <p style=""margin: 0 0 8px;""><strong>Adresse IP :</strong> {WebUtility.HtmlEncode(ip)}</p>
    <p style=""margin: 0;""><strong>Date :</strong> {WebUtility.HtmlEncode(when)} (heure de Paris)</p>
  </div>
  <p><strong>Vous reconnaissez cette connexion ?</strong> Aucune action nécessaire — vous recevrez ce message uniquement la première fois qu'un appareil ou réseau est utilisé.</p>
  <p><strong>Vous ne reconnaissez pas cette connexion ?</strong> Cliquez sur le bouton ci-dessous pour déconnecter immédiatement toutes les sessions actives et recevoir un email de réinitialisation de mot de passe.</p>
  {revokeButton}
  <hr style=""border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;"" />
  <p style=""font-size: 12px; color: #64748b;"">Cet email a été envoyé automatiquement par Concorde Workforce. Pour préserver votre vie privée, l'adresse IP et l'appareil sont anonymisés en base (préfixe réseau et empreinte de navigateur uniquement).</p>
</body></html>";
            await _email.SendEmailAsync(email, subject, body);
        }
        catch (Exception ex)
        {
            _log.LogWarning(ex, "Envoi alerte nouvelle-connexion à {Email} a échoué.", email);
        }
    }

    /// <summary>
    /// Résout l'IP cliente réelle. Priorité au header `X-Forwarded-For` (premier IP de la
    /// chaîne) car l'app tourne derrière nginx/Cloudflare en prod ; fallback sur RemoteIpAddress.
    /// </summary>
    private static string ResolveClientIp(HttpContext ctx)
    {
        var xff = ctx.Request.Headers["X-Forwarded-For"].ToString();
        if (!string.IsNullOrWhiteSpace(xff))
        {
            // X-Forwarded-For peut être chaîné ("client, proxy1, proxy2") — on prend le 1er.
            var first = xff.Split(',')[0].Trim();
            if (!string.IsNullOrEmpty(first)) return first;
        }
        return ctx.Connection.RemoteIpAddress?.ToString() ?? "unknown";
    }

    /// <summary>
    /// Tronque l'IP à un préfixe de réseau : /16 pour IPv4 ("203.0.x.x" → "203.0.") et
    /// /48 pour IPv6 (3 groupes hex). Tolère les rotations DHCP/mobile dans le même
    /// opérateur sans crier au loup à chaque connexion.
    /// </summary>
    private static string TruncateIp(string ip)
    {
        if (string.IsNullOrEmpty(ip) || ip == "unknown") return string.Empty;
        if (!IPAddress.TryParse(ip, out var parsed)) return string.Empty;

        if (parsed.AddressFamily == System.Net.Sockets.AddressFamily.InterNetwork)
        {
            // IPv4 : on garde les 2 premiers octets ("a.b."). Compromis entre tolérance
            // (DHCP même FAI) et précision (alerter sur changement de pays/opérateur).
            var parts = parsed.ToString().Split('.');
            if (parts.Length >= 2) return $"{parts[0]}.{parts[1]}.";
        }
        else if (parsed.AddressFamily == System.Net.Sockets.AddressFamily.InterNetworkV6)
        {
            // IPv6 : on garde les 3 premiers groupes hex (équivalent /48). Adapté au
            // routage typique des FAI résidentiels (/48 ou /56).
            var groups = parsed.ToString().Split(':');
            if (groups.Length >= 3) return $"{groups[0]}:{groups[1]}:{groups[2]}";
        }
        return ip;
    }

    /// <summary>SHA-256 du UA → 16 premiers chars hex. Stable et non-réversible.</summary>
    private static string HashUa(string? userAgent)
    {
        if (string.IsNullOrEmpty(userAgent)) return string.Empty;
        var bytes = SHA256.HashData(Encoding.UTF8.GetBytes(userAgent.Trim()));
        return Convert.ToHexString(bytes, 0, 8);
    }

    /// <summary>
    /// Best-effort label lisible : "Chrome / Windows" extrait du UA + masque IP "203.0.x.x".
    /// Pas de parser UA externe (UAParser, etc.) — on garde la dépendance zéro et un parsing
    /// naïf suffit à donner un repère visuel à l'utilisateur dans l'email.
    /// </summary>
    private static string BuildDeviceLabel(string? userAgent, string ip)
    {
        var browser = "Navigateur inconnu";
        var os = "OS inconnu";
        if (!string.IsNullOrEmpty(userAgent))
        {
            if (userAgent.Contains("Edg/")) browser = "Edge";
            else if (userAgent.Contains("Chrome/") && !userAgent.Contains("Edg/")) browser = "Chrome";
            else if (userAgent.Contains("Firefox/")) browser = "Firefox";
            else if (userAgent.Contains("Safari/") && !userAgent.Contains("Chrome/")) browser = "Safari";
            else if (userAgent.Contains("OPR/") || userAgent.Contains("Opera")) browser = "Opera";

            if (userAgent.Contains("Windows")) os = "Windows";
            else if (userAgent.Contains("Mac OS X") || userAgent.Contains("Macintosh")) os = "macOS";
            else if (userAgent.Contains("Android")) os = "Android";
            else if (userAgent.Contains("iPhone") || userAgent.Contains("iPad") || userAgent.Contains("iOS")) os = "iOS";
            else if (userAgent.Contains("Linux")) os = "Linux";
        }

        var maskedIp = MaskIpForDisplay(ip);
        return $"{browser} · {os} · {maskedIp}";
    }

    /// <summary>"203.0.113.42" → "203.0.x.x" pour affichage utilisateur (RGPD-friendly).</summary>
    private static string MaskIpForDisplay(string ip)
    {
        if (string.IsNullOrEmpty(ip) || ip == "unknown") return "IP inconnue";
        if (!IPAddress.TryParse(ip, out var parsed)) return ip;
        if (parsed.AddressFamily == System.Net.Sockets.AddressFamily.InterNetwork)
        {
            var parts = parsed.ToString().Split('.');
            if (parts.Length == 4) return $"{parts[0]}.{parts[1]}.x.x";
        }
        return ip; // IPv6 : on garde tel quel (déjà partiellement opaque pour l'utilisateur final)
    }
}
