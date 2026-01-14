using ABRPOINT.Helper;
using ABRPOINT.Server.Data;
using ABRPOINT.Server.Dtaos;
using ABRPOINT.Server.Exceptions;
using ABRPOINT.Server.Interfaces;
using ABRPOINT.Server.Models;
using AutoMapper;
using AutoMapper.QueryableExtensions;
using Microsoft.EntityFrameworkCore;

namespace ABRPOINT.Server.Repository
{
    public class PosteRepository : IPosteRepository
    {
        private readonly ApplicationDbContext _dbContext;
        private readonly IMapper _mapper;
        private readonly ILcategorieRepository _lcategorieRepository;

        // Inject the DbContext via constructor
        public PosteRepository(ApplicationDbContext dbContext,IMapper mapper, ILcategorieRepository lcategorieRepository)
        {
            _dbContext = dbContext;
            _mapper = mapper;
            _lcategorieRepository = lcategorieRepository;
        }

        // Add a new Poste entity to the database
        public void Add(Poste entity)
        {
            if (entity == null)
                throw new ArgumentNullException(nameof(entity));

            if (string.IsNullOrWhiteSpace(entity.Codposte))
                throw new ArgumentException(nameof(entity.Codposte));

            if (string.IsNullOrWhiteSpace(entity.Soccod))
                throw new ArgumentException(nameof(entity.Soccod));
            try
            {
                _dbContext.Postes.Add(entity);
                _dbContext.SaveChanges();
            }
            catch (Exception ex)
            {

                throw new RepositoryException("Erreur innatendu ",ex);
            }
            
        }

        // Delete a Poste entity from the database
        public void Delete(Poste entity)
        {
            if (entity == null)
                throw new ArgumentNullException(nameof(entity));
            
            try
            {
                _dbContext.Postes.Remove(entity);
                _dbContext.SaveChanges();
            }
            catch (Exception ex)
            {

                throw new RepositoryException("Erreur innatendu ",ex);
            }

            
        }
        public async Task DeleteAsync(Poste entity)
        {
            if (entity == null)
                throw new ArgumentNullException(nameof(entity));

            bool exist = await _dbContext.Employes
                .AnyAsync(e => e.Poscod == entity.Codposte);

            if (exist)
                throw new InvalidOperationException("Ce poste est déjà attribué à un employé et ne peut pas être supprimé.");

            _dbContext.Postes.Remove(entity);
            await _dbContext.SaveChangesAsync();
        }

        // Get all Poste entities from the database
        public IEnumerable<Poste> GetAll()
        {
            try
            {
                IEnumerable<Poste> postes = _dbContext.Postes.ToList();
                return postes;
            }
            catch (Exception ex)
            {
                throw new RepositoryException("Erreur innatendu ",ex);
            }
        }
        public async Task<IEnumerable<Poste>> GetEmpPostes(string? codposte)
        {
            try
            {
                IEnumerable<Poste> postes = await _dbContext.Postes.ToListAsync();
                return postes;
            }
            catch (Exception ex)
            {
                throw new RepositoryException("Erreur innatendu ",ex);
            }
            
        } 
       
        public async Task<Dictionary<string, string>> GetPostLibs(string soccod)
        {
            if(string.IsNullOrWhiteSpace(soccod))
                throw new ArgumentException("code societe est obligatoire ",nameof(soccod));
            try
            {
                Dictionary<string, string> postes = await _dbContext.Postes
                               .Where(p => p.Soccod == soccod)
                              .ToDictionaryAsync(abs => abs.Codposte, abs => abs.Libposte);

                return postes;
            }
            
            catch (Exception ex)
            {

                throw new RepositoryException("Erreur innatendu ",ex);
            }
           
        }

        public async Task<Poste?> GetPoste(string soccod, string? codposte)
        {
            if(string.IsNullOrWhiteSpace(soccod))
                throw new ArgumentException(nameof(soccod));
            if(string.IsNullOrWhiteSpace(codposte))
                throw new ArgumentException(nameof(codposte));

            try
            {
                Poste? poste = await _dbContext.Postes.FirstOrDefaultAsync(p => p.Soccod == soccod && p.Codposte == codposte);
                return poste;
            }
            catch (Exception ex)
            {

                throw new RepositoryException("Erreur innatendu",ex);
            }
            
        }
        public async Task<string?> GetEmpPoste(string soccod, string empcod, DateTime? date)
        {
            try
            {
                if (date == null)
                    return null;

                // Step 1: Get employee's category
                string? catcod = await _dbContext.Employes
                    .Where(emp => emp.Soccod == soccod && emp.Empcod == empcod)
                    .Select(emp => emp.Catcod)
                    .FirstOrDefaultAsync();

                if (string.IsNullOrEmpty(catcod))
                    return null;

                // Step 2: Get all valid poste ranges for the exact date
                var dateMonth = date.Value.Month;
                var dateDay = date.Value.Day;
                var matchingPostes = await _dbContext.Lcategories
                    .Where(c => c.Soccod == soccod &&
                                c.Catcod == catcod &&
                                c.Catdu.Value.Month <= dateMonth &&
                                c.Catau.Value.Month >= dateMonth)
                    .ToListAsync();

                var dateYear = date.Value.Year;
                if (!matchingPostes.Any(mp => mp.Catdu.Value.Year == dateYear || mp.Catau.Value.Year == dateYear))
                {
                    matchingPostes = matchingPostes.Where(mp => mp.Catfixe == "1").ToList();
                }
                if (!matchingPostes.Any())
                    return null;

                int targetMonth = date.Value.Month;

                Lcategorie posteWithMonthMatch = matchingPostes[0];
                foreach (var lcat in matchingPostes)
                {
                    if (targetMonth >= lcat.Catdu.Value.Month && targetMonth <= lcat.Catau.Value.Month
                        && posteWithMonthMatch.Catdu <= date && posteWithMonthMatch.Catau >= date)
                        posteWithMonthMatch = lcat;
                }
                // If found, return it
                if (posteWithMonthMatch != null)
                    return posteWithMonthMatch.Codposte;

                // Else, fall back to the first valid match
                return matchingPostes.First().Codposte;
            }
            catch (Exception)
            {
                throw;
            }
        }

        public async Task<bool> isExisting(string? soccod,string? codposte)
        {
            try
            {
                return await _dbContext.Postes.AnyAsync(p => p.Soccod == soccod && p.Codposte == codposte);
            }
            catch (Exception)
            {
                throw;
            }
        }

        // Update an existing Poste entity in the database
        public void Update(Poste entity)
        {
            if (entity == null)
                throw new ArgumentNullException(nameof(entity));

            try
            {
                _dbContext.Update(entity);
                _dbContext.SaveChanges();
            }
            catch (DbUpdateException dbEx)
            {
                throw new RepositoryException("",dbEx);
            }
            catch (Exception ex)
            {
                throw new RepositoryException("",ex);
            }
           
        }


        public async Task<float?> GetJourHeures(string soccod,DateTime? date, string? codposte)
        {
            Poste? poste = await GetPoste(soccod, codposte);
            if (poste == null) return 0;
            var (morningStartTime, morningEndTime, eveningStartTime, eveningEndTime) = GenericMethodes.GetStartsWorkDay(date, poste);
            float? repasTime = GenericMethodes.GetRepasWorkDay(date, poste);

            if (!TimeSpan.TryParse(morningStartTime, out var morningStart) || !TimeSpan.TryParse(morningEndTime, out var morningEnd) ||
                !repasTime.HasValue)
            {
                return 0;
            }
            TimeSpan workDuration;
            if (!TimeSpan.TryParse(eveningStartTime, out var eveningStart) || !TimeSpan.TryParse(eveningEndTime, out var eveningEnd))
            {
                workDuration = (morningEnd - morningStart) - TimeSpan.FromMinutes(repasTime.Value);
            }
            else
                workDuration = (morningEnd - morningStart) + (eveningEnd - eveningStart) - TimeSpan.FromMinutes(repasTime.Value);
            return (float?)workDuration.TotalHours;
        }

        public async Task<PosteHoraireDto?> GetPosteHoraire(string soccod, string codposte, string catcod)
        {
            try
            {
                PosteHoraireDto? poste = await _dbContext.Postes
                    .Where(p => p.Soccod == soccod && p.Codposte == codposte)
                    .ProjectTo<PosteHoraireDto>(_mapper.ConfigurationProvider)
                    .SingleOrDefaultAsync();

                if (poste == null) return null;

                var cat = await _lcategorieRepository.GetcatAsync(soccod,catcod);
                if (cat != null)
                {
                    poste.Catcod = cat.FirstOrDefault()?.Catcod;
                    poste.Cathsup = cat.FirstOrDefault()?.Cathsup;
                    poste.Catperiode = cat.FirstOrDefault()?.Catperiode;
                    poste.Catlib = cat.FirstOrDefault()?.Catlib;
                    poste.Catsem2 = cat.FirstOrDefault()?.Catsem2;
                    poste.Catsem3 = cat.FirstOrDefault()?.Catsem3;
                    poste.Catsem4 = cat.FirstOrDefault()?.Catsem4;
                    poste.Catsem5 = cat.FirstOrDefault()?.Catsem5;
                    poste.Catsem6 = cat.FirstOrDefault()?.Catsem6;
                }

                return poste;
            }
            catch (Exception)
            {
                throw;
            }
        }

        public async Task AddAsync(Poste poste)
        {
            try
            {
                await _dbContext.Postes.AddAsync(poste);
                await _dbContext.SaveChangesAsync();
            }
            catch (Exception)
            {
                throw;
            }
        }

        public async Task UpdateAsync(Poste poste)
        {
            try
            {
                var tracked = _dbContext.Postes.Local
                    .FirstOrDefault(p => p.Soccod == poste.Soccod && p.Codposte == poste.Codposte);

                if (tracked != null)
                {
                    _dbContext.Entry(tracked).State = EntityState.Detached;
                }
                if (poste != null)
                {
                    _dbContext.Postes.Update(poste);
                    // Now EF is already tracking dbPoste
                    await _dbContext.SaveChangesAsync();
                }
            }
            catch (Exception)
            {
                throw;
            }
        }

        public async Task<PosteHoraireDto?> GetAllPostes(string soccod, string codposte)
        {
            try
            {
                PosteHoraireDto? poste = await _dbContext.Postes
                    .Where(p => p.Soccod == soccod && p.Codposte == codposte)
                    .ProjectTo<PosteHoraireDto>(_mapper.ConfigurationProvider)
                    .SingleOrDefaultAsync();

                if (poste == null) return null;

                return poste;
            }
            catch (Exception)
            {
                throw;
            }
        }
    }
}
