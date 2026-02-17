using ABRPOINT.Server.Data;
using ABRPOINT.Server.Dtaos;
using ABRPOINT.Server.Interfaces;
using ABRPOINT.Server.Models;
using AutoMapper;
using AutoMapper.QueryableExtensions;
using Microsoft.EntityFrameworkCore;
using System.Globalization;

namespace ABRPOINT.Server.Repository
{
    public class ParametreRepository : IParametreRepository
    {
        private readonly ApplicationDbContext _dbContext;
        private readonly IPosteRepository _posteRepository;
        private readonly IMapper _mapper;
        public ParametreRepository(ApplicationDbContext dbContext,IPosteRepository posteRepository,IMapper mapper)
        {
            _dbContext = dbContext;
            _posteRepository = posteRepository;
            _mapper = mapper;
        }
        public void Add(Parametre entity)
        {
            throw new NotImplementedException();
        }

        public void Delete(Parametre entity)
        {
            throw new NotImplementedException();
        }
        public async Task<Dictionary<DateTime, bool>> GetReposDaysByPeriod(string soccod, string empcod, List<DateTime> dates)
        {
            try
            {
                var result = new Dictionary<DateTime, bool>();

                if (!dates.Any())
                    return result;

                // Get employee's repos preference
                string? empferepos = await _dbContext.Employes
                    .Where(e => e.Soccod == soccod && e.Empcod == empcod)
                    .Select(e => e.Empferepos)
                    .FirstOrDefaultAsync();

                // If "Sans Compter" (0), no days are repos
                if (empferepos == "0")
                {
                    foreach (var date in dates)
                    {
                        result[date.Date] = false;
                    }
                    return result;
                }

                // Get employee's postes for the period
                var startDate = dates.Min();
                var endDate = dates.Max();
                var postesByDate = await GetEmpPostesByPeriod(soccod, empcod, startDate, endDate);

                // Get unique postes
                var uniquePostes = postesByDate.Values.Distinct().ToList();

                // Load all postes data
                var postesData = await _dbContext.Postes
                    .Where(p => p.Soccod == soccod && uniquePostes.Contains(p.Codposte))
                    .ToDictionaryAsync(p => p.Codposte);

                // Check each date
                foreach (var date in dates)
                {
                    bool isRepos = false;

                    if (postesByDate.TryGetValue(date.Date, out var codposte) &&
                        postesData.TryGetValue(codposte, out var poste))
                    {
                        var dayOfWeek = date.DayOfWeek;

                        // Check based on empferepos setting
                        if (empferepos == "1") // Tout Repos
                        {
                            isRepos = dayOfWeek switch
                            {
                                DayOfWeek.Monday => poste.Lunrepos == "1",
                                DayOfWeek.Tuesday => poste.Marrepos == "1",
                                DayOfWeek.Wednesday => poste.Merrepos == "1",
                                DayOfWeek.Thursday => poste.Jeurepos == "1",
                                DayOfWeek.Friday => poste.Venrepos == "1",
                                DayOfWeek.Saturday => poste.Samrepos == "1",
                                DayOfWeek.Sunday => poste.Dimrepos == "1",
                                _ => false
                            };
                        }
                        else if (empferepos == "2") // Repos Samedi uniquement
                        {
                            isRepos = dayOfWeek == DayOfWeek.Saturday && poste.Samrepos == "1";
                        }
                        else if (empferepos == "3") // Repos Dimanche uniquement
                        {
                            isRepos = dayOfWeek == DayOfWeek.Sunday && poste.Dimrepos == "1";
                        }
                    }

                    result[date.Date] = isRepos;
                }

                return result;
            }
            catch (Exception)
            {
                throw;
            }
        }
        // Helper method to get postes for period
        private async Task<Dictionary<DateTime, string>> GetEmpPostesByPeriod(string soccod, string empcod, DateTime startDate, DateTime endDate)
        {
            // Get employee's category
            string? catcod = await _dbContext.Employes
                .Where(emp => emp.Soccod == soccod && emp.Empcod == empcod)
                .Select(emp => emp.Catcod)
                .FirstOrDefaultAsync();

            if (string.IsNullOrEmpty(catcod))
                return new Dictionary<DateTime, string>();

            // Get all lcategories for this employee's category
            var lcategories = await _dbContext.Lcategories
                .Where(l => l.Soccod == soccod && l.Catcod == catcod)
                .ToListAsync();

            if (!lcategories.Any())
                return new Dictionary<DateTime, string>();

            // Build dictionary for each date in range
            var result = new Dictionary<DateTime, string>();
            DateTime currentDate = startDate.Date;

            while (currentDate <= endDate.Date)
            {
                var month = currentDate.Month;
                var year = currentDate.Year;

                var validMonth = lcategories
                    .Where(l => l.Catdu.HasValue && l.Catau.HasValue &&
                               l.Catdu.Value.Month <= month &&
                               l.Catau.Value.Month >= month)
                    .ToList();

                if (!validMonth.Any(l => l.Catdu!.Value.Year == year || l.Catau!.Value.Year == year))
                {
                    validMonth = validMonth.Where(l => l.Catfixe == "1").ToList();
                }

                if (validMonth.Any())
                {
                    var selected = validMonth.First();
                    foreach (var l in validMonth)
                    {
                        if (currentDate >= l.Catdu && currentDate <= l.Catau)
                        {
                            selected = l;
                            break;
                        }
                    }

                    if (!string.IsNullOrEmpty(selected.Codposte))
                    {
                        result[currentDate] = selected.Codposte;
                    }
                }

                currentDate = currentDate.AddDays(1);
            }

            return result;
        }

        public Parametre GetAll(string soccod)
        {
            try
            {
                var parametres = _dbContext.Parametres
                                    .Where(p => p.Soccod == soccod).SingleOrDefault();
                return parametres;
            }
            catch (Exception ex)
            {

                throw new Exception("Erreur innatendu: "+ex);
            }
        }
        public async Task<ParametreNuitDto> GetParametresNuitAsync(string soccod)
        {
            try
            {
                var result = await _dbContext.Parametres
                    .Where(p => p.Soccod == soccod)
                    .Select(p => new ParametreNuitDto
                    {
                        RepasNuit = p.Repasnuit,
                        MinHeureNuit = p.Nbhtr4M,
                        CompterNuit = p.Parnuit,
                        PasCompterNuitSiSortieJour =p.Parjhsfixe,
                        MajoreNuitAuxNormal = p.Nbhtr4,
                        Nuitdeb = p.Nuitdeb,
                        Nuitfin = p.Nuitfin
                    })
                    .SingleOrDefaultAsync();

                return result;
            }
            catch (Exception ex)
            {
                throw new Exception("Erreur lors de la récupération des paramètres de nuit: " + ex.Message, ex);
            }
        }


        public IEnumerable<Parametre> GetAll()
        {
            throw new NotImplementedException();
        }
        public async Task<int> GetParancemp(string soccod)
        {
             
            string? parancemp = await _dbContext.Parametres
                .Where(p => p.Soccod == soccod)
                .Select(p => p.Parancemp)
                .SingleOrDefaultAsync();
            if(parancemp != null)
                return int.Parse(parancemp);
            return 0;
        }

        public async Task<ParametreMoisPointageDto?> GetParametreMoisPointage(string soccod)
        {
            try
            {
                var result = await (
                    from p in _dbContext.Parametres
                    join s in _dbContext.Societes on p.Soccod equals s.Soccod
                    where p.Soccod == soccod
                    select new ParametreMoisPointageDto
                    {
                        Joudeb = p.Joudeb,
                        Joufin = p.Joufin,
                        Moisdeb = p.Moisdeb,
                        Moisfin = p.Moisfin,
                        Nbhconge = p.Nbhconge,
                        Socpresence = s.Socpresence,
                        Sochsup = s.Sochsup
                    }
                ).FirstOrDefaultAsync();

                if (result == null)
                    return null;

                // --- DebutReel ---
                if (!int.TryParse(result.Joudeb, out int jourDebReel))
                    jourDebReel = 1; // valeur par défaut si parse échoue

                result.DebutReel = jourDebReel;

                // --- DebutCalc (ajusté si Sochsup = "L") ---
                DateTime tempDate = new DateTime(2000, 1, jourDebReel);

                if (result.Sochsup == "L")
                {
                    int daysToMonday = ((int)tempDate.DayOfWeek + 6) % 7;
                    tempDate = tempDate.AddDays(-daysToMonday);
                }

                result.DebutCalc = tempDate.Day-1;

                return result;
            }
            catch
            {
                throw;
            }
        }
        public async Task<ParametrePresenceCalculDto?> GetParametresPresenceCalcul(string soccod)
        {
            try
            {
                var result = await (
                    from p in _dbContext.Parametres
                    join s in _dbContext.Societes on p.Soccod equals s.Soccod
                    where p.Soccod == soccod
                    select new ParametrePresenceCalculDto
                    {
                        Joudeb = p.Joudeb,
                        Joufin = p.Joufin,
                        Moisdeb = p.Moisdeb,
                        Moisfin = p.Moisfin,
                        Nbhconge = p.Nbhconge,
                        Socpresence = s.Socpresence,
                        Sochsup = s.Sochsup,
                        Arrondi = p.Arrondi ?? 0f,
                        Arrhsup = p.Arrhsup
                    }
                ).FirstOrDefaultAsync();

                if (result == null)
                    return null;

                // --- DebutReel ---
                if (!int.TryParse(result.Joudeb?.ToString(), out int jourDebReel))
                    jourDebReel = 1;

                result.DebutReel = jourDebReel;

                // --- DebutCalc (ajusté si Sochsup = "L") ---
                DateTime tempDate = new DateTime(2000, 1, jourDebReel);

                if (result.Sochsup == "L")
                {
                    int daysToMonday = ((int)tempDate.DayOfWeek + 6) % 7;
                    tempDate = tempDate.AddDays(-daysToMonday);
                }

                result.DebutCalc = tempDate.Day - 1;

                return result;
            }
            catch
            {
                throw;
            }
        }




        public void Update(Parametre entity)
        {
            throw new NotImplementedException();
        }

        public async Task<bool> DroitHeureSupp(string soccod,string empniv)
        {
            try
            {
                Parametre? parametre = await _dbContext.Parametres.Where(p => p.Soccod == soccod).SingleOrDefaultAsync();
                if (parametre?.Parcadre == "0" && empniv == "2" || parametre?.Parmaitrise == "0" && empniv == "1" || parametre?.Parexec == "0" && empniv == "0")
                    return false;

                return true;
            }
            catch (Exception)
            {
                throw;
            }
        }

        public async Task<string> GetJourRepos(string soccod)
        {
            try
            {
                string? jourRepos = await _dbContext.Parametres.Where(p => p.Soccod == soccod).Select(p => p.Jourrepos).SingleOrDefaultAsync();
                return jourRepos;
            }
            catch (Exception)
            {
                throw;
            }
        }

        public async Task<SuppAndFerierParam> GetSuppAndFerierParam(string soccod, string empniveau)
        {
            try
            {
                var parametre = await _dbContext.Parametres
                    .Where(p => p.Soccod == soccod)
                    .SingleOrDefaultAsync();

                if (parametre == null)
                {
                    return new SuppAndFerierParam
                    {
                        HasSupp = false,
                        MaxFerier = 0
                    };
                }
                //float nbFerier = await _ferierRepository.GetNbJours(soccod);
                bool hasSupp = !(parametre.Parcadre == "0" && empniveau == "2" ||
                                 parametre.Parmaitrise == "0" && empniveau == "1" ||
                                 parametre.Parexec == "0" && empniveau == "0");

                return new SuppAndFerierParam
                {
                    HasSupp = hasSupp,
                    MaxFerier = parametre.Parmaxfer,
                    EliminerFerier = parametre.Parelimftrv,
                    Parreptrv = parametre.Parreptrv,
                    MajNuitNorm = parametre.Nbhtr4,
                };
            }
            catch (Exception)
            {
                throw;
            }
        }

        public async Task<bool> IsEmpfeRepos(string soccod, DateTime? predat, string codpost, string empferepos)
        {
            try
            {
                if (predat == null)
                    return false;

                // Si "Sans Compter" (0), aucun jour n'est considéré comme repos
                if (empferepos == "0")
                    return false;

                Poste? poste = await _posteRepository.GetPoste(soccod, codpost);

                // Get the day name in French from predat
                string dayName = predat.Value.ToString("dddd", new System.Globalization.CultureInfo("fr-FR"));
                dayName = char.ToUpper(dayName[0]) + dayName.Substring(1); // Capitalize

                // Option 1: Tout Repos - vérifier tous les jours selon le poste
                if (empferepos == "1")
                {
                    if ((dayName == "Lundi" && poste?.Lunrepos == "1") ||
                        (dayName == "Mardi" && poste?.Marrepos == "1") ||
                        (dayName == "Mercredi" && poste?.Merrepos == "1") ||
                        (dayName == "Jeudi" && poste?.Jeurepos == "1") ||
                        (dayName == "Vendredi" && poste?.Venrepos == "1") ||
                        (dayName == "Samedi" && poste?.Samrepos == "1") ||
                        (dayName == "Dimanche" && poste?.Dimrepos == "1"))
                    {
                        return true;
                    }
                }
                // Option 2: Repos Samedi uniquement
                else if (empferepos == "2")
                {
                    if (dayName == "Samedi" && poste?.Samrepos == "1")
                    {
                        return true;
                    }
                }
                // Option 3: Repos Dimanche uniquement
                else if (empferepos == "3")
                {
                    if (dayName == "Dimanche" && poste?.Dimrepos == "1")
                    {
                        return true;
                    }
                }

                return false;
            }
            catch (Exception)
            {
                throw;
            }
        }
        
        public async Task<(bool,string)> IsEmpcodRepos(string soccod, DateTime? predat, string codpost, string empcod)
        {
            try
            {
                if (predat == null)
                    return (false,"");
                string? empferepos = await _dbContext.Employes
                    .Where(e => e.Soccod == soccod && e.Empcod == empcod)
                    .Select(e => e.Empferepos)
                    .SingleOrDefaultAsync();
                // Si "Sans Compter" (0), aucun jour n'est considéré comme repos
                if (empferepos == "0")
                    return (false, empferepos);

                Poste? poste = await _posteRepository.GetPoste(soccod, codpost);

                // Get the day name in French from predat
                string dayName = predat.Value.ToString("dddd", new System.Globalization.CultureInfo("fr-FR"));
                dayName = char.ToUpper(dayName[0]) + dayName.Substring(1); // Capitalize

                // Option 1: Tout Repos - vérifier tous les jours selon le poste
                if (empferepos == "1")
                {
                    if ((dayName == "Lundi" && poste?.Lunrepos == "1") ||
                        (dayName == "Mardi" && poste?.Marrepos == "1") ||
                        (dayName == "Mercredi" && poste?.Merrepos == "1") ||
                        (dayName == "Jeudi" && poste?.Jeurepos == "1") ||
                        (dayName == "Vendredi" && poste?.Venrepos == "1") ||
                        (dayName == "Samedi" && poste?.Samrepos == "1") ||
                        (dayName == "Dimanche" && poste?.Dimrepos == "1"))
                    {
                        return (true,empferepos);
                    }
                }
                // Option 2: Repos Samedi uniquement
                else if (empferepos == "2")
                {
                    if (dayName == "Samedi" && poste?.Samrepos == "1")
                    {
                        return (true,empferepos);
                    }
                }
                // Option 3: Repos Dimanche uniquement
                else if (empferepos == "3")
                {
                    if (dayName == "Dimanche" && poste?.Dimrepos == "1")
                    {
                        return (true, empferepos);
                    }
                }

                return (false,"-1");
            }
            catch (Exception)
            {
                throw;
            }
        }
        
        public async Task<bool> IsRepos(string soccod, DateTime? predat, string codpost)
        {
            try
            {
                if (predat == null)
                    return false;

                Poste? poste = await _posteRepository.GetPoste(soccod, codpost);

                // Get the day name in French from predat
                string dayName = predat.Value.ToString("dddd", new System.Globalization.CultureInfo("fr-FR"));
                dayName = char.ToUpper(dayName[0]) + dayName.Substring(1); // Capitalize

                    if ((dayName == "Lundi" && poste?.Lunrepos == "1") ||
                        (dayName == "Mardi" && poste?.Marrepos == "1") ||
                        (dayName == "Mercredi" && poste?.Merrepos == "1") ||
                        (dayName == "Jeudi" && poste?.Jeurepos == "1") ||
                        (dayName == "Vendredi" && poste?.Venrepos == "1") ||
                        (dayName == "Samedi" && poste?.Samrepos == "1") ||
                        (dayName == "Dimanche" && poste?.Dimrepos == "1"))
                    {
                        return true;
                    }

                return false;
            }
            catch (Exception)
            {
                throw;
            }
        }
        
        public async Task<bool> UpdateParametres(Parametre updatedParam)
        {
            try
            {
                var param = await _dbContext.Parametres
                    .FirstOrDefaultAsync(p => p.Soccod == updatedParam.Soccod);
                if (param != null)
                {
                    _dbContext.Entry(param).State = EntityState.Detached;
                    _dbContext.Parametres.Update(updatedParam);
                    await _dbContext.SaveChangesAsync();
                }
                return true;
            }
            catch (Exception ex)
            {
                throw new Exception($"Failed to update Parametre with Soccod: {updatedParam.Soccod}", ex);
            }
        }

        public async Task<EtatPresenceParametreDto> GetEtatPresenceParametres(string soccod)
        {
            try
            {
               var param = await _dbContext.Parametres.ProjectTo<EtatPresenceParametreDto>(_mapper.ConfigurationProvider)
                    .Where(p => p.Soccod == soccod)
                    .FirstOrDefaultAsync();
                return param;
            }
            catch (Exception)
            {
                throw;
            }
        }

        public async Task<short?> GetLongbdg(string soccod)
        {
            try
            {
                var longbdg = await _dbContext.Parametres.Where(p => p.Soccod == soccod).Select(p => p.Longbdg).FirstOrDefaultAsync();
                return longbdg;
            }
            catch (Exception)
            {
                throw;
            }
        }
        public async Task<ArrondiParam?> GetEtatPeriodiqueParamAsync(string soccod)
        {
            try
            {
                // Récupération du paramètre pour la société
                var param = await _dbContext.Parametres
                    .Where(p => p.Soccod == soccod)
                    .Select(p => new ArrondiParam
                    {
                        Arrhsup = p.Arrhsup,
                        Arrondi = p.Arrondi
                    })
                    .FirstOrDefaultAsync();

                return param;
            }
            catch (Exception ex)
            {
                throw;
            }
        }


        public async Task<string> GetPaie(string soccod)
        {
            try
            {
                string? paie = await _dbContext.Parametres.Where(p=>p.Soccod ==soccod).Select(p=>p.Paie).SingleOrDefaultAsync();
                return paie;
            }
            catch (Exception)
            {
                throw;
            }
        }

        public async Task<float?> GetNbhConge(string soccod)
        {
            try
            {
                var nbhconge = await  _dbContext.Parametres.Where(p => p.Soccod == soccod).Select(p => p.Nbhconge).SingleOrDefaultAsync();
                return nbhconge;
            }
            catch (Exception)
            {
                throw;
            }
        }
        public Task<int?> GetNbhFerier(string soccod)
        {
            try
            {
                var nbhferier =  _dbContext.Parametres.Where(p => p.Soccod == soccod).Select(p => p.Nbhferier).SingleOrDefaultAsync();
                return nbhferier;
            }
            catch (Exception)
            {
                throw;
            }
        }

        public async Task<Dictionary<string, float>> GetTotheureCongeParPeriode(string soccod, List<string> empcods, DateTime? debut, DateTime? fin)
        {
            float? nbhconge = await GetNbhConge(soccod);
            if (!nbhconge.HasValue)
                return new Dictionary<string, float>();

            // 1️⃣ Récupérer les données brutes depuis la base
            var congesData = await _dbContext.Conges
                .Where(c =>
                    c.Soccod == soccod &&
                    empcods.Contains(c.Empcod) &&
                    (!debut.HasValue || c.Condat >= debut.Value) &&
                    (!fin.HasValue || c.Condat <= fin.Value))
                .Select(c => new
                {
                    c.Empcod,
                    c.Conjour  // ✅ Récupérer la valeur string brute
                })
                .ToListAsync();

            // 2️⃣ Parser en mémoire (côté client)
            var conges = congesData
                .Select(c => new
                {
                    c.Empcod,
                    Coef = float.TryParse(
                        c.Conjour,
                        NumberStyles.Any,
                        CultureInfo.InvariantCulture,
                        out var coef)
                        ? coef
                        : 1f
                })
                .ToList();

            // 3️⃣ Grouper et calculer
            return conges
                .GroupBy(c => c.Empcod)
                .ToDictionary(
                    g => g.Key,
                    g => g.Sum(x => x.Coef) * nbhconge.Value
                );
        }

    }
}
