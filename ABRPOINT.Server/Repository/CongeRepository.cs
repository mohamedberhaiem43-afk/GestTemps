using ABRPOINT.Server.Data;
using ABRPOINT.Server.Dtaos;
using ABRPOINT.Server.Interfaces;
using ABRPOINT.Server.Models;
using Microsoft.EntityFrameworkCore;
using System.Globalization;

namespace ABRPOINT.Server.Repository
{
    public class CongeRepository : ICongeRepository
    {
        private readonly ApplicationDbContext _dbContext;
        private readonly IJourFerieRepository _ferierRepository;
        private readonly IParametreRepository _parametreRepository;
        private readonly IUtilisateurRepository _utilisateurRepository;
        private readonly IPosteRepository _posteRepository;
        public CongeRepository(ApplicationDbContext dbContext,IJourFerieRepository ferieRepository,
            IPosteRepository posteRepository, IParametreRepository parametreRepository, IUtilisateurRepository utilisateurRepository)
        {
            _dbContext = dbContext;
            _ferierRepository = ferieRepository;
            _parametreRepository = parametreRepository;
            _posteRepository = posteRepository;
            _utilisateurRepository = utilisateurRepository;

        }
        public void Add(Conge conge)
        {
            _dbContext.Conges.Add(conge);
            _dbContext.SaveChanges();
        }

        public void Delete(Conge conge)
        {
            if (conge != null)
            {
                _dbContext.Conges.Remove(conge);
                _dbContext.SaveChanges();
            }
        }
        
        public IEnumerable<Conge> GetAll()
        {
            return _dbContext.Conges.ToList();
        }
        public async Task<List<CongeAbsenceDto>> GetCongeWithAbsenceAsync(string soccod, string uticod)
        {
            try
            {
                List<string> sitcods = await _utilisateurRepository.GetSitcodsAccess(soccod, uticod);

                // Exécuter la requête côté base de données
                List<CongeAbsenceDto> rawResult = await (from c in _dbContext.Conges
                                                         join a in _dbContext.Absences on c.Abscod equals a.Abscod
                                                         join e in _dbContext.Employes on c.Empcod equals e.Empcod
                                                         where sitcods.Contains(e.Sitcod)
                                                         select new CongeAbsenceDto
                                                         {
                                                             Concod = c.Concod,
                                                             Emplib = e.Emplib,
                                                             Condat = c.Condat,
                                                             Condep = c.Condep,
                                                             Conret = c.Conret,
                                                             Connbjour = c.Connbjour,
                                                             Abslib = a.Abslib,
                                                             Soccod = e.Soccod
                                                         }).ToListAsync();

                // Traitement en mémoire
                List<CongeAbsenceDto> result = rawResult
                    .Where(c => c.Soccod == soccod)
                    .DistinctBy(c => new { c.Concod, c.Soccod })
                    .OrderByDescending(c => c.Condat)
                    .ToList();

                return result;
            }
            catch (Exception ex)
            {
                // Facultatif : gérer l’erreur ici
                throw;
            }
        }

        public Conge GetByConcod(string soccod, string concod)
        {
            try
            {
                return _dbContext.Conges.Find(soccod, concod);
            }
            catch (Exception ex)
            {

                throw new Exception("Erreur innatendu: " +ex);
            }
        }
        public async Task<NombreConge> GetNbJourEtHreEmpConge(string soccod, string empcod, DateTime? predat,string codpost)
        {
            try
            {
                NombreConge nombreConge = new NombreConge();
                var predatAdj = predat?.AddTicks(1); // ou AddMilliseconds(1)

                var result = await (
                    from cng in _dbContext.Conges
                    join abs in _dbContext.Absences on cng.Abscod equals abs.Abscod
                    where cng.Soccod == soccod
                        && cng.Empcod == empcod
                        && predat >= cng.Condep
                        && predatAdj < cng.Conret
                    select new
                    {
                        cng.Concod,
                        cng.Condep,
                        cng.Conret,
                        cng.Conjour,
                        cng.Conamdep,
                        cng.Conamret,
                        abs.Absrepos,
                        abs.Absferier,
                        abs.Abspayer,
                        cng.Connbjour
                    }
                ).FirstOrDefaultAsync();

                bool dayRepos = await _dbContext.Presences
                                .Where(p => p.Predat == predat && p.Soccod == soccod &&
                                p.Codposte == codpost && p.Empcod == empcod && p.Prerepos == "1")
                                .AnyAsync();
                if (result != null && result.Abspayer == "O")
                {
                    bool isFerier = await _ferierRepository.IsFerier(soccod, predat);
                    bool isRepos = await _parametreRepository.IsRepos(soccod,predat,codpost);
                    if ((result.Absrepos == "N" && isRepos && dayRepos) || (result.Absferier == "0" && isFerier))
                        return new NombreConge { nbHeureConge = 0, nbJourConge = 0 };

                    nombreConge.nbJourConge = result.Connbjour;
                    Poste? poste = await _posteRepository.GetPoste(soccod, codpost);
                    nombreConge.nbHeureConge = CalculerHeureTravailJour(predat, poste);
                    nombreConge.Concod = result.Concod;
                    return nombreConge;
                }

                return nombreConge;
            }
            catch (Exception)
            {
                throw;
            }
        }
        private float CalculerHeureTravailJour(DateTime? predat, Poste poste)
        {
            string jour = predat.Value.ToString("dddd", new CultureInfo("fr-FR")).ToLower(); // "lundi", "mardi", etc.
            string? hdMat = null, hfMat = null, hdAm = null, hfAm = null;

            switch (jour)
            {
                case "lundi":
                    hdMat = poste?.Lunhdmat;
                    hfMat = poste?.Lunhfmat;
                    hdAm = poste?.Lunhdam;
                    hfAm = poste?.Lunhfam;
                    break;
                case "mardi":
                    hdMat = poste?.Marhdmat;
                    hfMat = poste?.Marhfmat;
                    hdAm = poste?.Marhdam;
                    hfAm = poste?.Marhfam;
                    break;
                case "mercredi":
                    hdMat = poste?.Merhdmat;
                    hfMat = poste?.Merhfmat;
                    hdAm = poste?.Merhdam;
                    hfAm = poste?.Merhfam;
                    break;
                case "jeudi":
                    hdMat = poste?.Jeuhdmat;
                    hfMat = poste?.Jeuhfmat;
                    hdAm = poste?.Jeuhdam;
                    hfAm = poste?.Jeuhfam;
                    break;
                case "vendredi":
                    hdMat = poste?.Venhdmat;
                    hfMat = poste?.Venhfmat;
                    hdAm = poste?.Venhdam;
                    hfAm = poste?.Venhfam;
                    break;
                case "samedi":
                    hdMat = poste?.Samhdmat;
                    hfMat = poste?.Samhfmat;
                    hdAm = poste?.Samhdam;
                    hfAm = poste?.Samhfam;
                    break;
                case "dimanche":
                    hdMat = poste?.Dimhdmat;
                    hfMat = poste?.Dimhfmat;
                    hdAm = poste?.Dimhdam;
                    hfAm = poste?.Dimhfam;
                    break;
            }

            float totalHeures = 0;

            if (TimeSpan.TryParse(hdMat, out var entreMatin) && TimeSpan.TryParse(hfMat, out var sortieMatin))
                totalHeures += (float)(sortieMatin - entreMatin).TotalHours;

            if (TimeSpan.TryParse(hdAm, out var entreAprem) && TimeSpan.TryParse(hfAm, out var sortieAprem))
                totalHeures += (float)(sortieAprem - entreAprem).TotalHours;

            return totalHeures;
        }


        public async Task<Conge> GetEmpConge(string soccod, string empcod, DateTime? predat)
        {
            try
            {
                var conge = await _dbContext.Conges.Where(cng => cng.Soccod == soccod && cng.Empcod == empcod &&
                                                                            predat >= cng.Condep && predat < cng.Conret)
                                                                            .SingleOrDefaultAsync();
                return conge;
            }
            catch (Exception)
            {
                throw;
            }
        }


        public void Update(Conge conge)
        {
            if (conge != null)
            {
                Conge dbConge = GetByConcod(conge.Soccod, conge.Concod);
                if (dbConge != null)
                {
                    // Detach the existing entity to avoid tracking conflicts
                    _dbContext.Entry(dbConge).State = EntityState.Detached;
                    dbConge.Conret = conge.Conret;
                    dbConge.Abscod = conge.Abscod;
                    dbConge.Condep = conge.Condep;
                    dbConge.Conref = conge.Conref;
                    dbConge.Condat = conge.Condat;
                    dbConge.Conadr = conge.Conadr;
                    dbConge.Conamdep = conge.Conamdep;
                    dbConge.Conamret = conge.Conamret;
                    dbConge.Contel = conge.Contel;
                    dbConge.Empcod = conge.Empcod;
                    dbConge.Condg = conge.Condg;
                    dbConge.Conjour = conge.Conjour;
                    dbConge.Connbjour = conge.Connbjour;
                }
                _dbContext.Conges.Update(conge);
                _dbContext.SaveChanges();
            }
        }
        // Add multiple conges at once
        public async Task AddMultiple(List<Conge> conges)
        {
            if (conges != null && conges.Any())
            {
                await _dbContext.Conges.AddRangeAsync(conges);
                await _dbContext.SaveChangesAsync();
            }
        }

        public async Task<string> GetCongeLib(string? soccod, string empcod, DateTime dmdate)
        {
            try
            {
                var abslib = await (from s in _dbContext.Conges
                                    join a in _dbContext.Absences
                                        on new { s.Soccod, s.Abscod } equals new { a.Soccod, a.Abscod }
                                    where s.Soccod == soccod
                                          && s.Empcod == empcod
                                          && s.Condep <= dmdate
                                          && (s.Conamret == "1" ? s.Conret >= dmdate : s.Conret > dmdate)
                                    select a.Abslib)
                                  .FirstOrDefaultAsync();
                return abslib;
            }
            catch (Exception)
            {
                throw;
            }
        }

        public async Task<DroitCongeDto> GetDroitConge(string soccod, string empcod, DateTime? datedebut, DateTime? datefin)
        {
            try
            {
                float? NbCongeRecus = await _dbContext.Conges
                    .Where(c => c.Soccod == soccod && c.Empcod == empcod &&
                                c.Condep >= datedebut && c.Conret <= datefin)
                    .SumAsync(c => c.Connbjour);

                float? solde = await _dbContext.Sites
                    .Where(p => p.Soccod == soccod)
                    .Select(p => p.Sitconge)
                    .FirstOrDefaultAsync();

                var empdata = await _dbContext.Employes
                    .Where(emp => emp.Soccod == soccod && emp.Empcod == empcod)
                    .Select(emp => new { emp.Empmat, emp.Emplib, emp.Empreg, emp.Empemb })
                    .FirstOrDefaultAsync();

                float? empsanctions = await _dbContext.Sanctions
                    .Where(s => s.Soccod == soccod && s.Empcod == empcod &&
                                s.Condep >= datedebut && s.Conret <= datefin)
                    .SumAsync(s => s.Connbjour);

                // Monthly breakdown of sanctions
                var sanctionsPerMonth = await _dbContext.Sanctions
                    .Where(s => s.Soccod == soccod && s.Empcod == empcod &&
                                s.Condep >= datedebut && s.Conret <= datefin)
                    .GroupBy(s => s.Condep!.Value.Month)
                    .Select(g => new
                    {
                        Month = g.Key, // 1 = Jan, 2 = Feb, ...
                        TotalDays = g.Sum(x => x.Connbjour)
                    })
                    .ToListAsync();
                // Regroupement des congés reçus par mois
                var congesParMois = await _dbContext.Conges
                    .Where(c => c.Soccod == soccod && c.Empcod == empcod &&
                                c.Condep >= datedebut && c.Conret <= datefin)
                    .GroupBy(c => c.Condep!.Value.Month)
                    .Select(g => new
                    {
                        Month = g.Key,
                        TotalDays = g.Sum(c => c.Connbjour)
                    })
                    .ToListAsync();
                // Dictionnaire de congés par mois
                var nbCongeRecuParMois = congesParMois.ToDictionary(
                    x => new DateTime(2000, x.Month, 1).ToString("MMMM", new CultureInfo("fr-FR")),
                    x => x.TotalDays
                );
                // Create dictionary with formatted month names
                var nbAbsenceParMois = sanctionsPerMonth.ToDictionary(
                    x => new DateTime(2000, x.Month, 1).ToString("MMMM", new CultureInfo("fr-FR")), // month name in French
                    x => x.TotalDays
                );

                DroitCongeDto droitConge = new DroitCongeDto()
                {
                    Annee = datedebut?.Year.ToString(),
                    Empmat = empdata?.Empmat,
                    Emplib = empdata?.Emplib,
                    Empemb = empdata?.Empemb,
                    Empreg = empdata?.Empreg,
                    Nbcongerecu = NbCongeRecus,
                    Soldeinit = solde,
                    Droitrestant = solde - NbCongeRecus,
                    Nbabsences = empsanctions,
                    Nbabsenceparmois = nbAbsenceParMois,
                    Nbcongerecuparmois = nbCongeRecuParMois
                };

                return droitConge;
            }
            catch (Exception)
            {
                throw;
            }
        }

        public async Task<float> GetNbCongeRecue(string soccod, string empcod, string annee, string currentMonth)
        {
            try
            {
                int year = int.Parse(annee);
                int month = int.Parse(currentMonth);

                var totalConge = await _dbContext.Conges
                    .Where(c =>
                        c.Soccod == soccod &&
                        c.Empcod == empcod &&
                        c.Condep.HasValue &&
                        c.Condep.Value.Year == year &&
                        c.Condep.Value.Month == month)
                    .SumAsync(c => c.Connbjour ?? 0);

                return totalConge;
            }
            catch (Exception)
            {
                throw;
            }
        }

        public async Task<List<CahierConge>> GetCahierConge(string soccod, DateTime datedebut, DateTime datefin, List<string> empcods)
        {
            try
            {
                List<CahierConge> cahierConges = new List<CahierConge>();
                foreach (var empcod in empcods)
                {
                    Employe? employe = await _dbContext.Employes.FirstOrDefaultAsync(e => e.Soccod == soccod && e.Empcod == empcod);
                    if (employe == null)
                        continue;

                    string month = datedebut.Month < 10 ? "0" + datedebut.Month : datedebut.Month.ToString();

                    var result = await _dbContext.Calendsocs
                        .Where(c => c.Soccod == soccod &&
                                    c.CalAn == datedebut.Year.ToString() &&
                                    c.CalMois == month &&
                                    c.Caltype == employe.Caltype)
                        .Select(c => new CalendrierData { CalTrav = c.CalTrav, CalNbh = c.CalNbh })
                        .FirstOrDefaultAsync() ?? new CalendrierData { CalTrav = 0, CalNbh = 0 };

                    string? ancienneteStr = await _dbContext.Parametres
                            .Where(p => p.Soccod == soccod)
                            .Select(p => p.Parancemp)
                            .FirstOrDefaultAsync();

                    float anciennete = float.TryParse(ancienneteStr, out float temp) ? temp : 5f;

                    TimeSpan? diff = datedebut - employe.Empemb;
                    float jouanc = (float)(diff?.TotalDays ?? 0) / 365f;
                    jouanc = jouanc < anciennete ? 0 : MathF.Floor(jouanc / anciennete);

                    float? soldini = await _dbContext.Sites
                        .Where(s => s.Soccod == soccod && s.Sitcod == employe.Sitcod)
                        .Select(s => s.Sitconge)
                        .FirstOrDefaultAsync();

                    float saljou = result.CalTrav != 0 ? (float)(employe.Empsbrut / result.CalTrav) : 0;

                    var conges = await _dbContext.Conges
                        .Where(c => c.Soccod == soccod &&
                                   c.Empcod == empcod &&
                                   c.Condep >= datedebut &&
                                   c.Conret <= datefin)
                        .OrderByDescending(c => c.Condat)
                        .ToListAsync();

                    var leavesByMonth = conges
                        .GroupBy(c => new { c.Condep.Value.Year, c.Condep.Value.Month })
                        .Select(g => new {
                            MonthYear = g.Key,
                            TotalDays = g.Sum(c => c.Connbjour),
                            Leaves = g.ToList()
                        })
                        .OrderByDescending(g => g.MonthYear.Year)
                        .ThenByDescending(g => g.MonthYear.Month)
                        .ToList();

                    Dictionary<int, bool> registeredMonths = new Dictionary<int, bool>();

                    foreach (var conge in conges)
                    {
                        float montAnc = float.IsNaN(jouanc * saljou) ? 0 : jouanc * saljou;
                        float? nbjours = leavesByMonth
                            .Where(c => c.MonthYear.Month == conge.Condep.Value.Month &&
                                       c.MonthYear.Year == conge.Condep.Value.Year)
                            .Select(c => c.TotalDays)
                            .FirstOrDefault();

                        bool isMonthRegistered = registeredMonths.TryGetValue(conge.Condep.Value.Month, out _);

                        var cahier = new CahierConge()
                        {
                            Empmat = employe.Empmat,
                            Emplib = employe.Emplib,
                            Congedu = isMonthRegistered ? 0 : (nbjours - jouanc),
                            Indemdu = isMonthRegistered ? 0 : (nbjours - jouanc) * saljou,
                            Empdnais = employe.Empdnais,
                            Empemb = employe.Empemb,
                            Empreg = employe.Empreg,
                            Soldini = soldini,
                            Saljou = saljou,
                            Jouanc = jouanc,
                            Montanc = montAnc,
                            Totdupres = nbjours,
                            Indemcong = nbjours * saljou,
                            Datdep = conge.Condep,
                            Depam = conge.Conamdep,
                            Datret = conge.Conret,
                            Retam = conge.Conamret,
                        };

                        cahierConges.Add(cahier);

                        if (jouanc != 0 && !isMonthRegistered)
                        {
                            jouanc = Math.Max(0, jouanc - (byte)conge.Connbjour);
                        }
                            registeredMonths[conge.Condep.Value.Month] = true;
                    }
                }
                return cahierConges;
            }
            catch (Exception ex)
            {
                // Log the exception here
                throw;
            }
        }
    
    }
}

