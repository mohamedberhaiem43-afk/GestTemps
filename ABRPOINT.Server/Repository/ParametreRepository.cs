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

        public async Task<ParametreMoisPointageDto> GetParametreMoisPointage(string soccod)
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

                // Si Sochsup == "L", ajuster Joudeb pour démarrer le lundi de la semaine
                if (result.Sochsup == "L" && int.TryParse(result.Joudeb, out int jourDeb))
                {
                    // Construire une date arbitraire (année/mois = 1/1) juste pour calculer le lundi
                    DateTime tempDate = new DateTime(2000, 1, jourDeb);

                    // Calculer combien de jours reculer pour atteindre lundi
                    int daysToMonday = ((int)tempDate.DayOfWeek + 6) % 7; // lundi = 0
                    tempDate = tempDate.AddDays(-daysToMonday-1);

                    result.Joudeb = tempDate.Day.ToString(); // mettre à jour le jour début
                }

                return result;
            }
            catch (Exception)
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
                    EliminerFerier = parametre.Parelimftrv
                };
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
                      
                //string jourRepos = await GetJourRepos(soccod); // e.g. "Dimanche", "SamDim"

                //if (jourRepos == "SamDim")
                //{
                //    return dayName == "Samedi" || dayName == "Dimanche";
                //}
                // Get the day name in French from predat
                string dayName = predat.Value.ToString("dddd", new System.Globalization.CultureInfo("fr-FR")); // e.g. "dimanche"
                dayName = char.ToUpper(dayName[0]) + dayName.Substring(1); // Capitalize: "Dimanche"
                if((dayName == "Lundi"&& poste?.Lunrepos == "1") ||(dayName == "Mardi"&& poste?.Marrepos == "1") 
                    ||(dayName == "Mercredi"&& poste?.Merrepos == "1") ||(dayName == "Jeudi"&& poste?.Jeurepos == "1")
                    ||(dayName == "Vendredi"&& poste?.Venrepos == "1") ||(dayName == "Samedi"&& poste?.Samrepos == "1") 
                    || (dayName == "Dimanche" && poste?.Dimrepos == "1"))
                {
                    return true;
                }

                return false;
                //return dayName == jourRepos;
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

        public Task<float?> GetNbhConge(string soccod)
        {
            try
            {
                var nbhconge =  _dbContext.Parametres.Where(p => p.Soccod == soccod).Select(p => p.Nbhconge).SingleOrDefaultAsync();
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
