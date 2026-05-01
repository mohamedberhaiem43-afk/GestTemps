using ABRPOINT.Server.Data;
using ABRPOINT.Server.Dtaos;
using ABRPOINT.Server.Interfaces;
using ABRPOINT.Server.Models;
using Microsoft.EntityFrameworkCore;

namespace ABRPOINT.Server.Repository
{
    public class DemCongeRepository : IDemCongeRepository
    {
        private readonly ApplicationDbContext _dbContext;
        private readonly IUtilisateurRepository _utilisateurRepository;
        private readonly IEmailService _emailService;
        public DemCongeRepository(ApplicationDbContext dbContext, IUtilisateurRepository utilisateurRepository, IEmailService emailService)
        {
            _dbContext = dbContext;
            _utilisateurRepository = utilisateurRepository;
            _emailService = emailService;
        }
        public async Task AddAsync(Demconge demconge)
        {
            try
            {
                await _dbContext.Demconges.AddAsync(demconge);
                await _dbContext.SaveChangesAsync();
                        var admins = await _utilisateurRepository.GetAdminsEmailsAsync();
                        foreach (var email in admins)
                        {
                            await _emailService.SendEmailAsync(email, "Nouvelle Demande de Congé",
                                $"Une nouvelle demande de congé a été déposée par l'employé {demconge.Empcod}.<br/>" +
                                $"Période : du {demconge.Condep:dd/MM/yyyy} au {demconge.Conret:dd/MM/yyyy}.");
                        }  
            }
            catch (Exception ex)
            {
                throw new Exception("",ex);
            }
        }

        public async Task DeleteAsync(Demconge demconge)
        {
            if (demconge != null)
            {
                _dbContext.Demconges.Remove(demconge);
                await _dbContext.SaveChangesAsync();
            }
        }

        public async Task<IEnumerable<Demconge>> GetAllAsync()
        {
            return await _dbContext.Demconges.ToListAsync();
        }

        public async Task<List<DemcongeEmpAbsDto>> GetDemongeWithAbsenceAsync(string soccod, string uticod)
        {
            try
            {
                var conges = await _dbContext.Conges
                    .Where(c => c.Soccod == soccod)
                    .ToListAsync();

                // Build the base query (IQueryable, not materialized yet)
                var query =
                    from c in _dbContext.Demconges
                    join a in _dbContext.Absences on c.Abscod equals a.Abscod
                    join e in _dbContext.Employes on c.Empcod equals e.Empcod
                    join su in _dbContext.Socusers
                        on new { e.Soccod, e.Sitcod } equals new { su.Soccod, su.Sitcod }
                    where c.Soccod == soccod
                        && su.Uticod == uticod
                    select new { c, a, e };

                // Conditionally filter by manager service code
                string? managerSercod = await GetManagerServiceCodeAsync(soccod, uticod);
                if (!string.IsNullOrEmpty(managerSercod))
                {
                    query = query.Where(x => x.e.Sercod == managerSercod);
                }

                // Now materialize with the final projection
                var rawResults = await query
                    .Select(x => new DemcongeEmpAbsDto
                    {
                        Soccod = x.c.Soccod,
                        Abscod = x.c.Abscod,
                        Conadr = x.c.Conadr,
                        Conamdep = x.c.Conamdep,
                        Conamret = x.c.Conamret,
                        Conjour = x.c.Conjour,
                        Consolde = x.c.Consolde,
                        Empcod = x.c.Empcod,
                        Contel = x.c.Contel,
                        Conref = x.c.Conref,
                        Conrefus = x.c.Conrefus,
                        Condg = x.c.Condg,
                        Concod = x.c.Concod,
                        Emplib = x.e.Emplib,
                        Condat = x.c.Condat,
                        Condep = x.c.Condep,
                        Conret = x.c.Conret,
                        Connbjour = x.c.Connbjour,
                        Abslib = x.a.Abslib,
                    })
                    .ToListAsync();

                var result = rawResults
                    .DistinctBy(c => new { c.Concod, c.Soccod })
                    .Select(c =>
                    {
                        var conge = conges.FirstOrDefault(x => x.Concod == c.Concod);
                        c.Etat = conge == null
                            ? "En attente"
                            : conge.Conrefus == "1"
                                ? "Refusé"
                                : "Accepté";
                        return c;
                    })
                    .OrderByDescending(c => c.Condat)
                    .ToList();

                return result;
            }
            catch (Exception)
            {
                throw;
            }
        }
        public async Task<Demconge?> GetByConcodAsync(string soccod, string concod)
        {
            try
            {
                return await _dbContext.Demconges.FindAsync(soccod, concod);
            }
            catch (Exception ex)
            {

                throw new Exception("Erreur innatendu: "+ ex);
            }
            
        }

        public async Task<List<DemcongeDto>> GetAllByPeriodAsync(string soccod, string uticod, DateTime datedebut, DateTime datefin)
        {
            try
            {
                var query =
                    from c in _dbContext.Demconges
                    join e in _dbContext.Employes on c.Empcod equals e.Empcod
                    join su in _dbContext.Socusers
                        on new { e.Soccod, e.Sitcod } equals new { su.Soccod, su.Sitcod }
                    where c.Soccod == soccod
                        && su.Uticod == uticod
                        && c.Condep >= datedebut
                        && c.Conret <= datefin
                    select new { c, e };

                string? managerSercod = await GetManagerServiceCodeAsync(soccod, uticod);
                if (!string.IsNullOrEmpty(managerSercod))
                {
                    query = query.Where(x => x.e.Sercod == managerSercod);
                }

                var rawResults = await query.Select(x => x.c).ToListAsync();

                // Fetch all relevant Conges records for the period
                var conges = await _dbContext.Conges
                    .Where(e => e.Soccod == soccod)
                    .ToListAsync();

                var result = rawResults
                    .DistinctBy(c => new { c.Concod, c.Soccod })
                    .OrderByDescending(c => c.Condat)
                    .Select(demconge =>
                    {
                        var conge = conges.FirstOrDefault(c => c.Concod == demconge.Concod);
                        string etat;
                        if (conge == null)
                            etat = "En attente";
                        else if (conge.Conrefus == "1")
                            etat = "Refusé";
                        else
                            etat = "Accepté";

                        return new DemcongeDto
                        {
                            Concod = demconge.Concod,
                            Soccod = demconge.Soccod,
                            Empcod = demconge.Empcod,
                            Condat = demconge.Condat,
                            Conjour = demconge.Conjour,
                            Condep = demconge.Condep,
                            Conamdep = demconge.Conamdep,
                            Conret = demconge.Conret,
                            Conamret = demconge.Conamret,
                            Abscod = demconge.Abscod,
                            Conadr = demconge.Conadr,
                            Contel = demconge.Contel,
                            Condg = demconge.Condg,
                            Conrefus = demconge.Conrefus,
                            Connbjour = demconge.Connbjour,
                            Conref = demconge.Conref,
                            Consolde = demconge.Consolde,
                            Etat = etat
                        };
                    })
                    .ToList();

                return result;
            }
            catch (Exception)
            {
                throw;
            }
        }

        public async Task<List<Demconge>> GetAllEnAttenteByPeriodAsync(string soccod, string uticod, DateTime datedebut, DateTime datefin)
        {
            try
            {
                // Étape 1 : Récupérer les codes employés accessibles par l'utilisateur
                var query =
                    from c in _dbContext.Demconges
                    join e in _dbContext.Employes on c.Empcod equals e.Empcod
                    join su in _dbContext.Socusers
                        on new { e.Soccod, e.Sitcod } equals new { su.Soccod, su.Sitcod }
                    where c.Soccod == soccod
                        && su.Uticod == uticod
                        && c.Condep >= datedebut
                        && c.Conret <= datefin
                    select new { c, e };

                // Étape 2 : Filtrer par service du manager si applicable
                string? managerSercod = await GetManagerServiceCodeAsync(soccod, uticod);
                if (!string.IsNullOrEmpty(managerSercod))
                {
                    query = query.Where(x => x.e.Sercod == managerSercod);
                }

                // Étape 3 : Exclure les demandes qui ont déjà un congé correspondant
                var result = await query
                    .Where(x =>
                        !_dbContext.Conges.Any(c =>
                            c.Soccod == x.c.Soccod &&
                            c.Empcod == x.c.Empcod &&
                            c.Condep == x.c.Condep &&
                            c.Conret == x.c.Conret))
                    .Select(x => x.c)
                    .Distinct()
                    .OrderByDescending(c => c.Condat)
                    .ToListAsync();

                return result;
            }
            catch (Exception)
            {
                throw;
            }
        }

        public async Task UpdateAsync(Demconge demconge)
        {
            try
            {
                if (demconge != null)
                {
                    Demconge? dbDemConge = await GetByConcodAsync(demconge.Soccod, demconge.Concod);
                    if(dbDemConge != null)
                    {
                        dbDemConge.Abscod = demconge.Abscod;
                        dbDemConge.Condep = demconge.Condep;
                        dbDemConge.Conref = demconge.Conref;
                        dbDemConge.Condat = demconge.Condat;
                        dbDemConge.Conadr = demconge.Conadr;
                        dbDemConge.Conamdep = demconge.Conamdep;
                        dbDemConge.Conamret = demconge.Conamret;
                        dbDemConge.Contel = demconge.Contel;
                        dbDemConge.Empcod = demconge.Empcod;
                        dbDemConge.Conjour = demconge.Conjour;
                        dbDemConge.Connbjour = demconge.Connbjour;
                    }
                    _dbContext.Demconges.Update(dbDemConge);
                    await _dbContext.SaveChangesAsync();
                }
            }
            catch (Exception ex)
            {

                throw new Exception("Erreur innatendu: "+ex);
            }
            
        }

        public async Task<(bool Success,string Message)> AcceptDemCongeAsync(string soccod,string concod,string empcod)
        {

                try
                {
                    // Find the DemConge by concod
                    var demConge = await _dbContext.Demconges.FindAsync(soccod, concod);
                    if (demConge == null)
                        return (false, $"Demande de cong avec le code {concod} introuvable.");

                    // Check if Conge already exists
                    bool congeExist = await _dbContext.Conges
                        .Where(c => c.Soccod == soccod && c.Concod == concod)
                        .AnyAsync();

                    if (congeExist)
                        return (false, $"Le cong {concod} a dj t accept.");
                    // Create a new Conge entity based on the DemConge
                    var conge = new Conge
                        {
                            Concod = demConge.Concod,
                            Soccod = demConge.Soccod,
                            Empcod = demConge.Empcod,
                            Abscod = demConge.Abscod,
                            Condat = demConge.Condat,
                            Condep = demConge.Condep,
                            Conret = demConge.Conret,
                            Conjour = demConge.Conjour,
                            Connbjour = demConge.Connbjour,
                            Consolde = demConge.Consolde,
                            Conref = demConge.Conref,
                            Conamdep = demConge.Conamdep,
                            Conamret = demConge.Conamret,
                            Conadr = demConge.Conadr,
                            Condg = demConge.Condg,
                            Contel = demConge.Contel,
                        };

                    // Add the Conge record to the Conges table
                    await _dbContext.Conges.AddAsync(conge);
                    // Save changes in a single transaction
                    await _dbContext.SaveChangesAsync();

                    // Notify Employee — synchrone : Task.Run capturait le DbContext scopé
                    // qui était disposé avant l'exécution → l'email n'était jamais envoyé.
                    try
                    {
                        var user = await _dbContext.Utilisateurs.FindAsync(demConge.Empcod);
                        if (user != null && !string.IsNullOrEmpty(user.Utimail))
                        {
                            await _emailService.SendEmailAsync(user.Utimail, "Demande de Congé Acceptée",
                                $"Bonjour,<br/><br/>Votre demande de congé pour la période du <b>{demConge.Condep:dd/MM/yyyy}</b> au <b>{demConge.Conret:dd/MM/yyyy}</b> a été <b>acceptée</b>.<br/><br/>Cordialement,<br/>L'équipe GestTemps");
                        }
                    }
                    catch { /* ne pas casser l'acceptation si l'email échoue */ }

                    return (true, $"Demande de cong {concod} accepte avec succs.");
                }
                catch (Exception ex)
                {
                    throw new Exception($"Error accepting DemConge: {ex.Message}", ex);
                }
        }

        public async Task<(bool Success,string Message)> RefuseDemCongeAsync(string soccod,string concod,string empcod)
        {
                try
                {
                    // Find the DemConge by concod
                    var demConge = await _dbContext.Demconges.FindAsync(soccod, concod);
                    if (demConge == null)
                        return (false, $"Demande de congé avec le code {concod} introuvable.");

                    // Check if Conge already exists
                    bool congeExist = await _dbContext.Conges
                        .Where(c => c.Soccod == soccod && c.Concod == concod)
                        .AnyAsync();

                    if (congeExist)
                        return (false, $"Le congé {concod} a déjà été traité.");

                    // Create a new Conge entity based on the DemConge with conrefus = 1
                    var conge = new Conge
                        {
                            Concod = demConge.Concod,
                            Soccod = demConge.Soccod,
                            Empcod = demConge.Empcod,
                            Abscod = demConge.Abscod,
                            Condat = demConge.Condat,
                            Condep = demConge.Condep,
                            Conret = demConge.Conret,
                            Conjour = demConge.Conjour,
                            Connbjour = demConge.Connbjour,
                            Consolde = demConge.Consolde,
                            Conref = demConge.Conref,
                            Conamdep = demConge.Conamdep,
                            Conamret = demConge.Conamret,
                            Conadr = demConge.Conadr,
                            Condg = demConge.Condg,
                            Contel = demConge.Contel,
                            Conrefus = "1",
                        };

                    // Add the Conge record to the Conges table
                    await _dbContext.Conges.AddAsync(conge);
                    // Save changes in a single transaction
                    await _dbContext.SaveChangesAsync();

                    // Notify Employee
                    
                            var user = await _dbContext.Utilisateurs.FindAsync(demConge.Empcod);
                            if (user != null && !string.IsNullOrEmpty(user.Utimail))
                            {
                                await _emailService.SendEmailAsync(user.Utimail, "Demande de Congé Refusée",
                                    $"Votre demande de congé pour la période du {demConge.Condep:dd/MM/yyyy} au {demConge.Conret:dd/MM/yyyy} a été <b>refusée</b>.");
                            }
                        

                    return (true, $"Demande de congé {concod} refusée avec succès.");
                }
                catch (Exception ex)
                {
                    throw new Exception($"Error refusing DemConge: {ex.Message}", ex);
                }
        }

        public async Task<List<DemcongeDto>> GetEmpDemcongeAsync(string soccod, string empcod)
        {
            try
            {
                var empconges = await _dbContext.Demconges
                    .Where(e => e.Soccod == soccod && e.Empcod == empcod)
                    .ToListAsync();

                var conges = await _dbContext.Conges
                    .Where(e => e.Soccod == soccod)
                    .ToListAsync();
                var result = empconges.Select(demconge =>
                {
                    var conge = conges.FirstOrDefault(c => c.Concod == demconge.Concod);

                    string etat;
                    if (conge == null)
                        etat = "En attente";
                    else if (conge.Conrefus == "1")
                        etat = "Refus�";
                    else
                        etat = "Accept�";

                    return new DemcongeDto
                    {
                        Concod = demconge.Concod,
                        Soccod = demconge.Soccod,
                        Empcod = demconge.Empcod,
                        Abscod = demconge.Abscod,
                        Conadr = demconge.Conadr,
                        Conamdep = demconge.Conamdep,
                        Conamret = demconge.Conamret,
                        Condat = demconge.Condat,
                        Condep = demconge.Condep,
                        Condg = demconge.Condg,
                        Conjour = demconge.Conjour,
                        Connbjour = demconge.Connbjour,
                        Conref = demconge.Conref,
                        Conret = demconge.Conret,
                        Contel = demconge.Contel,
                        Etat = etat
                    };
                }).ToList();

                return result;
            }
            catch (Exception)
            {
                throw;
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




