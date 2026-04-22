using System.Net;
using System.Net.Mail;
using ABRPOINT.Server.Interfaces;

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
        public bool EnableSsl { get; set; }
    }

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
                return;
            }

            try
            {
                using var client = new SmtpClient(_settings.Host, _settings.Port)
                {
                    Credentials = new NetworkCredential(_settings.Username, _settings.Password),
                    EnableSsl = _settings.EnableSsl,
                    Timeout = 10000 // 10 seconds timeout
                };

                var mailMessage = new MailMessage
                {
                    From = new MailAddress(_settings.FromEmail, _settings.FromName),
                    Subject = subject,
                    Body = body,
                    IsBodyHtml = true
                };

                mailMessage.To.Add(to);

                _logger.LogInformation("Sending email via SMTP host {Host}:{Port}...", _settings.Host, _settings.Port);
                await client.SendMailAsync(mailMessage);
                _logger.LogInformation("SUCCESS: Email sent successfully to {To}", to);
            }
            catch (SmtpException smtpEx)
            {
                _logger.LogError(smtpEx, "SMTP Error occurred while sending email to {To}. Status: {StatusCode}", to, smtpEx.StatusCode);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "CRITICAL ERROR: Failed to send email to {To}", to);
            }
        }
    }
}
