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
                        foreach (var email in admins)
                        {
                            await _emailService.SendEmailAsync(email, "Nouvelle Note de Frais",
                                $"Une nouvelle note de frais a été soumise par l'employé {notedefrais.Empcod}.<br/>" +
                                $"Titre : {notedefrais.Titre}<br/>" +
                                $"Montant : {notedefrais.Montant} DT.");
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
                                string subject = notedefrais.Etat == "Approved" ? "Note de Frais Validée" : "Note de Frais Refusée";
                                string statusText = notedefrais.Etat == "Approved" ? "<b>validée</b>" : "<b>refusée</b>";
                                await _emailService.SendEmailAsync(user.Utimail, subject,
                                    $"Votre note de frais \"{notedefrais.Titre}\" ({notedefrais.Montant} DT) a été {statusText}.");
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
