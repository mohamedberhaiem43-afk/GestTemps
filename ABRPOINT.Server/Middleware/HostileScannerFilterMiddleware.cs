using System.Text.RegularExpressions;

namespace ABRPOINT.Server.Middleware
{
    /// <summary>
    /// Filtre les chemins typiques des scans automatisés et tentatives d'exploit
    /// avant que MapFallbackToFile("/index.html") ne renvoie un 200 trompeur.
    ///
    /// Contexte (cf. logs serveur 2026-05) :
    ///   - 13:12:24  GET /.env  → 200 (845 bytes — index.html, mais scanner croit avoir gagné)
    ///   - 13:07:40  GET /wp-admin/install.php → 200 (idem, SPA fallback)
    ///   - 12:57:11  GET /shell?cd+/tmp;rm+-rf+*;wget+http://... → tentative Mozi
    ///   - 12:58:41  POST /cgi-bin/.%2e/.%2e/.../bin/sh → path traversal
    ///   - 12:58:41  POST /hello.world?%ADd+allow_url_include%3d1 → PHP RFI
    ///
    /// On ne sert AUCUN de ces chemins à la couche app — réponse 404 immédiate,
    /// log info-level avec IP source pour pouvoir bloquer côté pare-feu sur les
    /// pattern récurrents. Placé tôt dans le pipeline, AVANT static files et
    /// avant l'auth pour épargner le coût de validation JWT/tenant.
    /// </summary>
    public sealed class HostileScannerFilterMiddleware
    {
        private readonly RequestDelegate _next;
        private readonly ILogger<HostileScannerFilterMiddleware> _log;

        public HostileScannerFilterMiddleware(RequestDelegate next, ILogger<HostileScannerFilterMiddleware> log)
        {
            _next = next;
            _log = log;
        }

        // Préfixes de chemins liés à des CMS/runtimes qu'on n'utilise pas (WordPress,
        // PHP, Joomla, scripts shell historiques). Toute requête sur ces préfixes est
        // forcément un scan ou une tentative d'exploit.
        private static readonly string[] BlockedPathPrefixes =
        {
            "/wp-admin", "/wp-login", "/wp-content", "/wp-includes", "/wordpress",
            "/xmlrpc.php", "/feed", "/cgi-bin", "/phpmyadmin", "/phpunit",
            "/vendor/", "/.git", "/.svn", "/.hg", "/.idea", "/.vscode",
            "/shell", "/hello.world",
            // Fichiers de configuration sensibles que rien ne doit servir publiquement
            "/.env", "/.htaccess", "/.htpasswd", "/.DS_Store",
            "/composer.json", "/composer.lock", "/package.json", "/yarn.lock",
            "/web.config", "/appsettings.json", "/appsettings.development.json"
        };

        // Indices de tentative d'exploit dans le path ou la query string :
        //   - séquences de path traversal encodées variées (%2e, %252e, ../, ..\\)
        //   - URLs d'inclusion distante (php://, file://, data:)
        //   - tokens shell directs (;cd /, ;rm -rf, wget http, chmod 777)
        private static readonly Regex AttackPattern = new(
            @"(\.\./|\.\.\\|%2e%2e|%252e|%c0%2e|/etc/passwd|/proc/self|php://|file://|data:text/|/bin/sh|cd\+/tmp|rm\+-rf|wget\+http|chmod\+777|allow_url_include|auto_prepend_file)",
            RegexOptions.Compiled | RegexOptions.IgnoreCase);

        public async Task InvokeAsync(HttpContext context)
        {
            var path = context.Request.Path.Value ?? string.Empty;
            var query = context.Request.QueryString.Value ?? string.Empty;
            var lowerPath = path.ToLowerInvariant();

            bool blockedByPrefix = false;
            foreach (var prefix in BlockedPathPrefixes)
            {
                if (lowerPath.StartsWith(prefix, StringComparison.Ordinal) ||
                    lowerPath.Contains(prefix, StringComparison.Ordinal))
                {
                    blockedByPrefix = true;
                    break;
                }
            }

            bool blockedByPattern = AttackPattern.IsMatch(path) || AttackPattern.IsMatch(query);

            if (blockedByPrefix || blockedByPattern)
            {
                var ip = context.Connection.RemoteIpAddress?.ToString() ?? "unknown";
                _log.LogInformation(
                    "Scanner/exploit bloqué — IP={Ip} Method={Method} Path={Path} Query={Query} Reason={Reason}",
                    ip, context.Request.Method, path, query,
                    blockedByPrefix ? "blocked-prefix" : "attack-pattern");

                context.Response.StatusCode = StatusCodes.Status404NotFound;
                context.Response.Headers["Cache-Control"] = "no-store";
                // Pas de body : on ne donne aucun retour exploitable au scanner.
                return;
            }

            await _next(context);
        }
    }
}
