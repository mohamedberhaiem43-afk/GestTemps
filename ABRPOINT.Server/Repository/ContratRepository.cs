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
                var employe = await GetEmployeAsync(contrat.Soccod, contrat.Empcod);
                if (employe == null)
                    throw new InvalidOperationException("L'employe du contrat est introuvable.");

                NormalizeContractDates(contrat);
                CopyEmployeFieldsToContract(contrat, employe);

                await _dbContext.Contrats.AddAsync(contrat);
                SyncEmployeContractDates(employe, contrat);
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

        public IEnumerable<Contrat> GetAll(string soccod, string srvcod, string sitcod, DateTime echdeb, DateTime echfin)
        {
            if (!string.IsNullOrEmpty(soccod))
            {
                return _dbContext.Contrats
                    .Where(e => e.Soccod == soccod && sitcod == e.Sitcod && srvcod == e.Sercod && e.Empemb >= echdeb && e.Empsort <= echfin)
                    .ToList();
            }

            return GetAll();
        }

        public IEnumerable<Contrat> GetAll(string soccod, string uticod, DateTime echdeb, DateTime echfin)
        {
            if (!string.IsNullOrEmpty(soccod) && !string.IsNullOrEmpty(uticod))
            {
                List<string> sitcods = _dbContext.Socusers
                    .Where(s => s.Soccod == soccod && s.Uticod == uticod)
                    .Select(s => s.Sitcod)
                    .ToList();

                return _dbContext.Contrats
                    .Where(e => e.Soccod == soccod && sitcods.Contains(e.Sitcod) && e.Empemb >= echdeb && e.Empsort <= echfin)
                    .ToList();
            }

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
                        || (c.Empsort.Value.Year == today.Year + 1 && today.Month == 12 && c.Empsort.Value.Month == 1)))
                .Select(c => new
                {
                    c.Concod,
                    c.Empcod,
                    c.Condat,
                    c.Empsort,
                    c.Empemb,
                })
                .ToList();

            return contrats;
        }

        public async Task<Contrat> GetByConcod(string soccod, string concod)
        {
            try
            {
                return await _dbContext.Contrats
                    .Where(s => s.Soccod == soccod && s.Concod == concod)
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
                            .SetProperty(c => c.Empmotif, contrat.Empmotif));
                }
            }
            catch (Exception)
            {
                throw;
            }
        }

        public async Task<Contrat> RenewAsync(RenouvellementContratDto renouvellement)
        {
            try
            {
                if (renouvellement.StartDate.Date > renouvellement.EndDate.Date)
                    throw new InvalidOperationException("La date de debut doit etre anterieure ou egale a la date de fin.");

                var sourceContract = await GetByConcod(renouvellement.Soccod, renouvellement.SourceConcod);
                if (sourceContract == null)
                    throw new InvalidOperationException("Le contrat source est introuvable.");

                var existingContract = await GetByConcod(renouvellement.Soccod, renouvellement.NewConcod);
                if (existingContract != null)
                    throw new InvalidOperationException("Le nouveau numero de contrat existe deja.");

                var monthNumber = renouvellement.MonthNumber ?? CalculateMonthSpan(renouvellement.StartDate, renouvellement.EndDate);
                var employe = await GetEmployeAsync(sourceContract.Soccod, sourceContract.Empcod);
                if (employe == null)
                    throw new InvalidOperationException("L'employe du contrat est introuvable.");

                var renewedContract = new Contrat
                {
                    Soccod = sourceContract.Soccod,
                    Concod = renouvellement.NewConcod,
                    Empcod = sourceContract.Empcod,
                    Condat = renouvellement.Condat.Date,
                    Contype = string.IsNullOrWhiteSpace(renouvellement.Contype) ? sourceContract.Contype : renouvellement.Contype,
                    Sitcod = sourceContract.Sitcod,
                    Sercod = sourceContract.Sercod,
                    Empreg = sourceContract.Empreg,
                    Catcod = sourceContract.Catcod,
                    Vilcod = sourceContract.Vilcod,
                    Empadr = sourceContract.Empadr,
                    Emppost = sourceContract.Emppost,
                    Emptel = sourceContract.Emptel,
                    Empemb = renouvellement.StartDate.Date,
                    Empsort = renouvellement.EndDate.Date,
                    Condg = sourceContract.Condg,
                    Empmotif = string.IsNullOrWhiteSpace(renouvellement.Empmotif) ? sourceContract.Empmotif : renouvellement.Empmotif,
                    Empdcin = sourceContract.Empdcin,
                    Empacin = sourceContract.Empacin,
                    Quacod = sourceContract.Quacod,
                    Empech = sourceContract.Empech,
                    Empelon = sourceContract.Empelon,
                    Empcat = sourceContract.Empcat,
                    Empscat = sourceContract.Empscat,
                    Cnscod = sourceContract.Cnscod,
                    Empsbase = sourceContract.Empsbase,
                    Empsbrut = sourceContract.Empsbrut,
                    Socresp = sourceContract.Socresp,
                    Dircod = sourceContract.Dircod,
                    Empcontrat = string.IsNullOrWhiteSpace(renouvellement.Empcontrat) ? sourceContract.Empcontrat : renouvellement.Empcontrat,
                    Conmois = monthNumber
                };

                NormalizeContractDates(renewedContract);
                CopyEmployeFieldsToContract(renewedContract, employe);

                await _dbContext.Contrats.AddAsync(renewedContract);
                SyncEmployeContractDates(employe, renewedContract);
                await _dbContext.SaveChangesAsync();

                return renewedContract;
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
                var result = await (
                    from c in _dbContext.Contrats
                    join su in _dbContext.Socusers on new { c.Soccod, c.Sitcod } equals new { su.Soccod, su.Sitcod }
                    where c.Soccod == soccod && su.Uticod == uticod
                    select c).ToListAsync();

                return result;
            }
            catch (Exception)
            {
                throw;
            }
        }

        public async Task<IEnumerable<Contrat>> SearchAsync(string soccod, string uticod, string? srvcod, string? sitcod, DateTime? echdeb, DateTime? echfin)
        {
            try
            {
                if (string.IsNullOrWhiteSpace(soccod) || string.IsNullOrWhiteSpace(uticod))
                    return Enumerable.Empty<Contrat>();

                var query =
                    from c in _dbContext.Contrats
                    join su in _dbContext.Socusers on new { c.Soccod, c.Sitcod } equals new { su.Soccod, su.Sitcod }
                    where c.Soccod == soccod && su.Uticod == uticod
                    select c;

                if (!string.IsNullOrWhiteSpace(sitcod))
                    query = query.Where(c => c.Sitcod == sitcod);

                if (!string.IsNullOrWhiteSpace(srvcod))
                    query = query.Where(c => c.Sercod == srvcod);

                if (echdeb.HasValue)
                    query = query.Where(c => c.Empemb.HasValue && c.Empemb.Value.Date >= echdeb.Value.Date);

                if (echfin.HasValue)
                    query = query.Where(c => c.Empsort.HasValue && c.Empsort.Value.Date <= echfin.Value.Date);

                return await query
                    .OrderByDescending(c => c.Empsort)
                    .ThenByDescending(c => c.Condat)
                    .ToListAsync();
            }
            catch (Exception)
            {
                throw;
            }
        }
        public async Task<List<EcheanceContrat>> GetEcheanceContratsByDate(string soccod, DateTime echdeb, DateTime echfin, string uticod)
        {
            try
            {
                var result = await (
                    from s in _dbContext.Societes
                    join e in _dbContext.Employes on s.Soccod equals e.Soccod
                    join c in _dbContext.Contrats on e.Empcod equals c.Empcod
                    join su in _dbContext.Socusers on new { e.Soccod, e.Sitcod } equals new { su.Soccod, su.Sitcod }
                    where s.Soccod == soccod && c.Condat >= echdeb && c.Condat <= echfin && su.Uticod == uticod
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
                    }).ToListAsync();

                return result;
            }
            catch (Exception)
            {
                throw;
            }
        }

        private static float CalculateMonthSpan(DateTime startDate, DateTime endDate)
        {
            return ((endDate.Year - startDate.Year) * 12) + endDate.Month - startDate.Month + 1;
        }

        private async Task<Employe?> GetEmployeAsync(string soccod, string empcod)
        {
            return await _dbContext.Employes
                .FirstOrDefaultAsync(e => e.Soccod == soccod && e.Empcod == empcod);
        }

        private static void NormalizeContractDates(Contrat contrat)
        {
            contrat.Condat = contrat.Condat?.Date;
            contrat.Empemb = contrat.Empemb?.Date;
            contrat.Empsort = contrat.Empsort?.Date;
        }

        private static void CopyEmployeFieldsToContract(Contrat contrat, Employe employe)
        {
            contrat.Catcod = employe.Catcod;
            contrat.Sercod = employe.Sercod;
            contrat.Empreg = employe.Empreg;
            contrat.Vilcod = employe.Vilcod;
            contrat.Empadr = employe.Empadr;
            contrat.Emppost = employe.Poscod;
            contrat.Emptel = employe.Emptel;
            contrat.Empdcin = employe.Empdcin;
            contrat.Dircod = employe.Dircod;
        }

        private static void SyncEmployeContractDates(Employe employe, Contrat contrat)
        {
            employe.Empemb = contrat.Empemb;
            employe.Empsort = contrat.Empsort;
        }
    }
}


