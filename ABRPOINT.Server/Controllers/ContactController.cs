using ABRPOINT.Server.Dtaos;
using ABRPOINT.Server.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Net.Mail;
using System.Text.RegularExpressions;

namespace ABRPOINT.Server.Controllers
{
    [ApiController]
    [Route("api/contact")]
    [AllowAnonymous]
    public class ContactController : ControllerBase
    {
        private const string SupportInbox = "contact@concorde-tech.fr";
        private const string SalesInbox = "ventes@concorde-tech.fr";

        private readonly IEmailService _emailService;
        private readonly ILogger<ContactController> _log;

        public ContactController(IEmailService emailService, ILogger<ContactController> log)
        {
            _emailService = emailService;
            _log = log;
        }

        [HttpPost("support")]
        public async Task<IActionResult> Support([FromBody] ContactSupportRequest req)
        {
            if (req is null)
                return BadRequest(new { error = "Requête invalide." });

            var name = (req.Name ?? string.Empty).Trim();
            var email = (req.Email ?? string.Empty).Trim();
            var subject = (req.Subject ?? string.Empty).Trim();
            var message = (req.Message ?? string.Empty).Trim();

            if (name.Length == 0 || message.Length == 0 || subject.Length == 0)
                return BadRequest(new { error = "Tous les champs sont requis." });
            if (!IsValidEmail(email))
                return BadRequest(new { error = "Adresse email invalide." });

            var safeName = System.Net.WebUtility.HtmlEncode(name);
            var safeEmail = System.Net.WebUtility.HtmlEncode(email);
            var safeSubject = System.Net.WebUtility.HtmlEncode(subject);
            var safeMessage = System.Net.WebUtility.HtmlEncode(message).Replace("\n", "<br/>");

            var emailSubject = $"[Support] {subject}";
            var body =
                "<p><strong>Nouveau message support</strong></p>" +
                "<ul>" +
                $"<li><strong>Nom :</strong> {safeName}</li>" +
                $"<li><strong>Email :</strong> {safeEmail}</li>" +
                $"<li><strong>Sujet :</strong> {safeSubject}</li>" +
                "</ul>" +
                $"<p><strong>Message :</strong></p><p>{safeMessage}</p>";

            try
            {
                await _emailService.SendEmailAsync(SupportInbox, emailSubject, body);
                return Ok(new { success = true });
            }
            catch (Exception ex)
            {
                _log.LogError(ex, "Échec envoi message support de {Email}", email);
                return StatusCode(500, new { error = "Impossible d'envoyer le message. Réessayez plus tard." });
            }
        }

        [HttpPost("sales")]
        public async Task<IActionResult> Sales([FromBody] ContactSalesRequest req)
        {
            if (req is null)
                return BadRequest(new { error = "Requête invalide." });

            var company = (req.Company ?? string.Empty).Trim();
            var contactName = (req.ContactName ?? string.Empty).Trim();
            var email = (req.Email ?? string.Empty).Trim();
            var phone = (req.Phone ?? string.Empty).Trim();
            var headcount = (req.Headcount ?? string.Empty).Trim();
            var needs = (req.Needs ?? string.Empty).Trim();

            if (company.Length == 0 || contactName.Length == 0)
                return BadRequest(new { error = "Société et nom sont obligatoires." });
            if (!IsValidEmail(email))
                return BadRequest(new { error = "Adresse email invalide." });

            var safeCompany = System.Net.WebUtility.HtmlEncode(company);
            var safeContact = System.Net.WebUtility.HtmlEncode(contactName);
            var safeEmail = System.Net.WebUtility.HtmlEncode(email);
            var safePhone = System.Net.WebUtility.HtmlEncode(phone.Length == 0 ? "—" : phone);
            var safeHeadcount = System.Net.WebUtility.HtmlEncode(headcount.Length == 0 ? "—" : headcount);
            var safeNeeds = System.Net.WebUtility.HtmlEncode(needs.Length == 0 ? "—" : needs).Replace("\n", "<br/>");

            var emailSubject = $"[Ventes] Demande Premium — {company}";
            var body =
                "<p><strong>Nouvelle demande commerciale Premium</strong></p>" +
                "<ul>" +
                $"<li><strong>Société :</strong> {safeCompany}</li>" +
                $"<li><strong>Contact :</strong> {safeContact}</li>" +
                $"<li><strong>Email :</strong> {safeEmail}</li>" +
                $"<li><strong>Téléphone :</strong> {safePhone}</li>" +
                $"<li><strong>Effectif :</strong> {safeHeadcount}</li>" +
                "</ul>" +
                $"<p><strong>Besoins :</strong></p><p>{safeNeeds}</p>";

            try
            {
                await _emailService.SendEmailAsync(SalesInbox, emailSubject, body);
                return Ok(new { success = true });
            }
            catch (Exception ex)
            {
                _log.LogError(ex, "Échec envoi demande commerciale de {Email}", email);
                return StatusCode(500, new { error = "Impossible d'envoyer la demande. Réessayez plus tard." });
            }
        }

        private static bool IsValidEmail(string email)
        {
            if (string.IsNullOrWhiteSpace(email)) return false;
            try
            {
                var addr = new MailAddress(email);
                return addr.Address == email && Regex.IsMatch(email, @"^[^@\s]+@[^@\s]+\.[^@\s]+$");
            }
            catch
            {
                return false;
            }
        }
    }
}
