using ABRPOINT.Server.Data;
using ABRPOINT.Server.Dtaos;
using ABRPOINT.Server.Exceptions;
using ABRPOINT.Helper;
using ABRPOINT.Server.Interfaces;
using ABRPOINT.Server.Models;
using ABRPOINT.Server.CalculService.HeureRetard;
using AutoMapper;
using Microsoft.EntityFrameworkCore;

namespace ABRPOINT.Server.Repository
{
    public class AbsenceRepository : IAbscenceRepository
    {

        private readonly ApplicationDbContext _dbContext;
        private readonly IEmployeRepository _employeRepository;
        private readonly ISanctionRepository _sanctionRepository;
        private readonly IParametreRepository _parametreRepository;
        // Dépendances ajoutées pour recalculer le retard via le même chemin que l'État
        // Périodique (sinon les colonnes brutes Preretmat/amup périmées donnent un total
        // qui diverge de ce que l'utilisateur voit dans le détail journée).
        private readonly IPosteRepository _posteRepository;
        private readonly IautoriserRepository _autorisationRepository;
        private readonly IHeureRetardService _retardService;
        private readonly IMapper _mapper;
        public AbsenceRepository(ApplicationDbContext dbContext,IEmployeRepository employeRepository,ISanctionRepository sanctionRepository,IParametreRepository parametreRepository,
            IPosteRepository posteRepository, IautoriserRepository autorisationRepository, IHeureRetardService retardService, IMapper mapper)
        {
            _dbContext = dbContext;
            _employeRepository = employeRepository;
            _sanctionRepository = sanctionRepository;
            _parametreRepository = parametreRepository;
            _posteRepository = posteRepository;
            _autorisationRepository = autorisationRepository;
            _retardService = retardService;
            _mapper = mapper;

        }
        public async Task AddAsync(Absence absence)
        {
            try
            {
                await _dbContext.Absences.AddAsync(absence);
                await _dbContext.SaveChangesAsync();
            }
            catch (DbUpdateException dbEx)
            {
                throw new RepositoryException("ProblÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â©me au niveau base de donnÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â©e",dbEx);
            }
            catch (Exception ex)
            {

                throw new RepositoryException("Erreur inattendue s'est produit ",ex);
            }
            
        }
        public async Task<List<EtatAbsence>> GetEtatAbsenceAsync(string soccod,DateTime datedebut,DateTime datefin,bool absaut,bool absret,bool presNonOpt,bool sansPointageInvalide,string radioValue, List<string>? empcods)
        {
            if (empcods == null || empcods.Count == 0)
                return new List<EtatAbsence>();

            var startDate = datedebut.Date;
            var endDate = datefin.Date;
            var today = DateTime.Today;
            if (endDate > today)
                endDate = today;

            static int GetMinutes(DateTime? t)
                => t.HasValue ? (int)t.Value.TimeOfDay.TotalMinutes : 0;

            static string FormatMinutes(int minutes)
                => TimeSpan.FromMinutes(minutes).ToString(@"hh\:mm");

            async Task<bool> IsPointageValid(Presence presence, DateTime date)
            {
                int actions = 0;

                if (!string.IsNullOrEmpty(presence?.Preentmatup) && !string.IsNullOrEmpty(presence?.Presortmatup))
                    actions++;
                if (!string.IsNullOrEmpty(presence?.Preentamidiup) && !string.IsNullOrEmpty(presence?.Presortamidiup))
                    actions++;

                bool isRepos = false;
                string? codpost = !string.IsNullOrWhiteSpace(presence.Codposte)
                    ? presence.Codposte
                    : await _employeRepository.GetEmpPoste(soccod, presence.Empcod, date);

                if (!string.IsNullOrWhiteSpace(codpost))
                {
                    (isRepos, _) = await _parametreRepository.IsEmpcodReposAsync(soccod, date, codpost, presence.Empcod);
                }

                if (actions == 0 && (presence?.Prerepos == "0" || !isRepos))
                    return false;

                if (actions > 0 && presence?.Prerepos == "0")
                    return true;

                if (presence?.Prerepos == "1" && isRepos)
                    return true;

                if (presence?.Prerepos == "1" && !isRepos)
                    return false;

                return false;
            }

            var employes = await _dbContext.Employes
                .AsNoTracking()
                .Where(e => e.Soccod == soccod && empcods.Contains(e.Empcod))
                .ToDictionaryAsync(e => e.Empcod);

            var sanctions = await _dbContext.Sanctions
                .AsNoTracking()
                .Where(s => s.Soccod == soccod
                            && empcods.Contains(s.Empcod)
                            && s.Condep <= datefin
                            && s.Conret >= datedebut)
                .Join(_dbContext.Absences.AsNoTracking(),
                    s => new { s.Soccod, s.Abscod },
                    a => new { a.Soccod, a.Abscod },
                    (s, a) => new
                    {
                        s.Empcod,
                        s.Condep,
                        s.Conret,
                        s.Abscod,
                        a.Abslib,
                        a.Abscng,
                        a.Abspayer
                    })
                .ToListAsync();

            var presences = await _dbContext.Presences
                .AsNoTracking()
                .Where(p => p.Soccod == soccod
                         && empcods.Contains(p.Empcod)
                         && p.Predat >= datedebut
                         && p.Predat <= datefin)
                .ToListAsync();

            var ferieDates = (await _dbContext.Feriers
                .AsNoTracking()
                .Where(f => f.Soccod == soccod
                         && f.Ferdate >= datedebut
                         && f.Ferdate <= datefin)
                .Select(f => f.Ferdate!.Value.Date)
                .ToListAsync())
                .ToHashSet();

            var presencesByEmployeeDate = presences
                .Where(p => p.Predat.HasValue && !string.IsNullOrWhiteSpace(p.Empcod))
                .GroupBy(p => (p.Empcod!, p.Predat!.Value.Date))
                .ToDictionary(g => g.Key, g => g.First());

            var pointageValidityByKey = new Dictionary<(string Empcod, DateTime Date), bool>();
            foreach (var presenceEntry in presencesByEmployeeDate)
            {
                pointageValidityByKey[presenceEntry.Key] = await IsPointageValid(presenceEntry.Value, presenceEntry.Key.Date);
            }

            static bool HasRetard(EtatAbsence etatAbsence)
                => !string.IsNullOrWhiteSpace(etatAbsence.Absjourretard) && etatAbsence.Absjourretard != "00:00";

            static bool IsGeneratedNonPresent(EtatAbsence etatAbsence)
                => string.IsNullOrWhiteSpace(etatAbsence.Abscod)
                    && string.Equals(etatAbsence.Motif, "Non present", StringComparison.OrdinalIgnoreCase);

            static bool HasTypedAbsence(EtatAbsence etatAbsence)
                => etatAbsence.CSF == 1
                    || etatAbsence.Absjust == 1
                    || etatAbsence.FM == 1
                    || etatAbsence.Absmal == 1
                    || etatAbsence.Absnj == 1
                    || etatAbsence.MAP == 1
                    || etatAbsence.CSS == 1
                    || etatAbsence.Acctrav == 1
                    || etatAbsence.Arrtech == 1
                    || etatAbsence.Congepaye == 1;

            static bool HasAuthorizedAbsence(EtatAbsence etatAbsence)
                => etatAbsence.Autsp == 1;

            var result = new Dictionary<(string Empcod, DateTime Date), EtatAbsence>();

            foreach (var sanction in sanctions)
            {
                if (!employes.TryGetValue(sanction.Empcod, out var employe) || !sanction.Condep.HasValue || !sanction.Conret.HasValue)
                    continue;

                // Filter absences by employment period (embauche to sortie)
                var employeeStartDate = employe.Empemb?.Date ?? startDate;
                var employeeEndDate = employe.Empsort?.Date ?? endDate.AddDays(1); // AddDays(1) because Empsort is exclusive
                
                var sanctionStart = sanction.Condep.Value.Date < startDate ? startDate : sanction.Condep.Value.Date;
                var sanctionEnd = sanction.Conret.Value.Date > endDate ? endDate : sanction.Conret.Value.Date;

                // Ensure sanction dates are within employment period
                if (sanctionStart >= employeeEndDate || sanctionEnd < employeeStartDate)
                    continue;

                sanctionStart = sanctionStart < employeeStartDate ? employeeStartDate : sanctionStart;
                sanctionEnd = sanctionEnd >= employeeEndDate ? employeeEndDate.AddDays(-1) : sanctionEnd;

                for (var date = sanctionStart; date <= sanctionEnd; date = date.AddDays(1))
                {
                    var key = (sanction.Empcod, date);

                    if (!result.TryGetValue(key, out var etatAbsence))
                    {
                        etatAbsence = new EtatAbsence
                        {
                            Empcod = sanction.Empcod,
                            Empmat = employe.Empmat,
                            Emplib = employe.Emplib,
                            Empreg = employe.Empreg,
                            Date = date,
                            Abscod = sanction.Abscod,
                            Motif = sanction.Abslib
                        };

                        result[key] = etatAbsence;
                    }

                    if (sanction.Abspayer == "O" || sanction.Abspayer == "N")
                        etatAbsence.Autsp = 1;

                    switch (sanction.Abscng)
                    {
                        case "1": etatAbsence.CSF = 1; break;
                        case "2": etatAbsence.Absjust = 1; break;
                        case "3": etatAbsence.Absnj = 1; break;
                        case "4": etatAbsence.MAP = 1; break;
                        case "5": etatAbsence.CSS = 1; break;
                        case "6": etatAbsence.FM = 1; break;
                        case "8": etatAbsence.Acctrav = 1; break;
                        case "9":
                            if (sanction.Abslib?.ToLower() == "maladie")
                                etatAbsence.Absmal = 1;
                            break;
                    }

                    etatAbsence.Absence = 1;
                }
            }

            if (absret)
            {
                // Pré-charge poste + autorisations en batch, puis recalcule chaque retard via
                // _retardService — cohérent avec EtatPériodique. Les colonnes Preretmat/amup
                // brutes ne sont pas réécrites lors d'un changement de poste/autorisation, on
                // ne peut donc pas les sommer aveuglément ici.
                var posteCacheAbs = await _dbContext.Postes
                    .Where(po => po.Soccod == soccod)
                    .AsNoTracking()
                    .ToDictionaryAsync(po => po.Codposte!);
                var demandesAutAbs = presences
                    .Where(x => x.Predat.HasValue && !string.IsNullOrWhiteSpace(x.Empcod))
                    .Select(x => (Empcod: x.Empcod!, Date: x.Predat!.Value.Date))
                    .Distinct()
                    .ToList();
                var autorisationsAbs = demandesAutAbs.Count > 0
                    ? await _autorisationRepository.GetAutLibBatch(soccod, demandesAutAbs)
                    : new Dictionary<(string Empcod, DateTime Date), AutDto>();
                var postesByEmpAbs = new Dictionary<string, Dictionary<(string Empcod, DateTime Date), string?>>();
                foreach (var emp in empcods)
                {
                    postesByEmpAbs[emp] = await _posteRepository.GetEmployePosteBatch(soccod, emp, datedebut, datefin);
                }

                foreach (var presence in presences)
                {
                    if (!presence.Predat.HasValue || string.IsNullOrWhiteSpace(presence.Empcod))
                        continue;

                    if (!employes.TryGetValue(presence.Empcod, out var employe))
                        continue;

                    // Filter retards by employment period (embauche to sortie)
                    var presenceDate = presence.Predat.Value.Date;
                    if (employe.Empemb.HasValue && presenceDate < employe.Empemb.Value.Date)
                        continue; // Before hire date
                    if (employe.Empsort.HasValue && presenceDate >= employe.Empsort.Value.Date)
                        continue; // On or after exit date

                    int totalRetard =
                        GetMinutes(presence.Preretmateup) +
                        GetMinutes(presence.Preretmatsup) +
                        GetMinutes(presence.Preretameup) +
                        GetMinutes(presence.Preretamsup);

                    if (postesByEmpAbs.TryGetValue(presence.Empcod, out var posteMapAbs))
                    {
                        var codposteAbs = posteMapAbs.GetValueOrDefault((presence.Empcod, presenceDate)) ?? presence.Codposte;
                        if (!string.IsNullOrEmpty(codposteAbs) && posteCacheAbs.TryGetValue(codposteAbs, out var poste) && poste != null)
                        {
                            var dto = _mapper.Map<PresenceDto>(presence);
                            dto.Soccod = soccod;
                            dto.Codposte = codposteAbs;
                            dto.Dmdate ??= presenceDate;
                            var aut = autorisationsAbs.GetValueOrDefault((presence.Empcod, presenceDate));
                            try
                            {
                                var calc = await _retardService.CalculateHeureRetard(dto, poste, aut);
                                totalRetard = calc.nbRetard;
                            }
                            catch
                            {
                                // En cas d'erreur, on retombe sur la somme brute calculée plus haut.
                            }
                        }
                    }

                    bool hasAbsenceHours = !string.IsNullOrWhiteSpace(presence.Tothabs) && presence.Tothabs != "00:00";
                    if (totalRetard == 0 && !hasAbsenceHours)
                        continue;

                    var key = (presence.Empcod, presence.Predat.Value.Date);

                    if (!result.TryGetValue(key, out var etatAbsence))
                    {
                        etatAbsence = new EtatAbsence
                        {
                            Empcod = presence.Empcod,
                            Empmat = employe.Empmat,
                            Emplib = employe.Emplib,
                            Empreg = employe.Empreg,
                            Date = presence.Predat.Value.Date,
                            Motif = "Retard"
                        };

                        result[key] = etatAbsence;
                    }

                    etatAbsence.Absjourretard = FormatMinutes(totalRetard);
                }
            }

            if (radioValue != "2")
            {
                foreach (var employe in employes.Values)
                {
                    var employeeStartDate = employe.Empemb?.Date ?? startDate;
                    var employeeEndDate = employe.Empsort?.Date ?? endDate;
                    var effectiveStart = employeeStartDate > startDate ? employeeStartDate : startDate;
                    var effectiveEnd = employeeEndDate < endDate ? employeeEndDate : endDate;

                    if (effectiveStart > effectiveEnd)
                        continue;

                    var allDates = Enumerable
                        .Range(0, (effectiveEnd - effectiveStart).Days + 1)
                        .Select(offset => effectiveStart.AddDays(offset))
                        .ToList();

                    if (allDates.Count == 0)
                        continue;

                    var reposDays = await _parametreRepository.GetReposDaysByPeriodAsync(soccod, employe.Empcod, allDates);

                    foreach (var date in allDates)
                    {
                        var key = (employe.Empcod, date);

                        if (result.ContainsKey(key))
                            continue;

                        if (ferieDates.Contains(date))
                            continue;

                        if (reposDays.TryGetValue(date, out var isRepos) && isRepos)
                            continue;

                        if (presencesByEmployeeDate.TryGetValue(key, out var presence))
                        {
                            if (!GenericMethodes.NotPresent(presence))
                                continue;

                            if (sansPointageInvalide)
                            {
                                var isPointageValid = await IsPointageValid(presence, date);
                                if (!isPointageValid)
                                    continue;
                            }
                        }

                        result[key] = new EtatAbsence
                        {
                            Empcod = employe.Empcod,
                            Empmat = employe.Empmat,
                            Emplib = employe.Emplib,
                            Empreg = employe.Empreg,
                            Date = date,
                            Motif = "Non present",
                            Absnj = 1,
                            Absence = 1
                        };
                    }
                }
            }

            foreach (var presence in presences)
            {
                if (!presence.Predat.HasValue || string.IsNullOrWhiteSpace(presence.Empcod))
                    continue;

                var key = (presence.Empcod, presence.Predat.Value.Date);
                if (!pointageValidityByKey.TryGetValue(key, out var isPointageValid) || isPointageValid)
                    continue;

                if (!employes.TryGetValue(presence.Empcod, out var employe))
                    continue;

                // Filter invalid pointages by employment period (embauche to sortie)
                var presenceDate = presence.Predat.Value.Date;
                if (employe.Empemb.HasValue && presenceDate < employe.Empemb.Value.Date)
                    continue; // Before hire date
                if (employe.Empsort.HasValue && presenceDate >= employe.Empsort.Value.Date)
                    continue; // On or after exit date

                if (!result.TryGetValue(key, out var invalidEtat))
                {
                    result[key] = new EtatAbsence
                    {
                        Empcod = presence.Empcod,
                        Empmat = employe.Empmat,
                        Emplib = employe.Emplib,
                        Empreg = employe.Empreg,
                        Date = presence.Predat.Value.Date,
                        Motif = "Pointage invalide"
                    };

                    continue;
                }

                if (string.IsNullOrWhiteSpace(invalidEtat.Motif))
                    invalidEtat.Motif = "Pointage invalide";
            }

            var filteredResults = result.Values
                .Select(etatAbsence =>
                {
                    var filteredAbsence = new EtatAbsence
                    {
                        Empcod = etatAbsence.Empcod,
                        Empmat = etatAbsence.Empmat,
                        Emplib = etatAbsence.Emplib,
                        Empreg = etatAbsence.Empreg,
                        Date = etatAbsence.Date,
                        Abscod = etatAbsence.Abscod,
                        Motif = etatAbsence.Motif,
                        Congepaye = etatAbsence.Congepaye,
                        Acctrav = etatAbsence.Acctrav,
                        CSF = etatAbsence.CSF,
                        Absjust = etatAbsence.Absjust,
                        FM = etatAbsence.FM,
                        Arrtech = etatAbsence.Arrtech,
                        Absmal = etatAbsence.Absmal,
                        Absnj = etatAbsence.Absnj,
                        MAP = etatAbsence.MAP,
                        Autsp = absaut ? etatAbsence.Autsp : null,
                        CSS = etatAbsence.CSS,
                        Absjourretard = absret ? etatAbsence.Absjourretard : null,
                        Absence = etatAbsence.Absence,
                    };

                    return filteredAbsence;
                })
                .Where(etatAbsence =>
                {
                    if (string.IsNullOrWhiteSpace(etatAbsence.Empcod) || !etatAbsence.Date.HasValue)
                        return false;

                    var key = (etatAbsence.Empcod, etatAbsence.Date.Value.Date);
                    var hasPresence = presencesByEmployeeDate.TryGetValue(key, out var presence);
                    var hasNoPointage = !hasPresence || GenericMethodes.NotPresent(presence);
                    var hasInvalidPointage = hasPresence
                        && pointageValidityByKey.TryGetValue(key, out var isPointageValid)
                        && !isPointageValid;

                    if (radioValue == "2")
                    {
                        return etatAbsence.Absjust == 1;
                    }

                    if (radioValue == "3")
                    {
                        return hasInvalidPointage;
                    }

                    if (radioValue == "0")
                    {
                        return hasNoPointage
                            && (IsGeneratedNonPresent(etatAbsence) || etatAbsence.Absnj == 1);
                    }

                    var includeTypedAbsence = HasTypedAbsence(etatAbsence);
                    var includeGeneratedNonPresent = presNonOpt && IsGeneratedNonPresent(etatAbsence);
                    var includeAuthorizedAbsence = absaut && HasAuthorizedAbsence(etatAbsence);
                    var includeRetard = absret && HasRetard(etatAbsence);
                    var includeByRadio = includeTypedAbsence
                        || includeGeneratedNonPresent
                        || includeAuthorizedAbsence
                        || includeRetard;

                    return includeByRadio;
                });
            
            return filteredResults
                .OrderBy(r => r.Date)
                .ThenBy(r => r.Empcod)
                .ToList();
        }
        public async Task DeleteAsync(Absence absence)
        {
            try
            {
                if (absence==null)
                    throw new ArgumentNullException("Invalid ID specified for deletion.", nameof(absence));
                
                    _dbContext.Absences.Remove(absence);
                    await _dbContext.SaveChangesAsync();
            }
            catch (DbUpdateException dbEx)
            {

                throw new RepositoryException("ProblÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â©me au niveau base de donnÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â©e ",dbEx);
            }
            catch (Exception ex)
            {

                throw new RepositoryException("Erreur inattendue s'est produit ", ex);
            }
            
        }

        public async Task<Dictionary<string, string>> GetAbsLibsAsync(string soccod)
        {
            if (string.IsNullOrWhiteSpace(soccod))
            {
                throw new ArgumentException("Soccod cannot be null or empty.", nameof(soccod));
            }
            try
            {
                var absences = await _dbContext.Absences
                                .Where(a => a.Soccod == soccod)
                                .ToDictionaryAsync(abs => abs.Abscod, abs => abs.Abslib);
                return absences;
            }
            catch (InvalidOperationException opEx)
            {
                throw new InvalidOperationException("clÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â© dupliquÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â© est dÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â©tÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â©ctÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â©e ",opEx);
            }
            catch (Exception ex)
            {
                throw new Exception("Erreur innatendue ",ex);
            }
        }

        public async Task<Dictionary<string, string>> GetCongeAbsLibsAsync(string soccod)
        {
            if (string.IsNullOrWhiteSpace(soccod))
                throw new ArgumentException("Soccod cannot be null or empty.", nameof(soccod));

            try
            {
                // 'R' = RTT (Réduction du Temps de Travail, loi française) ; tracé comme un
                // congé classique côté UI mais avec un solde dédié (Solde.RttJours).
                var congeTypes = new[] { "0", "1", "5", "R" };
                return await _dbContext.Absences
                    .Where(a => a.Soccod == soccod && congeTypes.Contains(a.Abscng))
                    .ToDictionaryAsync(abs => abs.Abscod, abs => abs.Abslib);
            }
            catch (Exception ex)
            {
                throw new RepositoryException("Erreur lors de la récupération des types de congé", ex);
            }
        }

        public async Task<IEnumerable<Absence>> GetAutorisationAbsencesAsync(string soccod)
        {
            if (string.IsNullOrWhiteSpace(soccod))
                throw new ArgumentException("Soccod cannot be null or empty.", nameof(soccod));

            try
            {
                return await _dbContext.Absences
                    .Where(a => a.Soccod == soccod && a.Abscng == "B")
                    .ToListAsync();
            }
            catch (Exception ex)
            {
                throw new RepositoryException("Erreur lors de la récupération des types d'autorisation", ex);
            }
        }

            public async Task<IEnumerable<Absence>> GetAllAsync()
            {
            try
            {
                return await _dbContext.Absences.ToListAsync();
            }
            catch (Exception ex)
            {
                throw new RepositoryException("Erreur innatendu ",ex);
            }
                
            }
        public async Task<IEnumerable<Absence>> GetAllAsync(string soccod)
        {
            if (string.IsNullOrWhiteSpace(soccod))
                throw new ArgumentException("code sociÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â©tÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â© est null",nameof(soccod));
            try
            {
                IEnumerable<Absence> absences = await _dbContext.Absences
                    .Where(a => a.Soccod == soccod)
                    .GroupBy(a =>new { a.Abscod, a.Soccod })
                    .Select(g=>g.First())
                    .ToListAsync();
                if (absences == null)
                    throw new ArgumentNullException("Aucune absences trouvÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â©e");

                return absences;
                
            }
            catch (Exception ex)
            {

                throw new RepositoryException("Erreur innatendue s'est produit lors de rÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â©cupÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â©ration d'absences "
                    ,ex);
            }
        }

        public async Task<Absence?> GetByAbscodAsync(string soccod, string abscod)
        {
            if (string.IsNullOrWhiteSpace(soccod))
                throw new ArgumentException("code societe est null ",nameof(soccod));
            if (string.IsNullOrWhiteSpace(abscod))
                throw new ArgumentException("code absence est null ",nameof(abscod));
            try
            {
                 Absence absence = await _dbContext.Absences
                    .FirstOrDefaultAsync(s => s.Soccod == soccod && s.Abscod == abscod);

                if (absence == null)
                    throw new ArgumentNullException($"Aucun absence trouvÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â©e avec code societe '{soccod}'" +
                        $"et code absence '${abscod}'");
                return absence;
            }
            catch (Exception ex)
            {
                throw new Exception("Erreur innatendu ",ex);
            }
        }

         public async Task UpdateAsync(Absence absence)
        {
            if (absence == null) throw new ArgumentNullException("objet absence est null");
            try
            {
                _dbContext.Absences.Update(absence);
                await _dbContext.SaveChangesAsync();
            }
            catch (DbUpdateException dbEx)
            {
                throw new RepositoryException("An error occurred while saving data. Please contact support.", dbEx);
            }
            catch (Exception ex)
            {

                throw new RepositoryException("Erreur innatendu s'est produit lors de modification du produit ",ex);
            }
            
        }
    }
}

