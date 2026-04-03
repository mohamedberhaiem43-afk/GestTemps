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
        public async Task<Dictionary<DateTime, float>> GetJourHeuresByPeriod(string soccod,List<DateTime> ferierDates,Dictionary<DateTime, string> postesByDate)
        {
            try
            {
                var result = new Dictionary<DateTime, float>();

                if (!ferierDates.Any())
                    return result;

                // Group ferier dates by poste
                var feriersByPoste = ferierDates
                    .Where(d => postesByDate.ContainsKey(d))
                    .GroupBy(d => postesByDate[d])
                    .ToDictionary(g => g.Key, g => g.ToList());

                // Get unique postes
                var uniquePostes = feriersByPoste.Keys.ToList();

                // Load all postes
                var postes = await _dbContext.Postes
                    .Where(p => p.Soccod == soccod && uniquePostes.Contains(p.Codposte))
                    .ToDictionaryAsync(p => p.Codposte);

                // Calculate hours for each ferier date
                foreach (var kvp in feriersByPoste)
                {
                    var posteCode = kvp.Key;
                    var dates = kvp.Value;

                    if (!postes.TryGetValue(posteCode, out var poste))
                        continue;

                    foreach (var date in dates)
                    {
                        //float hours = GetDayHours(poste, date.DayOfWeek);
                        float? hours = await GetJourHeures(soccod, date, posteCode);
                        result[date.Date] = (float)hours;
                    }
                }

                return result;
            }
            catch (Exception)
            {
                throw;
            }
        }
        //private float GetDayHours(Poste poste, DayOfWeek dayOfWeek)
        //{
        //    string hoursStr = dayOfWeek switch
        //    {
        //        DayOfWeek.Monday => poste.Nblundi,
        //        DayOfWeek.Tuesday => poste.Nbmardi,
        //        DayOfWeek.Wednesday => poste.Nbmercredi,
        //        DayOfWeek.Thursday => poste.Nbjeudi,
        //        DayOfWeek.Friday => poste.Nbvendredi,
        //        DayOfWeek.Saturday => poste.Nbsamedi,
        //        DayOfWeek.Sunday => poste.Nbdimanche,
        //        _ => null
        //    };

        //    return ParseHours(hoursStr);
        //}



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
        public async Task<string?> GetEmpPoste(string soccod, string empcod, DateTime? date,string? catcod)
        {
            try
            {
                if (date == null)
                    return null;

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


        public async Task<float?> GetJourHeures(string soccod, DateTime? date, string? codposte)
        {
            Poste? poste = await GetPoste(soccod, codposte);
            if (poste == null) return 0;

            var (morningStartTime, morningEndTime, eveningStartTime, eveningEndTime) =
                GenericMethodes.GetStartsWorkDay(date, poste);
            float? repasTime = GenericMethodes.GetRepasWorkDay(date, poste);

            if (!TimeSpan.TryParse(morningStartTime, out var morningStart) ||
                !TimeSpan.TryParse(morningEndTime, out var morningEnd) ||
                !repasTime.HasValue)
            {
                return 0;
            }

            TimeSpan workDuration;

            // Handle night shift for morning period (crosses midnight)
            TimeSpan morningDuration = morningEnd > morningStart
                ? morningEnd - morningStart
                : (morningEnd + TimeSpan.FromHours(24)) - morningStart;

            if (!TimeSpan.TryParse(eveningStartTime, out var eveningStart) ||
                !TimeSpan.TryParse(eveningEndTime, out var eveningEnd))
            {
                workDuration = morningDuration - TimeSpan.FromMinutes(repasTime.Value);
            }
            else
            {
                // Handle night shift for evening period (crosses midnight)
                TimeSpan eveningDuration = eveningEnd > eveningStart
                    ? eveningEnd - eveningStart
                    : (eveningEnd + TimeSpan.FromHours(24)) - eveningStart;

                workDuration = morningDuration + eveningDuration - TimeSpan.FromMinutes(repasTime.Value);
            }

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

        public async Task<Dictionary<string, string?>> GetEmpPosteBatch(string soccod,List<(string Empcod, DateTime Date)> demandes)
        {
            if (string.IsNullOrWhiteSpace(soccod))
                throw new ArgumentException(nameof(soccod));

            if (demandes == null || !demandes.Any())
                return new Dictionary<string, string?>();

            // =========================
            // 1️⃣ Catégories employés
            // =========================
            var empcods = demandes.Select(d => d.Empcod).Distinct().ToList();

            var empCategories = await _dbContext.Employes
                .Where(e => e.Soccod == soccod && empcods.Contains(e.Empcod))
                .Select(e => new { e.Empcod, e.Catcod })
                .ToDictionaryAsync(x => x.Empcod, x => x.Catcod);

            // =========================
            // 2️⃣ Lcategories concernées
            // =========================
            var catcods = empCategories.Values
                .Where(c => !string.IsNullOrEmpty(c))
                .Distinct()
                .ToList();

            var lcategories = await _dbContext.Lcategories
                .Where(l =>
                    l.Soccod == soccod &&
                    catcods.Contains(l.Catcod))
                .ToListAsync();

            // =========================
            // 3️⃣ Calcul en mémoire
            // =========================
            var result = new Dictionary<string, string?>();

            foreach (var d in demandes)
            {
                if (!empCategories.TryGetValue(d.Empcod, out var catcod) ||
                    string.IsNullOrEmpty(catcod))
                {
                    result[d.Empcod] = null;
                    continue;
                }

                var candidates = lcategories
                    .Where(l => l.Catcod == catcod)
                    .ToList();

                if (!candidates.Any())
                {
                    result[d.Empcod] = null;
                    continue;
                }

                var date = d.Date;
                var month = date.Month;
                var year = date.Year;

                // 🔹 Filtrage mois
                var validMonth = candidates
                    .Where(l =>
                        l.Catdu.HasValue && l.Catau.HasValue &&
                        l.Catdu.Value.Month <= month &&
                        l.Catau.Value.Month >= month)
                    .ToList();

                // 🔹 Filtrage année / Catfixe
                if (!validMonth.Any(l =>
                        l.Catdu!.Value.Year == year ||
                        l.Catau!.Value.Year == year))
                {
                    validMonth = validMonth
                        .Where(l => l.Catfixe == "1")
                        .ToList();
                }

                if (!validMonth.Any())
                {
                    result[d.Empcod] = null;
                    continue;
                }

                // 🔹 Sélection finale
                var selected = validMonth.First();

                foreach (var l in validMonth)
                {
                    if (date >= l.Catdu && date <= l.Catau)
                    {
                        selected = l;
                        break;
                    }
                }

                result[d.Empcod] = selected.Codposte;
            }

            return result;
        }
        
        public async Task<Dictionary<(string Empcod, DateTime Date), string?>> GetEmployePosteBatch(string soccod,string empcod,DateTime debut,DateTime fin)
        {
            if (string.IsNullOrWhiteSpace(soccod))
                throw new ArgumentException(nameof(soccod));

            // 1️⃣ Créer toutes les dates de la période
            var demandes = new List<(string Empcod, DateTime Date)>();
            for (var date = debut.Date; date <= fin.Date; date = date.AddDays(1))
            {
                demandes.Add((empcod, date));
            }

            if (!demandes.Any())
                return new Dictionary<(string, DateTime), string?>();

            // =========================
            // 2️⃣ Récupérer la catégorie de l'employé
            // =========================
            var empCategory = await _dbContext.Employes
                .Where(e => e.Soccod == soccod && e.Empcod == empcod)
                .Select(e => e.Catcod)
                .FirstOrDefaultAsync();

            if (string.IsNullOrEmpty(empCategory))
                return demandes.ToDictionary(d => d, d => (string?)null);

            // =========================
            // 3️⃣ Récupérer les lcategories concernées
            // =========================
            var lcategories = await _dbContext.Lcategories
                .Where(l => l.Soccod == soccod && l.Catcod == empCategory)
                .ToListAsync();

            // =========================
            // 4️⃣ Calcul en mémoire pour toutes les dates
            // =========================
            var result = new Dictionary<(string Empcod, DateTime Date), string?>();

            foreach (var d in demandes)
            {
                var date = d.Date;
                var month = date.Month;
                var year = date.Year;

                // 🔹 Filtrer par mois
                var validMonth = lcategories
                    .Where(l => l.Catdu.HasValue && l.Catau.HasValue &&
                                l.Catdu.Value.Month <= month &&
                                l.Catau.Value.Month >= month)
                    .ToList();

                // 🔹 Filtrer par année ou Catfixe
                if (!validMonth.Any(l => l.Catdu!.Value.Year == year || l.Catau!.Value.Year == year))
                {
                    validMonth = validMonth.Where(l => l.Catfixe == "1").ToList();
                }

                if (!validMonth.Any())
                {
                    result[d] = null;
                    continue;
                }

                // 🔹 Sélection finale
                var selected = validMonth.First();
                foreach (var l in validMonth)
                {
                    if (date >= l.Catdu && date <= l.Catau)
                    {
                        selected = l;
                        break;
                    }
                }

                result[d] = selected.Codposte;
            }

            return result;
        }


        public async Task<Dictionary<string, Poste>> GetPostesBatch(string soccod, List<string> codPostes)
        {
            if (string.IsNullOrWhiteSpace(soccod))
                throw new ArgumentException(nameof(soccod));

            if (codPostes == null || !codPostes.Any())
                return new Dictionary<string, Poste>();

            // ===============================
            // 1️⃣ Charger postes en batch
            // ===============================
            var postes = await _dbContext.Postes
                .Where(p => p.Soccod == soccod && codPostes.Contains(p.Codposte))
                .ToListAsync();

            // ===============================
            // 2️⃣ Convertir en dictionnaire
            // ===============================
            var result = postes.ToDictionary(
                p => p.Codposte,
                p => p);

            return result;
        }

        public async Task<PosteRetard> GetPostRetard(string soccod,string codposte)
        {
            try
            {
                var posteretard = await _dbContext.Postes.Where(p=>p.Soccod == soccod && p.Codposte == codposte)
                    .Select(posteretard => new PosteRetard
                {
                    Retmin = posteretard.Retmin,
                    Retminam = posteretard.Retminam,
                    Retsanc = posteretard.Retsanc,
                    Retsancam = posteretard.Retsancam,
                    Avamn = posteretard.Avamn,
                    Avabon = posteretard.Avabon,
                }).FirstOrDefaultAsync();
                return posteretard;
            }
            catch (Exception)
            {
                throw;
            }
        }
    }
}
