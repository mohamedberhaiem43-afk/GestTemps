using ABRPOINT.Server.Interfaces;
using MailKit.Net.Smtp;
using MailKit.Security;
using MimeKit;

namespace ABRPOINT.Server.Services
{
    /// <summary>
    /// Snapshot lisible de la config SMTP (sans le password) — exposé via l'endpoint
    /// admin de diagnostic et utilisé pour la bannière de boot.
    /// </summary>
    public sealed record SmtpConfigStatus(bool IsConfigured, string Reason, string? Host, int Port, string? FromEmail, bool HasAuth);

    public class SmtpSettings
    {
        public const string SectionName = "Smtp";
        public string Host { get; set; } = string.Empty;
        public int Port { get; set; }
        public string Username { get; set; } = string.Empty;
        public string Password { get; set; } = string.Empty;
        public string FromName { get; set; } = string.Empty;
        public string FromEmail { get; set; } = string.Empty;
        /// <summary>
        /// Conservé pour compatibilité avec l'ancienne config. Avec MailKit, le mode
        /// SSL/STARTTLS est déduit du port (465 = SslOnConnect, 587 = StartTls), donc
        /// ce flag n'a plus de rôle structurant — il sert juste à forcer une connexion
        /// non chiffrée si on le passe explicitement à false sur un port standard.
        /// </summary>
        public bool EnableSsl { get; set; } = true;
    }

    /// <summary>
    /// Envoi d'emails via MailKit.
    ///
    /// On a remplacé <see cref="System.Net.Mail.SmtpClient"/> qui posait deux problèmes
    /// concrets sur OVH (ssl0.ovh.net) :
    ///   1. STARTTLS sur le port 587 échouait silencieusement avec certaines suites TLS
    ///      (le handshake était rejeté côté OVH sans message d'erreur explicite).
    ///   2. Le port 465 (SSL implicite) n'est pas supporté nativement — il faut un
    ///      client TLS-on-connect, ce que MailKit fait nativement.
    ///
    /// MailKit choisit automatiquement le bon mode :
    ///   - Port 465 → <see cref="SecureSocketOptions.SslOnConnect"/>
    ///   - Port 587 → <see cref="SecureSocketOptions.StartTls"/>
    ///   - Autres   → <see cref="SecureSocketOptions.Auto"/>
    ///
    /// Les erreurs SMTP étaient également avalées par l'ancien code (catch + log,
    /// pas de re-throw) → l'appelant croyait que tout s'était bien passé. On les
    /// remonte désormais pour que les contrôleurs puissent retourner une vraie 500.
    /// </summary>
    public class EmailService : IEmailService
    {
        private readonly SmtpSettings _settings;
        private readonly ILogger<EmailService> _logger;

        public EmailService(IConfiguration configuration, ILogger<EmailService> logger)
        {
            _settings = configuration.GetSection(SmtpSettings.SectionName).Get<SmtpSettings>() ?? new SmtpSettings();
            _logger = logger;

            // Bannière au démarrage : on log VISIBLEMENT l'état SMTP au boot. Sans ça,
            // un utilisateur qui n'a pas configuré le .env découvre le problème seulement
            // au 1er forgot-password (et silencieusement, via anti-énumération). Avec ça,
            // `docker logs abrpoint.server` montre immédiatement la cause au boot.
            var status = GetConfigStatus();
            if (status.IsConfigured)
            {
                Console.WriteLine($"[EmailService] SMTP configured: {status.Host}:{status.Port}, From={status.FromEmail}, Auth={(status.HasAuth ? "yes" : "no")}");
                _logger.LogInformation("SMTP ready — Host={Host} Port={Port} From={From}", status.Host, status.Port, status.FromEmail);
            }
            else
            {
                Console.WriteLine("[EmailService] ⚠️  SMTP NOT CONFIGURED — emails (forgot-password, validations) ne seront PAS envoyés.");
                Console.WriteLine($"[EmailService] ⚠️  Reason: {status.Reason}");
                Console.WriteLine("[EmailService] ⚠️  Fix: créer un fichier .env à côté de docker-compose.yml avec SMTP_HOST, SMTP_PORT, SMTP_USERNAME, SMTP_PASSWORD, SMTP_FROM_EMAIL puis `docker compose up -d --force-recreate abrpoint.server`.");
                _logger.LogError("SMTP NOT configured at boot: {Reason}", status.Reason);
            }
        }

        /// <summary>
        /// Diagnostic en lecture seule de la config SMTP. N'effectue aucun envoi, aucun
        /// appel réseau — c'est juste un check de présence / placeholder des variables.
        /// Utilisé au boot (bannière) et par l'endpoint admin /api/admin/diagnostics/email.
        /// </summary>
        public SmtpConfigStatus GetConfigStatus()
        {
            if (string.IsNullOrWhiteSpace(_settings.Host))
                return new SmtpConfigStatus(false, "Smtp.Host est vide (variable d'env Smtp__Host).", _settings.Host, _settings.Port, _settings.FromEmail, false);
            if (string.IsNullOrWhiteSpace(_settings.FromEmail))
                return new SmtpConfigStatus(false, "Smtp.FromEmail est vide (variable d'env Smtp__FromEmail).", _settings.Host, _settings.Port, _settings.FromEmail, false);
            if (IsPlaceholder(_settings.FromEmail) || IsPlaceholder(_settings.Username) || IsPlaceholder(_settings.Password))
                return new SmtpConfigStatus(false, "Les credentials SMTP sont restés sur les valeurs placeholder de appsettings.json (REPLACE_WITH_*).", _settings.Host, _settings.Port, _settings.FromEmail, false);
            var hasAuth = !string.IsNullOrEmpty(_settings.Username) && !string.IsNullOrEmpty(_settings.Password);
            return new SmtpConfigStatus(true, "OK", _settings.Host, _settings.Port, _settings.FromEmail, hasAuth);
        }

        public async Task SendEmailAsync(string to, string subject, string body)
        {
            _logger.LogInformation("Attempting to send email to {To} with subject: {Subject}", to, subject);

            if (string.IsNullOrEmpty(_settings.Host))
            {
                _logger.LogError("SMTP Host is NOT configured in appsettings.json. Cannot send email.");
                throw new InvalidOperationException("SMTP Host n'est pas configuré (appsettings.json → Smtp.Host).");
            }

            if (string.IsNullOrEmpty(_settings.FromEmail))
            {
                _logger.LogError("SMTP FromEmail is NOT configured. OVH refuse les envois sans From valide.");
                throw new InvalidOperationException("SMTP FromEmail n'est pas configuré.");
            }

            // Garde-fou : si les credentials sont restés sur les placeholders de
            // appsettings.json (REPLACE_WITH_*), on lève AVANT la connexion SMTP
            // plutôt que de laisser MailKit échouer 20 s plus tard. Le contrôleur
            // ForgotPassword catche déjà cette exception, mais le message est plus
            // parlant dans les logs (« SMTP non configuré » > « 535 Authentication
            // failed »).
            if (IsPlaceholder(_settings.FromEmail) || IsPlaceholder(_settings.Username) || IsPlaceholder(_settings.Password))
            {
                var msg = "SMTP non configuré : les credentials d'envoi sont restés sur les valeurs " +
                          "placeholder de appsettings.json. Définir Smtp__Host / Smtp__Port / Smtp__Username / " +
                          "Smtp__Password / Smtp__FromEmail via variables d'environnement (cf. docker-compose.yml).";
                _logger.LogError(msg);
                // Console.WriteLine garantit la sortie dans `docker logs` même si le
                // logger ASP.NET filtre par défaut les LogError au niveau Information.
                Console.WriteLine("[EmailService] " + msg);
                throw new InvalidOperationException(msg);
            }

            var message = new MimeMessage();
            message.From.Add(new MailboxAddress(_settings.FromName ?? string.Empty, _settings.FromEmail));
            message.To.Add(MailboxAddress.Parse(to));
            message.Subject = subject;

            // OVH exige que From corresponde à l'utilisateur authentifié — on ajoute
            // un Sender explicite pour éviter les rebonds 553 quand FromName diffère.
            message.Sender = new MailboxAddress(_settings.FromName ?? string.Empty, _settings.FromEmail);

            var bodyBuilder = new BodyBuilder { HtmlBody = body };

            // Si le HTML référence le logo via cid:concordeLogo (cas standard via
            // EmailTemplates.Wrap), on attache le PNG en LinkedResource avec ce ContentId.
            // → Le client mail affiche le logo sans avoir à charger une URL externe
            // (qui serait souvent bloquée par défaut dans Gmail / Outlook).
            if (!string.IsNullOrEmpty(body) && body.Contains("cid:" + EmailTemplates.LogoCid))
            {
                try
                {
                    var logoPath = Path.Combine(AppContext.BaseDirectory, "Assets", "Email", "concorde-logo.png");
                    if (File.Exists(logoPath))
                    {
                        var image = bodyBuilder.LinkedResources.Add(logoPath);
                        image.ContentId = EmailTemplates.LogoCid;
                        image.ContentDisposition = new MimeKit.ContentDisposition(MimeKit.ContentDisposition.Inline);
                        // Force Base64 sur la MimePart concrète (LinkedResources.Add renvoie un
                        // MimeEntity dont ContentTransferEncoding n'est exposé que sur MimePart).
                        if (image is MimeKit.MimePart mp)
                        {
                            mp.ContentTransferEncoding = ContentEncoding.Base64;
                        }
                    }
                    else
                    {
                        _logger.LogWarning("Logo Concorde introuvable à {Path} — l'email sera envoyé sans header visuel.", logoPath);
                    }
                }
                catch (Exception logoEx)
                {
                    // Best-effort : un échec d'attachement ne doit pas empêcher l'envoi.
                    _logger.LogWarning(logoEx, "Échec d'attachement du logo Concorde dans l'email à {To}.", to);
                }
            }

            message.Body = bodyBuilder.ToMessageBody();

            using var client = new SmtpClient
            {
                // Tolérance pour les certificats intermédiaires d'OVH qui ont parfois
                // un chain validator strict sur certaines distributions Linux. On
                // ne désactive PAS la validation (sécurité) : on accepte juste les
                // errors mineurs liés aux racines système absentes côté serveur.
                CheckCertificateRevocation = false,
                Timeout = 15000,
            };

            // Watchdog explicite : si la connexion ou un appel ConnectAsync se bloque
            // (TLS handshake muet, port filtré par le firewall hébergeur, etc.),
            // MailKit n'invoque pas toujours son Timeout interne sur la phase de
            // connexion TCP. On ajoute donc un CancellationToken pour garantir une
            // sortie propre au bout de 20 s. Le user voit alors une vraie erreur
            // plutôt qu'un log qui s'arrête à "Connecting...".
            using var cts = new CancellationTokenSource(TimeSpan.FromSeconds(20));

            try
            {
                var secureOptions = ResolveSecureOptions(_settings.Port, _settings.EnableSsl);

                _logger.LogInformation(
                    "Connecting to SMTP {Host}:{Port} with {Mode}...",
                    _settings.Host, _settings.Port, secureOptions);

                await client.ConnectAsync(_settings.Host, _settings.Port, secureOptions, cts.Token);
                _logger.LogInformation("SMTP connected to {Host}:{Port}.", _settings.Host, _settings.Port);

                if (!string.IsNullOrEmpty(_settings.Username))
                {
                    _logger.LogInformation("SMTP authenticating as {Username}...", _settings.Username);
                    await client.AuthenticateAsync(_settings.Username, _settings.Password, cts.Token);
                    _logger.LogInformation("SMTP authenticated.");
                }

                _logger.LogInformation("SMTP sending message to {To}...", to);
                var serverResponse = await client.SendAsync(message, cts.Token);
                _logger.LogInformation("SUCCESS: Email sent to {To}. Server response: {Response}", to, serverResponse);
            }
            catch (OperationCanceledException) when (cts.IsCancellationRequested)
            {
                _logger.LogError(
                    "SMTP timeout (20s) on {Host}:{Port}. Symptômes typiques : firewall " +
                    "qui DROP les paquets (au lieu de REJECT), port 587 fermé en sortie, " +
                    "ou OVH refuse la session avant TLS. Tester `Test-NetConnection {Host} -Port {Port}`.",
                    _settings.Host, _settings.Port, _settings.Host, _settings.Port);
                throw;
            }
            catch (AuthenticationException authEx)
            {
                _logger.LogError(authEx,
                    "SMTP authentication failed for {Username} on {Host}:{Port}. " +
                    "Sur OVH, vérifier que le mot de passe est correct ET que le " +
                    "compte mail dispose de l'envoi SMTP autorisé dans le manager OVH.",
                    _settings.Username, _settings.Host, _settings.Port);
                throw;
            }
            catch (SmtpCommandException smtpEx)
            {
                _logger.LogError(smtpEx,
                    "SMTP command rejected by {Host}:{Port}. Status={Status} Code={Code}. " +
                    "Sur OVH, le From ({From}) doit MATCHER l'utilisateur authentifié ({Username}).",
                    _settings.Host, _settings.Port, smtpEx.StatusCode, smtpEx.ErrorCode,
                    _settings.FromEmail, _settings.Username);
                throw;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex,
                    "Failed to send email to {To} via {Host}:{Port}. " +
                    "Vérifier que le port n'est pas bloqué en sortie (OVH ferme 25, " +
                    "certains hébergeurs ferment aussi 587).",
                    to, _settings.Host, _settings.Port);
                throw;
            }
            finally
            {
                if (client.IsConnected)
                {
                    try { await client.DisconnectAsync(true); } catch { /* best-effort */ }
                }
            }
        }

        private static bool IsPlaceholder(string? value)
        {
            if (string.IsNullOrWhiteSpace(value)) return false;
            return value.StartsWith("REPLACE_WITH_", StringComparison.OrdinalIgnoreCase);
        }

        /// <summary>
        /// Choisit le mode TLS adapté au port. Le port 465 est de l'« implicit SSL »
        /// (le client doit ouvrir un socket TLS dès le départ), le port 587 est du
        /// STARTTLS (connexion plain text puis upgrade). L'ancien code System.Net.Mail
        /// gérait mal cette distinction, ce qui faisait taire les envois.
        /// </summary>
        private static SecureSocketOptions ResolveSecureOptions(int port, bool enableSsl)
        {
            if (!enableSsl) return SecureSocketOptions.None;
            return port switch
            {
                465 => SecureSocketOptions.SslOnConnect,
                587 => SecureSocketOptions.StartTls,
                25  => SecureSocketOptions.None,
                _   => SecureSocketOptions.Auto,
            };
        }
    }
}
