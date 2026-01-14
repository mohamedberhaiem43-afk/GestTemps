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
                // Utiliser une jointure avec Socusers au lieu de Contains
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

                // Dédoublonnage + tri en mémoire
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

        public async Task<bool> AcceptDemCongeAsync(string soccod,string concod)
        {

                try
                {
                    // Find the DemConge by concod
                    var demConge = await _dbContext.Demconges.FindAsync(soccod,concod);
                    if (demConge == null)
                        return false; // Return false if DemConge is not found

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
                        Connbjour = demConge.Connbjour,
                    };

                    // Add the Conge record to the Conges table
                    await _dbContext.Conges.AddAsync(conge);
                    // Save changes in a single transaction
                    await _dbContext.SaveChangesAsync();

                    return true;
                }
                catch (Exception ex)
                {
                    throw new Exception($"Error accepting DemConge: {ex.Message}", ex);
                }

        }

     
    }
}