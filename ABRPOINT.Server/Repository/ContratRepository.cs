using ABRPOINT.Server.Data;
using ABRPOINT.Server.Dtaos;
using ABRPOINT.Server.Interfaces;
using ABRPOINT.Server.Models;
using Microsoft.EntityFrameworkCore;
using System.Threading.Tasks;

namespace ABRPOINT.Server.Repository
{
    public class ContratRepository : IContratRepository
    {
        private readonly ApplicationDbContext _dbContext;
        private readonly IUtilisateurRepository _utilisateurRepository;
        public ContratRepository(ApplicationDbContext dbContext, IUtilisateurRepository utilisateurRepository)
        {
            _dbContext = dbContext;
            _utilisateurRepository = utilisateurRepository;

        }
        public void Add(Contrat contrat)
        {
            try
            {
                _dbContext.Contrats.Add(contrat);
                _dbContext.SaveChanges();
            }
            catch (Exception)
            {
                throw;
            }
        }
        public async Task AddAsync(Contrat contrat)
        {
            try
            {
                await _dbContext.Contrats.AddAsync(contrat);
                await _dbContext.SaveChangesAsync();
            }
            catch (Exception)
            {
                throw;
            }
        }



        public void Delete(Contrat contrat)
        {
            if (contrat != null)
            {
                _dbContext.Contrats.Remove(contrat);
                _dbContext.SaveChanges();
            }
        }
        public async Task DeleteAsync(Contrat contrat)
        {
            try
            {
                if (contrat != null)
                {
                    _dbContext.Contrats.Remove(contrat);
                    await _dbContext.SaveChangesAsync();
                }
            }
            catch (Exception)
            {
                throw;
            }
        }

        public IEnumerable<Contrat> GetAll()
        {
            return _dbContext.Contrats.ToList();
        }
        public IEnumerable<Contrat> GetAll(string soccod,string srvcod,string sitcod,
            DateTime echdeb, DateTime echfin)
        {
            // Check if soccod and uticod have values
            if (!string.IsNullOrEmpty(soccod))
            {

                // Filter Employes based on soccod and sitcods list
                return _dbContext.Contrats
                    .Where(
                            e => e.Soccod == soccod && sitcod == e.Sitcod && srvcod == e.Sercod
                            && e.Empemb >= echdeb && e.Empsort <= echfin
                           )
                    .ToList();
            }

            // If soccod or uticod is null/empty, return all Employes
            return GetAll();
        } 
        public IEnumerable<Contrat> GetAll(string soccod, string uticod,DateTime echdeb,DateTime echfin)
        {
            // Check if soccod and uticod have values
            if (!string.IsNullOrEmpty(soccod) && !string.IsNullOrEmpty(uticod))
            {
                // Retrieve the list of sitcods associated with the provided soccod and uticod
                List<string> sitcods = _dbContext.Socusers
                   .Where(s => s.Soccod == soccod && s.Uticod == uticod)
                   .Select(s => s.Sitcod)
                   .ToList();

                // Filter Employes based on soccod and sitcods list
                return _dbContext.Contrats
                    .Where(e => e.Soccod == soccod && sitcods.Contains(e.Sitcod) && e.Empemb >=echdeb && e.Empsort <= echfin)
                    .ToList();
            }

            // If soccod or uticod is null/empty, return all Employes
            return GetAll();
        }

        public IEnumerable<object> GetEcheanceContrats(string soccod, string uticod)
        {
            List<string> sitcods = _dbContext.Socusers
                   .Where(s => s.Soccod == soccod && s.Uticod == uticod)
                   .Select(s => s.Sitcod)
                   .ToList();

            DateTime today = DateTime.Today;
            var contrats = _dbContext.Contrats
                .Where(c => c.Soccod == soccod
                            && sitcods.Contains(c.Sitcod)
                            && c.Empsort.HasValue
                            && ((c.Empsort.Value.Year == today.Year && (c.Empsort.Value.Month == today.Month + 1 || c.Empsort.Value.Month == today.Month))
                                || (c.Empsort.Value.Year == today.Year + 1 && today.Month == 12 && c.Empsort.Value.Month == 1))
                            
                                )
                .Select(c => new
                {
                    c.Concod,
                    c.Empcod,
                    c.Condat,
                    c.Empsort,       // Assuming `empsort` is the field for 'date'
                    c.Empemb,   // Assuming `empemb` is the field for 'datedebut'
                })
                .ToList();

            return contrats;
        }


        public async Task<Contrat> GetByConcod(string soccod, string concod)
        {
            try
            {
                return await _dbContext.Contrats.Where(s => s.Soccod == soccod && s.Concod == concod )
                    .SingleOrDefaultAsync();
            }
            catch (Exception)
            {
                throw;
            }
        }

        public void Update(Contrat employe)
        {
            if (employe != null)
            {
                _dbContext.Contrats.Update(employe);
                _dbContext.SaveChanges();
            }
        }
        public async Task UpdateAsync(Contrat contrat)
        {
            try
            {
                if (contrat != null)
                {
                    await _dbContext.Contrats
                        .Where(c => c.Soccod == contrat.Soccod && c.Concod == contrat.Concod)
                        .ExecuteUpdateAsync(setters => setters
                            .SetProperty(c => c.Condat, contrat.Condat)
                            .SetProperty(c => c.Empemb, contrat.Empemb)
                            .SetProperty(c => c.Empsort, contrat.Empsort)
                            .SetProperty(c => c.Contype, contrat.Contype)
                            .SetProperty(c => c.Empcontrat, contrat.Empcontrat)
                            .SetProperty(c => c.Conmois, contrat.Conmois)
                            .SetProperty(c => c.Condg, contrat.Condg)
                            .SetProperty(c => c.Empmotif, contrat.Empmotif)
                        );
                }
            }
            catch (Exception)
            {
                throw;
            }
        }

        public async Task<IEnumerable<Contrat>> GetAll(string soccod, string uticod)
        {
            try
            {
                // Utiliser une jointure avec Socusers au lieu de Contains
                var result = await (
                    from c in _dbContext.Contrats
                    join su in _dbContext.Socusers
                        on new { c.Soccod, c.Sitcod } equals new { su.Soccod, su.Sitcod }
                    where c.Soccod == soccod
                        && su.Uticod == uticod
                    select c
                ).ToListAsync();

                return result;
            }
            catch (Exception ex)
            {
                throw;
            }
        }

        public async Task<List<EcheanceContrat>> GetEcheanceContratsByDate(string soccod, DateTime echdeb, DateTime echfin, string uticod)
        {
            try
            {
                // Utiliser une jointure avec Socusers au lieu de Contains
                var result = await (
                    from s in _dbContext.Societes
                    join e in _dbContext.Employes on s.Soccod equals e.Soccod
                    join c in _dbContext.Contrats on e.Empcod equals c.Empcod
                    join su in _dbContext.Socusers
                        on new { e.Soccod, e.Sitcod } equals new { su.Soccod, su.Sitcod }
                    where s.Soccod == soccod
                        && c.Condat >= echdeb
                        && c.Condat <= echfin
                        && su.Uticod == uticod
                    select new EcheanceContrat
                    {
                        Soccod = s.Soccod,
                        Concod = c.Concod,
                        Sitcod = e.Sitcod,
                        Empmat = e.Empmat,
                        Emplib = e.Emplib,
                        Condat = c.Condat.HasValue ? c.Condat.Value.Date : (DateTime?)null,
                        Empemb = e.Empemb.HasValue ? e.Empemb.Value.Date : (DateTime?)null,
                        Empsort = e.Empsort.HasValue ? e.Empsort.Value.Date : (DateTime?)null
                    }
                ).ToListAsync();

                return result;
            }
            catch (Exception ex)
            {
                throw;
            }
        }
    }
}
