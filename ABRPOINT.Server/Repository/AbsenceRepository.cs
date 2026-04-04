using ABRPOINT.Server.Data;
using ABRPOINT.Server.Dtaos;
using ABRPOINT.Server.Exceptions;
using ABRPOINT.Helper;
using ABRPOINT.Server.Interfaces;
using ABRPOINT.Server.Models;
using Microsoft.EntityFrameworkCore;

namespace ABRPOINT.Server.Repository
{
    public class AbsenceRepository : IAbscenceRepository
    {

        private readonly ApplicationDbContext _dbContext;
        private readonly IEmployeRepository _employeRepository;
        private readonly ISanctionRepository _sanctionRepository;
        private readonly IParametreRepository _parametreRepository;
        public AbsenceRepository(ApplicationDbContext dbContext,IEmployeRepository employeRepository,ISanctionRepository sanctionRepository,IParametreRepository parametreRepository)
        {
            _dbContext = dbContext;
            _employeRepository = employeRepository;
            _sanctionRepository = sanctionRepository;
            _parametreRepository = parametreRepository;

        }
        public void Add(Absence absence)
        {
            try
            {
                _dbContext.Absences.Add(absence);
                _dbContext.SaveChanges();
            }
            catch (DbUpdateException dbEx)
            {
                throw new RepositoryException("ProblÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â©me au niveau base de donnÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â©e",dbEx);
            }
            catch (Exception ex)
            {

                throw new RepositoryException("Erreur inattendue s'est produit ",ex);
            }
            
        }
        public async Task<List<EtatAbsence>> GetEtatAbsence(string soccod,DateTime datedebut,DateTime datefin,bool absaut,bool absret,bool presNonOpt,bool sansPointageInvalide,string? selectedAbsType,List<string>? empcods)
        {
            if (empcods == null || empcods.Count == 0)
                return new List<EtatAbsence>();

            var startDate = datedebut.Date;
            var endDate = datefin.Date;
            var shouldFilterByAbsType = !string.IsNullOrWhiteSpace(selectedAbsType) && selectedAbsType != "0";

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
                    (isRepos, _) = await _parametreRepository.IsEmpcodRepos(soccod, date, codpost, presence.Empcod);
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

            var sanctions = await (
                from s in _dbContext.Sanctions.AsNoTracking()
                join a in _dbContext.Absences.AsNoTracking()
                    on new { s.Soccod, s.Abscod } equals new { a.Soccod, a.Abscod }
                where s.Soccod == soccod
                      && empcods.Contains(s.Empcod)
                      && s.Condep <= datefin
                      && s.Conret >= datedebut
                      && (!shouldFilterByAbsType || s.Abscod == selectedAbsType)
                select new
                {
                    s.Empcod,
                    s.Condep,
                    s.Conret,
                    s.Abscod,
                    a.Abslib,
                    a.Abscng,
                    a.Abspayer
                }
            ).ToListAsync();

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

            var result = new Dictionary<(string Empcod, DateTime Date), EtatAbsence>();

            foreach (var sanction in sanctions)
            {
                if (!employes.TryGetValue(sanction.Empcod, out var employe) || !sanction.Condep.HasValue || !sanction.Conret.HasValue)
                    continue;

                var sanctionStart = sanction.Condep.Value.Date < startDate ? startDate : sanction.Condep.Value.Date;
                var sanctionEnd = sanction.Conret.Value.Date > endDate ? endDate : sanction.Conret.Value.Date;

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
                foreach (var presence in presences)
                {
                    if (!presence.Predat.HasValue || string.IsNullOrWhiteSpace(presence.Empcod))
                        continue;

                    if (!employes.TryGetValue(presence.Empcod, out var employe))
                        continue;

                    int totalRetard =
                        GetMinutes(presence.Preretmateup) +
                        GetMinutes(presence.Preretmatsup) +
                        GetMinutes(presence.Preretameup) +
                        GetMinutes(presence.Preretamsup);

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

            if (!shouldFilterByAbsType)
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

                    var reposDays = await _parametreRepository.GetReposDaysByPeriod(soccod, employe.Empcod, allDates);

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

            return result.Values
                .OrderBy(r => r.Date)
                .ThenBy(r => r.Empcod)
                .ToList();
        }

        public void Delete(Absence absence)
        {
            try
            {
                if (absence==null)
                    throw new ArgumentNullException("Invalid ID specified for deletion.", nameof(absence));
                
                    _dbContext.Absences.Remove(absence);
                    _dbContext.SaveChanges();
            }
            catch (DbUpdateException dbEx)
            {

                throw new RepositoryException("ProblÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â©me au niveau base de donnÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â©e ",dbEx);
            }
            catch (Exception ex)
            {

                throw new RepositoryException("Erreur inattendue s'est produit ", ex);
            }
            
        }

        public async Task<Dictionary<string, string>> GetAbsLibs(string soccod)
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
                throw new InvalidOperationException("clÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â© dupliquÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â© est dÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â©tÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â©ctÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â©e ",opEx);
            }
            catch (Exception ex)
            {
                throw new Exception("Erreur innatendue ",ex);
            }
        }

            public IEnumerable<Absence> GetAll()
            {
            try
            {
                IEnumerable<Absence> absences = _dbContext.Absences.ToList();
                return _dbContext.Absences.ToList();
            }
            catch (Exception ex)
            {
                throw new RepositoryException("Erreur innatendu ",ex);
            }
                
            }
        public IEnumerable<Absence> GetAll(string soccod)
        {
            if (string.IsNullOrWhiteSpace(soccod))
                throw new ArgumentException("code sociÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â©tÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â© est null",nameof(soccod));
            try
            {
                IEnumerable<Absence> absences = _dbContext.Absences
                    .Where(a => a.Soccod == soccod)
                    .GroupBy(a =>new { a.Abscod, a.Soccod })
                    .Select(g=>g.First())
                    .ToList();
                if (absences == null)
                    throw new ArgumentNullException("Aucune absences trouvÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â©e");

                return absences;
                
            }
            catch (Exception ex)
            {

                throw new RepositoryException("Erreur innatendue s'est produit lors de rÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â©cupÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â©ration d'absences "
                    ,ex);
            }
        }

        public Absence GetByAbscod(string soccod, string abscod)
        {
            if (string.IsNullOrWhiteSpace(soccod))
                throw new ArgumentException("code societe est null ",nameof(soccod));
            if (string.IsNullOrWhiteSpace(abscod))
                throw new ArgumentException("code absence est null ",nameof(abscod));
            try
            {
                 Absence absence = _dbContext.Absences
                    .FirstOrDefault(s => s.Soccod == soccod && s.Abscod == abscod);

                if (absence == null)
                    throw new ArgumentNullException($"Aucun absence trouvÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â©e avec code societe '{soccod}'" +
                        $"et code absence '${abscod}'");
                return absence;
            }
            catch (Exception ex)
            {
                throw new Exception("Erreur innatendu ",ex);
            }
        }

         public void Update(Absence absence)
        {
            if (absence == null) throw new ArgumentNullException("objet absence est null");
            try
            {
                _dbContext.Absences.Update(absence);
                _dbContext.SaveChanges();
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
