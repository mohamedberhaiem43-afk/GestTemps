using ABRPOINT.Server.Data;
using ABRPOINT.Server.Dtaos;
using ABRPOINT.Server.Interfaces;
using ABRPOINT.Server.Models;
using Microsoft.EntityFrameworkCore;

namespace ABRPOINT.Server.Repository
{
    public class DemandeAutorisationRepository : IDemandeAutorisationRepository
    {
        private readonly ApplicationDbContext _dbContext;
        private readonly IUtilisateurRepository _utilisateurRepository;
        private readonly IEmailService _emailService;

        public DemandeAutorisationRepository(ApplicationDbContext dbContext, IUtilisateurRepository utilisateurRepository, IEmailService emailService)
        {
            _dbContext = dbContext;
            _utilisateurRepository = utilisateurRepository;
            _emailService = emailService;
        }

        public async Task<List<DemandeAutorisationDto>> GetAllBySocieteAsync(string soccod, string uticod)
        {
            try
            {
                // Build the base query using ANY instead of JOIN on Socuser (avoids duplicate rows)
                var query =
                    from d in _dbContext.DemandeAutorisations
                    join e in _dbContext.Employes on d.Empcod equals e.Empcod
                    join a in _dbContext.Absences on new { d.Abscod, d.Soccod } equals new { Abscod = a.Abscod, Soccod = a.Soccod } into absJoin
                    from a in absJoin.DefaultIfEmpty()
                    where d.Soccod == soccod
                        && _dbContext.Socusers.Any(su =>
                            su.Soccod == e.Soccod &&
                            su.Sitcod == e.Sitcod &&
                            su.Uticod == uticod)
                    select new { d, e, a };

                // Filter by manager service code if applicable
                string? managerSercod = await GetManagerServiceCodeAsync(soccod, uticod);
                if (!string.IsNullOrEmpty(managerSercod))
                {
                    query = query.Where(x => x.e.Sercod == managerSercod);
                }

                var result = await query
                    .Select(x => new DemandeAutorisationDto
                    {
                        Id = x.d.Id,
                        Soccod = x.d.Soccod,
                        Empcod = x.d.Empcod,
                        Concod = x.d.Concod,
                        Condat = x.d.Condat,
                        Condep = x.d.Condep,
                        Conret = x.d.Conret,
                        Connbjour = x.d.Connbjour,
                        Conmotif = x.d.Conmotif,
                        Statut = x.d.Statut,
                        DateDemande = x.d.DateDemande,
                        TraitePar = x.d.TraitePar,
                        DateTraitement = x.d.DateTraitement,
                        Commentaire = x.d.Commentaire,
                        Abscod = x.d.Abscod,
                        Emplib = x.e.Emplib,
                        Abslib = x.a != null ? x.a.Abslib : null,
                    })
                    .OrderByDescending(x => x.DateDemande)
                    .ToListAsync();

                return result;
            }
            catch (Exception)
            {
                throw;
            }
        }

        public async Task<List<DemandeAutorisationDto>> GetByEmployeAsync(string soccod, string empcod)
        {
            try
            {
            return await (
                    from d in _dbContext.DemandeAutorisations
                    join e in _dbContext.Employes on d.Empcod equals e.Empcod
                    join a in _dbContext.Absences on new { d.Abscod, d.Soccod } equals new { Abscod = a.Abscod, Soccod = a.Soccod } into absJoin
                    from a in absJoin.DefaultIfEmpty()
                    where d.Soccod == soccod && d.Empcod == empcod
                    select new DemandeAutorisationDto
                    {
                        Id = d.Id,
                        Soccod = d.Soccod,
                        Empcod = d.Empcod,
                        Concod = d.Concod,
                        Condat = d.Condat,
                        Condep = d.Condep,
                        Conret = d.Conret,
                        Connbjour = d.Connbjour,
                        Conmotif = d.Conmotif,
                        Statut = d.Statut,
                        DateDemande = d.DateDemande,
                        TraitePar = d.TraitePar,
                        DateTraitement = d.DateTraitement,
                        Commentaire = d.Commentaire,
                        Abscod = d.Abscod,
                        Emplib = e.Emplib,
                        Abslib = a != null ? a.Abslib : null,
                    }
                ).OrderByDescending(x => x.DateDemande).ToListAsync();
            }
            catch (Exception)
            {
                throw;
            }
        }

        public async Task<DemandeAutorisation?> GetByIdAsync(int id)
        {
            return await _dbContext.DemandeAutorisations.FindAsync(id);
        }

        public async Task<DemandeAutorisation> AddAsync(DemandeAutorisation demande)
        {
            try
            {
                demande.DateDemande = DateTime.Now;
                demande.Statut = "En attente";

                // Calculate hours difference
                if (demande.Condep.HasValue && demande.Conret.HasValue)
                {
                    TimeSpan duration = demande.Conret.Value - demande.Condep.Value;
                    demande.Connbjour = (float)Math.Round(duration.TotalHours, 2);
                }

                _dbContext.DemandeAutorisations.Add(demande);
                await _dbContext.SaveChangesAsync();

                // Notify admins
                _ = Task.Run(async () =>
                {
                    try
                    {
                        var admins = await _utilisateurRepository.GetAdminsEmailsAsync();
                        foreach (var email in admins)
                        {
                            await _emailService.SendEmailAsync(email, "Nouvelle Demande d'Autorisation",
                                $"Une nouvelle demande d'autorisation a été déposée par l'employé {demande.Empcod}.<br/>" +
                                $"Date : {demande.Condat:dd/MM/yyyy}<br/>" +
                                $"Horaire : {demande.Condep:HH:mm} à {demande.Conret:HH:mm}.");
                        }
                    }
                    catch { /* ignore */ }
                });

                return demande;
            }
            catch (Exception)
            {
                throw;
            }
        }

        public async Task<DemandeAutorisation?> UpdateAsync(DemandeAutorisation demande)
        {
            try
            {
                var existing = await _dbContext.DemandeAutorisations.FindAsync(demande.Id);
                if (existing == null) return null;

                // Only allow update if still pending
                if (existing.Statut != "En attente") return null;

                existing.Concod = demande.Concod;
                existing.Condat = demande.Condat;
                existing.Condep = demande.Condep;
                existing.Conret = demande.Conret;
                existing.Conmotif = demande.Conmotif;
                existing.Abscod = demande.Abscod;

                // Recalculate duration
                if (existing.Condep.HasValue && existing.Conret.HasValue)
                {
                    TimeSpan duration = existing.Conret.Value - existing.Condep.Value;
                    existing.Connbjour = (float)Math.Round(duration.TotalHours, 2);
                }

                await _dbContext.SaveChangesAsync();
                return existing;
            }
            catch (Exception)
            {
                throw;
            }
        }

        public async Task<bool> DeleteAsync(int id)
        {
            try
            {
                var demande = await _dbContext.DemandeAutorisations.FindAsync(id);
                if (demande == null) return false;

                _dbContext.DemandeAutorisations.Remove(demande);
                await _dbContext.SaveChangesAsync();
                return true;
            }
            catch (Exception)
            {
                throw;
            }
        }

        public async Task<(bool Success, string Message)> ApproveAsync(int id, string traitePar, string? commentaire)
        {
            try
            {
                var demande = await _dbContext.DemandeAutorisations.FindAsync(id);
                if (demande == null)
                    return (false, $"Demande d'autorisation avec l'ID {id} introuvable.");

                if (demande.Statut != "En attente")
                    return (false, $"Cette demande a déjà été traitée (statut: {demande.Statut}).");

                demande.Statut = "Approuvé";
                demande.TraitePar = traitePar;
                demande.DateTraitement = DateTime.Now;
                demande.Commentaire = commentaire;

                // Create an Autoriser entry from the approved demande
                var autoriser = new Autoriser
                {
                    Concod = demande.Concod ?? $"AUT{demande.Id:D6}",
                    Soccod = demande.Soccod,
                    Empcod = demande.Empcod,
                    Condat = demande.Condat,
                    Condep = demande.Condep,
                    Conret = demande.Conret,
                    Connbjour = demande.Connbjour,
                    Conmotif = demande.Conmotif,
                    Abscod = demande.Abscod,
                    Conjour = "O",
                    Conamdep = "0",
                    Conamret = "0",
                };

                await _dbContext.Autorisers.AddAsync(autoriser);
                await _dbContext.SaveChangesAsync();

                // Notify Employee
                _ = Task.Run(async () =>
                {
                    try
                    {
                        var user = await _dbContext.Utilisateurs.FindAsync(demande.Empcod);
                        if (user != null && !string.IsNullOrEmpty(user.Utimail))
                        {
                            await _emailService.SendEmailAsync(user.Utimail, "Demande d'Autorisation Approuvée",
                                $"Votre demande d'autorisation pour le {demande.Condat:dd/MM/yyyy} ({demande.Condep:HH:mm} à {demande.Conret:HH:mm}) a été <b>approuvée</b>.");
                        }
                    }
                    catch { /* ignore */ }
                });

                return (true, $"Demande d'autorisation approuvée avec succès.");
            }
            catch (Exception ex)
            {
                throw new Exception($"Erreur lors de l'approbation: {ex.Message}", ex);
            }
        }

        public async Task<(bool Success, string Message)> RefuseAsync(int id, string traitePar, string? commentaire)
        {
            try
            {
                var demande = await _dbContext.DemandeAutorisations.FindAsync(id);
                if (demande == null)
                    return (false, $"Demande d'autorisation avec l'ID {id} introuvable.");

                if (demande.Statut != "En attente")
                    return (false, $"Cette demande a déjà été traitée (statut: {demande.Statut}).");

                demande.Statut = "Refusé";
                demande.TraitePar = traitePar;
                demande.DateTraitement = DateTime.Now;
                demande.Commentaire = commentaire;

                await _dbContext.SaveChangesAsync();

                // Notify Employee
                _ = Task.Run(async () =>
                {
                    try
                    {
                        var user = await _dbContext.Utilisateurs.FindAsync(demande.Empcod);
                        if (user != null && !string.IsNullOrEmpty(user.Utimail))
                        {
                            await _emailService.SendEmailAsync(user.Utimail, "Demande d'Autorisation Refusée",
                                $"Votre demande d'autorisation pour le {demande.Condat:dd/MM/yyyy} ({demande.Condep:HH:mm} à {demande.Conret:HH:mm}) a été <b>refusée</b>.");
                        }
                    }
                    catch { /* ignore */ }
                });

                return (true, $"Demande d'autorisation refusée avec succès.");
            }
            catch (Exception ex)
            {
                throw new Exception($"Erreur lors du refus: {ex.Message}", ex);
            }
        }

        private async Task<string?> GetManagerServiceCodeAsync(string soccod, string uticod)
        {
            var user = await _dbContext.Utilisateurs.AsNoTracking()
                .FirstOrDefaultAsync(u => u.Uticod == uticod);

            if (user != null && user.Utiadm != "1")
            {
                if (user.Utirole == "Chef de service" || user.Utirole == "Manager" || user.Utirole == "Responsable")
                {
                    var emp = await _dbContext.Employes.AsNoTracking()
                        .FirstOrDefaultAsync(e => e.Soccod == soccod && e.Empcod == uticod);
                    return emp?.Sercod;
                }
            }
            return null;
        }
    }
}