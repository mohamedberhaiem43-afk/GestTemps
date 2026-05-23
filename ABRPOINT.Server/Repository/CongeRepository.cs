using ABRPOINT.Server.Data;
using ABRPOINT.Server.Dtaos;
using ABRPOINT.Server.Interfaces;
using ABRPOINT.Server.Models;
using Microsoft.EntityFrameworkCore;
using System.Globalization;

namespace ABRPOINT.Server.Repository
{
    public class MonthlyData
    {
        public int Month { get; set; }
        public float? TotalDays { get; set; }
    }

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
        public async Task AddAsync(Conge conge)
        {
            await _dbContext.Conges.AddAsync(conge);
            await _dbContext.SaveChangesAsync();
        }
        public async Task<List<CongeDto>> GetCongesByPeriodAsync(string soccod,string empcod,DateTime startDate,DateTime endDate)
        {
            try
            {
                var conges = await (
                    from c in _dbContext.Conges
                    join a in _dbContext.Absences
                        on new { c.Soccod, c.Abscod } equals new { a.Soccod, a.Abscod }
                        into absJoin
                    from a in absJoin.DefaultIfEmpty()
                    where c.Soccod == soccod &&
                          c.Empcod == empcod &&
                          c.Condep <= endDate &&
                          c.Conret >= startDate
                    select new CongeDto
                    {
                        Concod = c.Concod,
                        Condat = c.Condat,
                        Connbjour = c.Connbjour ?? 0,
                        Abslib = a != null ? a.Abslib : null,
                        Condep = c.Condep,
                        Conret = c.Conret,
                        Conamdep = c.Conamdep,
                        Conamret = c.Conamret
                    })
                    .ToListAsync();

                return conges;
            }
            catch (Exception)
            {
                throw;
            }
        }
        public async Task<Dictionary<(string Soccod, string Empcod, DateTime Date), (string? Abslib, float? Connbjour)>> GetCongeLibBatchAsync(List<(string Soccod, string Empcod, DateTime Date)> demandes)
        {
            if (demandes == null || !demandes.Any())
                return new Dictionary<(string, string, DateTime), (string?, float?)>();

            string soccod = demandes.First().Soccod;
            var empcods = demandes
                .Select(d => d.Empcod)
                .Distinct()
                .ToList();

            DateTime minDate = demandes.Min(d => d.Date);
            DateTime maxDate = demandes.Max(d => d.Date);

            // ===============================
            // 1️⃣ Charger congés + absences
            // ===============================
            var conges = await (
                from s in _dbContext.Conges
                join a in _dbContext.Absences
                    on new { s.Soccod, s.Abscod }
                    equals new { a.Soccod, a.Abscod }
                where s.Soccod == soccod
                      && empcods.Contains(s.Empcod)
                      && s.Condep <= maxDate
                      && s.Conret >= minDate
                select new
                {
                    s.Soccod,
                    s.Empcod,
                    s.Condep,
                    s.Conret,
                    s.Conamret,
                    s.Connbjour,
                    a.Abslib
                }
            ).ToListAsync();

            // ===============================
            // 2️⃣ Générer TOUTES les dates entre Condep et Conret pour chaque congé
            // ===============================
            var result = new Dictionary<(string, string, DateTime), (string?, float?)>();

            foreach (var conge in conges)
            {
                // Calculer la date de fin en fonction de Conamret
                DateTime dateDebut = conge.Condep.Value;
                DateTime? dateFin = conge.Conamret == "1" ? conge.Conret : conge.Conret.Value.AddDays(-1);

                // ✅ Générer toutes les dates entre dateDebut et dateFin
                for (DateTime date = dateDebut; date <= dateFin; date = date.AddDays(1))
                {
                    var key = (conge.Soccod, conge.Empcod, date.Date);

                    // ✅ Éviter les doublons - garder le premier congé trouvé
                    if (!result.ContainsKey(key))
                    {
                        result[key] = (conge.Abslib, conge.Connbjour);
                    }
                }
            }

            return result;
        }

        public async Task DeleteAsync(Conge conge)
        {
            if (conge != null)
            {
                _dbContext.Conges.Remove(conge);
                await _dbContext.SaveChangesAsync();
            }
        }
        
        public async Task<IEnumerable<Conge>> GetAllAsync()
        {
            return await _dbContext.Conges.ToListAsync();
        }
        public async Task<List<CongeAbsenceDto>> GetCongeWithAbsenceAsync(string soccod, string uticod)
        {
            try
            {
                // Utiliser une jointure avec Socusers au lieu de Contains
                List<CongeAbsenceDto> rawResult = await (
                    from c in _dbContext.Conges
                    join a in _dbContext.Absences on c.Abscod equals a.Abscod
                    join e in _dbContext.Employes on c.Empcod equals e.Empcod
                    join su in _dbContext.Socusers
                        on new { e.Soccod, e.Sitcod } equals new { su.Soccod, su.Sitcod }
                    where e.Soccod == soccod
                        && su.Uticod == uticod
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
        public async Task<Conge?> GetByConcodAsync(string soccod, string concod)
        {
            try
            {
                return await _dbContext.Conges.FindAsync(soccod, concod);
            }
            catch (Exception ex)
            {

                throw new Exception("Erreur innatendu: " +ex);
            }
        }
        public async Task<NombreConge> GetNbJourEtHreEmpCongeAsync(string soccod, string empcod, DateTime? predat,string codpost)
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
                    var (isRepos, emprepos) = await _parametreRepository.IsEmpcodReposAsync(soccod, predat, codpost, empcod);
                    var repos = await _parametreRepository.IsReposAsync(soccod, predat, codpost);
                    if ((result.Absrepos == "N" && isRepos && dayRepos) || (result.Absferier == "0" && isFerier)|| (result.Absrepos == "N" && repos))
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
                                                                            .FirstOrDefaultAsync();
                return conge;
            }
            catch (Exception)
            {
                throw;
            }
        }


        public async Task UpdateAsync(Conge conge)
        {
            if (conge != null)
            {
                Conge? dbConge = await GetByConcodAsync(conge.Soccod, conge.Concod);
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
                await _dbContext.SaveChangesAsync();
            }
        }
        // Add multiple conges at once
        public async Task AddMultipleAsync(List<Conge> conges)
        {
            if (conges != null && conges.Any())
            {
                await _dbContext.Conges.AddRangeAsync(conges);
                await _dbContext.SaveChangesAsync();
            }
        }

        public async Task<string> GetCongeLibAsync(string? soccod, string empcod, DateTime dmdate)
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

        public async Task<DroitCongeDto> GetDroitCongeAsync(string soccod, string empcod, DateTime? datedebut, DateTime? datefin)
        {
            try
            {
                float? NbCongeRecus = await (
                    from c in _dbContext.Conges
                    join a in _dbContext.Absences on new { c.Soccod, c.Abscod } equals new { a.Soccod, a.Abscod }
                    where c.Soccod == soccod && c.Empcod == empcod &&
                          c.Condep >= datedebut && c.Conret <= datefin &&
                          a.Abscng == "0"
                    select c.Connbjour
                ).SumAsync();

                if (NbCongeRecus.HasValue && (float.IsInfinity(NbCongeRecus.Value) || float.IsNaN(NbCongeRecus.Value)))
                {
                    NbCongeRecus = 0;
                }

                // 🟢 Get annual right from Site
                float? sitconge = await _dbContext.Sites
                    .Where(p => p.Soccod == soccod)
                    .Select(p => p.Sitconge)
                    .FirstOrDefaultAsync() ?? 0;

                var empdata = await _dbContext.Employes
                    .Where(emp => emp.Soccod == soccod && emp.Empcod == empcod)
                    .Select(emp => new { emp.Empmat, emp.Emplib, emp.Empreg, emp.Empemb, emp.Sitcod })
                    .FirstOrDefaultAsync();

                // 🟢 Calculate accrued rights based on hire date
                float accruedRights = 0;
                if (empdata?.Empemb != null && datedebut.HasValue)
                {
                    int targetYear = datedebut.Value.Year;
                    int startMonth = 1;
                    if (empdata.Empemb.Value.Year == targetYear)
                    {
                        startMonth = empdata.Empemb.Value.Month;
                    }
                    else if (empdata.Empemb.Value.Year > targetYear)
                    {
                        startMonth = 13;
                    }

                    int endMonth = datefin?.Month ?? 12;
                    int activeMonths = Math.Max(0, endMonth - startMonth + 1);
                    accruedRights = (float)(sitconge / 12f) * activeMonths;
                }
                else
                {
                    accruedRights = (float)sitconge;
                }

                // 🟢 Get initial balance from 'solde' table
                var soldeEntry = await _dbContext.Soldes.FirstOrDefaultAsync(s => s.Soccod == soccod && s.Empcod == empcod);
                float initialSolde = soldeEntry?.Conge ?? 0;

                // 🟢 Calculate Seniority (matching CongeCalculationService logic)
                int anciente = 0;
                float jourAncien = 0;
                if (empdata?.Empemb != null && datedebut.HasValue)
                {
                    anciente = datedebut.Value.Year - empdata.Empemb.Value.Year;
                    if (anciente != 0 && empdata.Empemb.Value.AddYears(anciente) > new DateTime(datedebut.Value.Year, 1, 1))
                        anciente--;

                    if (anciente > 0)
                    {
                        int parecart = await _parametreRepository.GetParancempAsync(soccod);
                        if (parecart > 0)
                            jourAncien = MathF.Floor((float)anciente / parecart);
                    }
                }

                float totalDroit = accruedRights + initialSolde + jourAncien;

                float? empsanctions = await _dbContext.Sanctions
                    .Where(s => s.Soccod == soccod && s.Empcod == empcod &&
                                s.Condep >= datedebut && s.Conret <= datefin)
                    .SumAsync(s => s.Connbjour);

                if (empsanctions.HasValue && (float.IsInfinity(empsanctions.Value) || float.IsNaN(empsanctions.Value)))
                {
                    empsanctions = 0;
                }

                var sanctionsPerMonth = await _dbContext.Sanctions
                    .Where(s => s.Soccod == soccod && s.Empcod == empcod &&
                                s.Condep >= datedebut && s.Conret <= datefin)
                    .GroupBy(s => s.Condep!.Value.Month)
                    .Select(g => new MonthlyData { Month = g.Key, TotalDays = g.Sum(x => x.Connbjour) })
                    .ToListAsync();

                var congesParMois = await (
                    from c in _dbContext.Conges
                    join a in _dbContext.Absences on new { c.Soccod, c.Abscod } equals new { a.Soccod, a.Abscod }
                    where c.Soccod == soccod && c.Empcod == empcod &&
                          c.Condep >= datedebut && c.Conret <= datefin &&
                          a.Abscng == "0"
                    group c by c.Condep!.Value.Month into g
                    select new MonthlyData { Month = g.Key, TotalDays = g.Sum(c => c.Connbjour) }
                ).ToListAsync();

                var nbCongeRecuParMois = congesParMois.ToDictionary(
                    x => new DateTime(2000, x.Month, 1).ToString("MMMM", new CultureInfo("fr-FR")),
                    x => x.TotalDays
                );
                var nbAbsenceParMois = sanctionsPerMonth.ToDictionary(
                    x => new DateTime(2000, x.Month, 1).ToString("MMMM", new CultureInfo("fr-FR")),
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
                    Soldeinit = initialSolde,
                    Droitconge = accruedRights,
                    Jourancien = jourAncien,
                    Droitrestant = totalDroit - NbCongeRecus,
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

        public async Task<float> GetNbCongeRecueAsync(string soccod, string empcod, string annee, string currentMonth)
        {
            try
            {
                int year = int.Parse(annee);
                int month = int.Parse(currentMonth);

                var totalConge = await (
                    from c in _dbContext.Conges
                    join a in _dbContext.Absences on new { c.Soccod, c.Abscod } equals new { a.Soccod, a.Abscod }
                    where c.Soccod == soccod &&
                          c.Empcod == empcod &&
                          c.Condep.HasValue &&
                          c.Condep.Value.Year == year &&
                          c.Condep.Value.Month == month &&
                          a.Abscng == "0"
                    select c.Connbjour ?? 0
                ).SumAsync();

                // Prevent infinity values that can't be serialized to JSON
                if (float.IsInfinity(totalConge) || float.IsNaN(totalConge))
                {
                    totalConge = 0;
                }

                return totalConge;
            }
            catch (Exception)
            {
                throw;
            }
        }

        public async Task<List<CahierConge>> GetCahierCongeAsync(string soccod, DateTime datedebut, DateTime datefin, List<string> empcods)
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

                    double empsbrutValue = double.TryParse(employe.Empsbrut, out var brut) ? brut : 0;
                    float saljou = result.CalTrav != 0 ? (float)(empsbrutValue / result.CalTrav) : 0;

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

                    Dictionary<string, bool> registeredMonths = new Dictionary<string, bool>();

                    foreach (var conge in conges)
                    {
                        float montAnc = float.IsNaN(jouanc * saljou) ? 0 : jouanc * saljou;
                        float? nbjours = leavesByMonth
                            .Where(c => c.MonthYear.Month == conge.Condep.Value.Month &&
                                       c.MonthYear.Year == conge.Condep.Value.Year)
                            .Select(c => c.TotalDays)
                            .FirstOrDefault();

                        string monthKey = $"{conge.Condep.Value.Year}_{conge.Condep.Value.Month}";
                        bool isMonthRegistered = registeredMonths.TryGetValue(monthKey, out _);

                        var cahier = new CahierConge()
                        {
                            // Fallback Empcod : sur les bases anciennes, le champ Empmat est
                            // souvent NULL (ajouté plus tard). Sans ce fallback, la colonne
                            // « Matricule » de l'UI Cahier de Congé apparaissait vide.
                            Empmat = string.IsNullOrWhiteSpace(employe.Empmat) ? employe.Empcod : employe.Empmat,
                            Emplib = employe.Emplib,
                            Congedu = isMonthRegistered ? 0 : MathF.Max(0, (float)(nbjours - jouanc)),
                            Indemdu = isMonthRegistered ? 0 : MathF.Max(0, (float)(nbjours - jouanc)) * saljou,
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
                            jouanc = Math.Max(0, jouanc - (conge.Connbjour ?? 0));
                        }
                        registeredMonths[monthKey] = true;
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

        public async Task<Conge?> GetEmpCongeByDateAsync(string soccod, string empcod, DateTime date)
        {
            try
            {
                var conge = await _dbContext.Conges.Where(c => c.Soccod == soccod && c.Empcod == empcod && c.Condat == date).FirstOrDefaultAsync();
                return conge;
            }
            catch (Exception)
            {
                throw;
            }
        }

        public async Task<Dictionary<(string Soccod, string Empcod, DateTime Date, float? connbjour), string?>> GetCongeEmployeLibBatchAsync(
        string soccod,
        string empcod,
        DateTime debut,
        DateTime fin)
        {
            try
            {
                if (string.IsNullOrWhiteSpace(soccod))
                    throw new ArgumentException(nameof(soccod));

                if (string.IsNullOrWhiteSpace(empcod))
                    throw new ArgumentException(nameof(empcod));

                if (debut > fin)
                    throw new ArgumentException("La date de début doit être inférieure ou égale à la date de fin.");

                // ===============================
                // 1️⃣ Charger congés + absences
                // ===============================
                var conges = await (
                    from s in _dbContext.Conges
                    join a in _dbContext.Absences
                        on new { s.Soccod, s.Abscod }
                        equals new { a.Soccod, a.Abscod }
                    where s.Soccod == soccod
                          && s.Empcod == empcod
                          && s.Condep <= fin
                          && s.Conret >= debut
                    select new
                    {
                        s.Condep,
                        s.Conret,
                        s.Conamret,
                        s.Connbjour,
                        a.Abslib
                    }
                ).ToListAsync();

                // ===============================
                // 2️⃣ Construire le dictionnaire date par date avec Connbjour
                // ===============================
                var result = new Dictionary<(string, string, DateTime, float?), string?>();

                for (DateTime date = debut.Date; date <= fin.Date; date = date.AddDays(1))
                {
                    var conge = conges.FirstOrDefault(c =>
                        c.Condep <= date &&
                        (c.Conamret == "1" ? c.Conret >= date : c.Conret > date));

                    result[(soccod, empcod, date, conge?.Connbjour)] = conge?.Abslib;
                }

#if DEBUG
                // Diagnostic temporaire — comprendre pourquoi certains congés (ex: 23/04) ne matchent pas.
                // À retirer après confirmation de la sémantique de Conret.
                if (conges.Count > 0)
                {
                    Console.WriteLine($"[Conge match debug] {empcod} {debut:yyyy-MM-dd}→{fin:yyyy-MM-dd} : {conges.Count} enregistrement(s) chargé(s)");
                    foreach (var c in conges)
                        Console.WriteLine($"  Condep={c.Condep:yyyy-MM-dd} Conret={c.Conret:yyyy-MM-dd} Conamret={c.Conamret} Connbjour={c.Connbjour} Abslib={c.Abslib}");
                    var unmatchedDates = result
                        .Where(kv => string.IsNullOrEmpty(kv.Value))
                        .Select(kv => kv.Key.Item3)
                        .ToList();
                    if (unmatchedDates.Count > 0)
                        Console.WriteLine($"  Dates sans match ({unmatchedDates.Count}) : {string.Join(", ", unmatchedDates.Select(d => d.ToString("yyyy-MM-dd")))}");
                }
#endif

                return result;
            }
            catch (Exception)
            {
                throw;
            }
        }
    }
}

