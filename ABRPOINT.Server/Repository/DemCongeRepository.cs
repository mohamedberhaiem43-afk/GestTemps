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
        public DemCongeRepository(ApplicationDbContext dbContext, IUtilisateurRepository utilisateurRepository)
        {
            _dbContext = dbContext;
            _utilisateurRepository = utilisateurRepository;

        }
        public void Add(Demconge demconge)
        {
            try
            {
                _dbContext.Demconges.Add(demconge);
                _dbContext.SaveChanges();
            }
            catch (Exception ex)
            {

                throw new Exception("",ex);
            }
            
        }

        public void Delete(Demconge demconge)
        {
            if (demconge != null)
            {
                _dbContext.Demconges.Remove(demconge);
                _dbContext.SaveChanges();
            }
        }

        public IEnumerable<Demconge> GetAll()
        {
            return _dbContext.Demconges.ToList();
        }

        public async Task<List<DemcongeEmpAbsDto>> GetDemongeWithAbsenceAsync(string soccod, string uticod)
        {
            try
            {
                var conges = await _dbContext.Conges
                    .Where(c => c.Soccod == soccod)
                    .ToListAsync();

                var rawResults = await (
                    from c in _dbContext.Demconges
                    join a in _dbContext.Absences on c.Abscod equals a.Abscod
                    join e in _dbContext.Employes on c.Empcod equals e.Empcod
                    join su in _dbContext.Socusers
                        on new { e.Soccod, e.Sitcod } equals new { su.Soccod, su.Sitcod }
                    where c.Soccod == soccod
                        && su.Uticod == uticod
                    select new DemcongeEmpAbsDto
                    {
                        Soccod = c.Soccod,
                        Abscod = c.Abscod,
                        Conadr = c.Conadr,
                        Conamdep = c.Conamdep,
                        Conamret = c.Conamret,
                        Conjour = c.Conjour,
                        Consolde = c.Consolde,
                        Empcod = c.Empcod,
                        Contel = c.Contel,
                        Conref = c.Conref,
                        Conrefus = c.Conrefus,
                        Condg = c.Condg,
                        Concod = c.Concod,
                        Emplib = e.Emplib,
                        Condat = c.Condat,
                        Condep = c.Condep,
                        Conret = c.Conret,
                        Connbjour = c.Connbjour,
                        Abslib = a.Abslib,
                    }).ToListAsync();

                var result = rawResults
                    .DistinctBy(c => new { c.Concod, c.Soccod })
                    .Select(c =>
                    {
                        var conge = conges.FirstOrDefault(x => x.Concod == c.Concod && x.Empcod == c.Empcod);
                        c.Etat = conge == null
                            ? "En attente"
                            : conge.Conrefus == "1"
                                ? "Refus�"
                                : "Accept�";
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
        public Demconge GetByConcod(string soccod, string concod)
        {
            try
            {
                return _dbContext.Demconges.Find(soccod, concod);
            }
            catch (Exception ex)
            {

                throw new Exception("Erreur innatendu: "+ ex);
            }
            
        }
        public async Task<List<Demconge>> GetAllByPeriod(string soccod, string uticod, DateTime datedebut, DateTime datefin)
        {
            try
            {
                var rawResults = await (
                    from c in _dbContext.Demconges
                    join e in _dbContext.Employes on c.Empcod equals e.Empcod
                    join su in _dbContext.Socusers
                        on new { e.Soccod, e.Sitcod } equals new { su.Soccod, su.Sitcod }
                    where c.Soccod == soccod
                        && su.Uticod == uticod
                        && c.Condep >= datedebut
                        && c.Conret <= datefin
                    select c
                ).ToListAsync();

                var result = rawResults
                    .DistinctBy(c => new { c.Concod, c.Soccod })
                    .OrderByDescending(c => c.Condat)
                    .ToList();

                return result;
            }
            catch (Exception ex)
            {
                throw;
            }
        }



        public void Update(Demconge demconge)
        {
            try
            {
                if (demconge != null)
                {
                    Demconge dbDemConge = GetByConcod(demconge.Soccod, demconge.Concod);
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
                    _dbContext.SaveChanges();
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
                        return (false, $"Demande de cong� avec le code {concod} introuvable.");

                    // Check if Conge already exists
                    bool congeExist = await _dbContext.Conges
                        .Where(c => c.Soccod == soccod && c.Concod == concod)
                        .AnyAsync();

                    if (congeExist)
                        return (false, $"Le cong� {concod} a d�j� �t� accept�.");
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

                    return (true, $"Demande de cong� {concod} accept�e avec succ�s.");
                }
                catch (Exception ex)
                {
                    throw new Exception($"Error accepting DemConge: {ex.Message}", ex);
                }
        }

        public async Task<List<DemcongeDto>> GetEmpDemconge(string soccod, string empcod)
        {
            try
            {
                var empconges = await _dbContext.Demconges
                    .Where(e => e.Soccod == soccod && e.Empcod == empcod)
                    .ToListAsync();

                var conges = await _dbContext.Conges
                    .Where(e => e.Soccod == soccod && e.Empcod == empcod)
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
    }
}




