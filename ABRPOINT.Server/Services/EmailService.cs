using ABRPOINT.Server.Interfaces;
using MailKit.Net.Smtp;
using MailKit.Security;
using MimeKit;

namespace ABRPOINT.Server.Services
{
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

            var message = new MimeMessage();
            message.From.Add(new MailboxAddress(_settings.FromName ?? string.Empty, _settings.FromEmail));
            message.To.Add(MailboxAddress.Parse(to));
            message.Subject = subject;

            // OVH exige que From corresponde à l'utilisateur authentifié — on ajoute
            // un Sender explicite pour éviter les rebonds 553 quand FromName diffère.
            message.Sender = new MailboxAddress(_settings.FromName ?? string.Empty, _settings.FromEmail);

            var bodyBuilder = new BodyBuilder { HtmlBody = body };
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

            try
            {
                var secureOptions = ResolveSecureOptions(_settings.Port, _settings.EnableSsl);

                _logger.LogInformation(
                    "Connecting to SMTP {Host}:{Port} with {Mode}...",
                    _settings.Host, _settings.Port, secureOptions);

                await client.ConnectAsync(_settings.Host, _settings.Port, secureOptions);

                if (!string.IsNullOrEmpty(_settings.Username))
                {
                    await client.AuthenticateAsync(_settings.Username, _settings.Password);
                }

                await client.SendAsync(message);
                _logger.LogInformation("SUCCESS: Email sent to {To}", to);
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
