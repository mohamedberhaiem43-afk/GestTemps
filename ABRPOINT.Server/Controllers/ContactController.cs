using ABRPOINT.Server.Dtaos;
using ABRPOINT.Server.Interfaces;
using ABRPOINT.Server.Tenancy;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using System.Net.Mail;
using System.Text.RegularExpressions;

namespace ABRPOINT.Server.Controllers
{
    [ApiController]
    [Route("api/contact")]
    [AllowAnonymous]
    // SEC — Rate limit strict : ces endpoints anonymes envoient des emails via le SMTP
    // OVH authentifié. Sans limite, un bot peut spammer des milliers de messages et
    // faire blacklister le domaine. 5/h/IP suffit pour un usage humain normal.
    [EnableRateLimiting("public-form")]
    public class ContactController : ControllerBase
    {
        private const string SupportInbox = "contact@concorde-tech.fr";
        private const string SalesInbox = "contact@concorde-tech.fr";

        private readonly IEmailService _emailService;
        private readonly ILogger<ContactController> _log;
        private readonly ICurrentTenant _currentTenant;

        public ContactController(IEmailService emailService, ILogger<ContactController> log, ICurrentTenant currentTenant)
        {
            _emailService = emailService;
            _log = log;
            _currentTenant = currentTenant;
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

            // Pack du tenant courant (formulaire ouvert depuis l'espace connecté → le middleware
            // de tenancy a résolu le tenant). On mentionne le pack dans le mail support pour que
            // l'équipe priorise : Premium — ou l'addon « Support Prioritaire » — = traitement
            // prioritaire. Formulaire anonyme (landing publique) : aucun tenant → section omise.
            var tenant = _currentTenant.Current;
            string? planDisplay = null;
            var isPriority = false;
            if (tenant != null)
            {
                var plan = PlanCatalog.GetPlan(tenant.PlanCode);
                planDisplay = plan?.DisplayName
                    ?? (string.IsNullOrWhiteSpace(tenant.PlanCode) ? "—" : tenant.PlanCode);
                var feats = PlanCatalog.GetEffectiveFeatures(tenant.PlanCode, tenant.Addons);
                isPriority = string.Equals(plan?.Code, PlanCatalog.PremiumCode, StringComparison.OrdinalIgnoreCase)
                             || feats.PrioritySupport;
            }

            var priorityTag = isPriority ? "[PRIORITAIRE] " : string.Empty;
            var emailSubject = $"[Support] {priorityTag}{subject}";

            var cardData = new Dictionary<string, string>
            {
                ["Nom"] = safeName,
                ["Email"] = safeEmail,
                ["Sujet"] = safeSubject,
            };
            if (tenant != null)
            {
                cardData["Société"] = System.Net.WebUtility.HtmlEncode(tenant.CompanyName ?? "—");
                cardData["Pack"] = System.Net.WebUtility.HtmlEncode(planDisplay ?? "—")
                    + (isPriority ? " ⭐ PRIORITAIRE" : string.Empty);
            }
            var infoCard = Services.EmailTemplates.InfoCard(cardData);

            // Bannière priorité en tête du message pour un repérage immédiat côté support.
            var priorityBanner = isPriority
                ? "<div style=\"background:#fef3c7;border-left:3px solid #d97706;padding:10px 16px;border-radius:6px;font-size:14px;font-weight:700;color:#92400e;margin-bottom:14px;\">⭐ Client Premium — demande à traiter en priorité.</div>"
                : string.Empty;

            var inner =
                priorityBanner +
                "<p>Un visiteur a envoyé un message via le formulaire support.</p>" +
                infoCard +
                "<p style=\"font-size:13px;color:#475569;font-weight:700;margin-top:18px;\">Message :</p>" +
                $"<div style=\"background:#f8fafc;border-left:3px solid #0040a1;padding:12px 18px;border-radius:6px;font-size:14px;line-height:1.55;color:#334155;\">{safeMessage}</div>";
            var body = Services.EmailTemplates.Wrap(
                title: isPriority ? "Nouveau message support ⭐ PRIORITAIRE" : "Nouveau message support",
                preview: $"De {name} — {subject}",
                innerHtml: inner);

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
            var infoCard = Services.EmailTemplates.InfoCard(new Dictionary<string, string>
            {
                ["Société"] = safeCompany,
                ["Contact"] = safeContact,
                ["Email"] = safeEmail,
                ["Téléphone"] = safePhone,
                ["Effectif"] = safeHeadcount,
            });
            var inner =
                "<p>Une nouvelle entreprise est intéressée par l'offre Premium et attend votre rappel.</p>" +
                infoCard +
                "<p style=\"font-size:13px;color:#475569;font-weight:700;margin-top:18px;\">Besoins exprimés :</p>" +
                $"<div style=\"background:#f8fafc;border-left:3px solid #0040a1;padding:12px 18px;border-radius:6px;font-size:14px;line-height:1.55;color:#334155;\">{safeNeeds}</div>";
            var body = Services.EmailTemplates.Wrap(
                title: "Demande commerciale Premium",
                preview: $"{company} — {contactName}",
                innerHtml: inner);

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
