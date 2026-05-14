using ABRPOINT.Server.Services;

namespace ABRPOINT.Server.Interfaces
{
    public interface IEmailService
    {
        Task SendEmailAsync(string to, string subject, string body);

        /// <summary>
        /// État de la config SMTP — lecture seule, aucun appel réseau. Utilisé par
        /// les endpoints d'admin/diagnostic pour exposer la cause d'un envoi qui
        /// échoue (sans révéler le mot de passe).
        /// </summary>
        SmtpConfigStatus GetConfigStatus();
    }
}
