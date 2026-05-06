using ABRPOINT.Server.Data;
using ABRPOINT.Server.Interfaces;
using ABRPOINT.Server.Models;
using Microsoft.EntityFrameworkCore;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;

namespace ABRPOINT.Server.Repository
{
    public class NoteDeFraisRepository : INoteDeFraisRepository
    {
        private readonly ApplicationDbContext _context;
        private readonly IEmailService _emailService;
        private readonly IUtilisateurRepository _utilisateurRepository;

        public NoteDeFraisRepository(ApplicationDbContext context, IEmailService emailService, IUtilisateurRepository utilisateurRepository)
        {
            _context = context;
            _emailService = emailService;
            _utilisateurRepository = utilisateurRepository;
        }

        public async Task<IEnumerable<NoteDeFrais>> GetAllBySoc(string soccod)
        {
            return await _context.NoteDeFrais
                .Where(n => n.Soccod == soccod)
                .OrderByDescending(n => n.DateDepense)
                .ToListAsync();
        }

        public async Task<IEnumerable<NoteDeFrais>> GetByEmp(string soccod, string empcod)
        {
            return await _context.NoteDeFrais
                .Where(n => n.Soccod == soccod && n.Empcod == empcod)
                .OrderByDescending(n => n.DateDepense)
                .ToListAsync();
        }

        public async Task<NoteDeFrais?> GetById(int id)
        {
            return await _context.NoteDeFrais.FindAsync(id);
        }

        public async Task AddAsync(NoteDeFrais notedefrais)
        {
            try
            {

                await _context.NoteDeFrais.AddAsync(notedefrais);
                await _context.SaveChangesAsync();

                
                        var admins = await _utilisateurRepository.GetAdminsEmailsAsync();
                        if (admins.Any())
                        {
                            var safeEmpcod = System.Net.WebUtility.HtmlEncode(notedefrais.Empcod ?? "");
                            var safeTitre = System.Net.WebUtility.HtmlEncode(notedefrais.Titre ?? "");
                            var infoCard = Services.EmailTemplates.InfoCard(new Dictionary<string, string>
                            {
                                ["Employé"] = safeEmpcod,
                                ["Titre"] = safeTitre,
                                ["Montant"] = $"<strong>{notedefrais.Montant:N2} €</strong>",
                            });
                            var inner =
                                "<p>Une nouvelle note de frais vient d'être soumise et attend votre validation.</p>" +
                                infoCard +
                                "<p style=\"margin-top:24px;\">Cordialement,<br/><strong>L'équipe Concorde Workforce</strong></p>";
                            var body = Services.EmailTemplates.Wrap(
                                title: "Nouvelle note de frais à valider",
                                preview: $"De {notedefrais.Empcod} — {notedefrais.Montant:N2} €",
                                innerHtml: inner);
                            foreach (var email in admins)
                            {
                                await _emailService.SendEmailAsync(email, "Concorde Workforce — Nouvelle note de frais", body);
                            }
                        }
            }
            catch (Exception)
            {
                throw;
            }
        }

        public async Task UpdateAsync(NoteDeFrais notedefrais)
        {
            try
            {
                _context.NoteDeFrais.Update(notedefrais);
                await _context.SaveChangesAsync();

                // Notify Employee if status changed
                if (notedefrais.Etat == "Approved" || notedefrais.Etat == "Refusée")
                {
                    var user = await _context.Utilisateurs.FindAsync(notedefrais.Empcod);
                    if (user != null && !string.IsNullOrEmpty(user.Utimail))
                    {
                        var isApproved = notedefrais.Etat == "Approved";
                        var subject = isApproved
                            ? "Concorde Workforce — Note de frais validée"
                            : "Concorde Workforce — Note de frais refusée";
                        var safeTitre = System.Net.WebUtility.HtmlEncode(notedefrais.Titre ?? "");
                        var displayName = string.IsNullOrWhiteSpace(user.Utiprn) ? user.Utinom ?? "" : $"{user.Utiprn} {user.Utinom}";
                        var infoCard = Services.EmailTemplates.InfoCard(new Dictionary<string, string>
                        {
                            ["Titre"] = safeTitre,
                            ["Montant"] = $"<strong>{notedefrais.Montant:N2} €</strong>",
                            ["Statut"] = isApproved
                                ? "<span style=\"color:#059669;font-weight:700;\">✔ Validée</span>"
                                : "<span style=\"color:#dc2626;font-weight:700;\">✖ Refusée</span>",
                        });
                        var statusBanner = isApproved
                            ? Services.EmailTemplates.StatusBanner("Le remboursement sera intégré à votre prochaine paie.", Services.EmailTemplates.StatusKind.Success)
                            : Services.EmailTemplates.StatusBanner("Pour comprendre la décision, contactez votre responsable.", Services.EmailTemplates.StatusKind.Error);
                        var inner =
                            $"<p>Bonjour <strong>{System.Net.WebUtility.HtmlEncode(displayName)}</strong>,</p>" +
                            $"<p>Votre note de frais a été {(isApproved ? "validée" : "refusée")} par votre administrateur.</p>" +
                            infoCard +
                            statusBanner +
                            "<p style=\"margin-top:24px;\">Cordialement,<br/><strong>L'équipe Concorde Workforce</strong></p>";
                        var body = Services.EmailTemplates.Wrap(
                            title: isApproved ? "Note de frais validée" : "Note de frais refusée",
                            preview: $"{notedefrais.Titre} — {notedefrais.Montant:N2} €",
                            innerHtml: inner);
                        await _emailService.SendEmailAsync(user.Utimail, subject, body);
                    }
                }
            }
            catch (Exception)
            {
                throw;
            }
        }

        public async Task DeleteAsync(int id)
        {
            var item = await _context.NoteDeFrais.FindAsync(id);
            if (item != null)
            {
                _context.NoteDeFrais.Remove(item);
                await _context.SaveChangesAsync();
            }
        }
    }
}
