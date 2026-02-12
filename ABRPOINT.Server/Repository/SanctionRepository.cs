using ABRPOINT.Helper;
using ABRPOINT.Server.Data;
using ABRPOINT.Server.Dtaos;
using ABRPOINT.Server.Interfaces;
using ABRPOINT.Server.Models;
using Microsoft.EntityFrameworkCore;

namespace ABRPOINT.Server.Repository
{
    public class SanctionRepository : ISanctionRepository
    {
        private readonly ApplicationDbContext _dbContext;
        private readonly IEmployeRepository _employeRepository;
        private readonly IParametreRepository _parametreRepository;
        public SanctionRepository(ApplicationDbContext dbContext, IEmployeRepository employeRepository,IParametreRepository parametreRepository)
        {
            _dbContext = dbContext;
            _employeRepository = employeRepository;
            _parametreRepository = parametreRepository;
        }
        public void Add(Sanction sanction)
        {
            try
            {
                sanction.Condat = sanction.Condat.Value.Date;
                sanction.Condep = sanction.Condep.Value.Date;
                sanction.Conret = sanction.Conret.Value.Date;
                _dbContext.Sanctions.Add(sanction);
                _dbContext.SaveChanges();
            }
            catch (Exception)
            {
                throw;
            }
        }
        public async Task<List<SanctionDto>> GetSanctionsByPeriod(string soccod,string empcod,DateTime startDate,DateTime endDate)
        {
            try
            {
                var sanctions = await (
                    from c in _dbContext.Conges
                    join a in _dbContext.Absences on new { c.Soccod, c.Abscod } equals new { a.Soccod, a.Abscod }
                    where c.Soccod == soccod &&
                          c.Empcod == empcod &&
                          c.Condat >= startDate &&
                          c.Condat <= endDate &&
                          !string.IsNullOrEmpty(c.Abscod) &&
                          (a.Abscng == "1" || a.Abscng == "2" || a.Abscng == "3" ||
                           a.Abscng == "4" || a.Abscng == "5" || a.Abscng == "6" ||
                           a.Abscng == "8" || a.Abscng == "9" || a.Abscng == "A")
                    select new SanctionDto
                    {
                        Concod = c.Concod,
                        Condat = c.Condat,
                        Connbjour = c.Connbjour ?? 0,
                        Abscod = c.Abscod,
                        Abscng = a.Abscng,
                        Abspaye = a.Abspayer,
                        Abslib = a.Abslib
                    }
                ).ToListAsync();

                return sanctions;
            }
            catch (Exception)
            {
                throw;
            }
        }
        public void Delete(Sanction sanction)
        {
            if (sanction != null)
            {
                _dbContext.Sanctions.Remove(sanction);
                _dbContext.SaveChanges();
            }
        }

        public IEnumerable<Sanction> GetAll()
        {
            return _dbContext.Sanctions.ToList();
        }
        public IEnumerable<Sanction> GetAll(string soccod)
        {
            return _dbContext.Sanctions
                .Where(s=>s.Soccod == soccod).ToList();
        }
        public async Task<List<SanctionEmpDto>> GetSanctionWithAbsenceAsync(string soccod, string uticod)
        {
            try
            {
                // Utiliser une jointure avec Socusers au lieu de Contains
                var rawResult = await (
                    from c in _dbContext.Sanctions
                    join a in _dbContext.Absences on c.Abscod equals a.Abscod
                    join e in _dbContext.Employes on c.Empcod equals e.Empcod
                    join su in _dbContext.Socusers
                        on new { e.Soccod, e.Sitcod } equals new { su.Soccod, su.Sitcod }
                    where c.Soccod == soccod
                        && su.Uticod == uticod
                    select new SanctionEmpDto
                    {
                        Soccod = c.Soccod,
                        Concod = c.Concod,
                        Emplib = e.Emplib,
                        Empcod = e.Empcod,
                        Condat = c.Condat,
                        Condep = c.Condep,
                        Conret = c.Conret,
                        Connbjour = c.Connbjour,
                        Abslib = a.Abslib,
                    }).ToListAsync();

                // Dédoublonnage et tri en mémoire
                List<SanctionEmpDto> result = rawResult
                    .DistinctBy(s => s.Concod)
                    .OrderByDescending(s => s.Condat)
                    .ToList();

                return result;
            }
            catch (Exception ex)
            {
                throw;
            }
        }

        public async Task<Sanction> GetSanction(string soccod, string concod)
        {
            if (string.IsNullOrWhiteSpace(soccod) || string.IsNullOrWhiteSpace(concod))
                throw new ArgumentNullException("veuillez saisie les champs obligatoires");
            try
            {
                Sanction? sanction = await _dbContext
                    .Sanctions.FirstOrDefaultAsync(s => s.Soccod == soccod && s.Concod == concod);
                if (sanction == null)
                    return new Sanction();
                return sanction;
            }
            catch (Exception ex)
            {
                throw new Exception("Erreur innatendu: "+ ex);
            }
            
        }

        public void Update(Sanction sanction)
        {
            if (sanction != null)
            {
                _dbContext.Sanctions.Update(sanction);
                _dbContext.SaveChanges();
            }
        }
        
        public async Task<Dictionary<(string Empcod, DateTime Date), string>> GetAbsenceLibBatch(string soccod,string empcod,DateTime dateDeb,DateTime dateFin)
        {
            var result = await (
                from s in _dbContext.Sanctions
                join a in _dbContext.Absences
                    on new { s.Soccod, s.Abscod } equals new { a.Soccod, a.Abscod }
                where s.Soccod == soccod
                    && s.Empcod == empcod
                    && s.Condep <= dateFin
                    && s.Conret >= dateDeb
                select new
                {
                    s.Empcod,
                    s.Condep,
                    s.Conret,
                    a.Abslib
                })
                .ToListAsync();

            return result.ToDictionary(
                x => (x.Empcod, x.Condep.Value.Date),
                x => x.Abslib
            );
        }

        public async Task<string?> GetAbsenceLib(string? soccod, string? empcod, DateTime dmdate)
        {
            try
            {
                var abslib = await (from s in _dbContext.Sanctions
                                    join a in _dbContext.Absences
                                        on new { s.Soccod, s.Abscod } equals new { a.Soccod, a.Abscod }
                                    where s.Soccod == soccod
                                          && s.Empcod == empcod
                                          && s.Condep <= dmdate && s.Conret > dmdate
                                    select a.Abslib)
                                  .FirstOrDefaultAsync();

                return abslib;
            }
            catch (Exception)
            {
                throw;
            }
        }

        public async Task<bool> IsDeplacement(string soccod, string empcod, DateTime? predat)
        {
            try
            {
                var result = await (
                    from s in _dbContext.Sanctions
                    join a in _dbContext.Absences
                        on new { s.Soccod, s.Abscod } equals new { a.Soccod, a.Abscod }
                    where s.Soccod == soccod
                          && s.Empcod == empcod
                          && s.Condep <= predat
                          && s.Conret > predat
                          && a.Abscng == "6"
                    select a
                ).AnyAsync();

                return result;
            }
            catch (Exception)
            {
                throw;
            }
        }
        //public async Task<bool> IsValid(Presence presence,string soccod,DateTime? date,string codposte)
        //{
        //    int actions = 0;
        //    if (!string.IsNullOrEmpty(presence?.Preentmatup) && !string.IsNullOrEmpty(presence?.Presortmatup))
        //        actions++;
        //    if (!string.IsNullOrEmpty(presence?.Preentamidiup) && !string.IsNullOrEmpty(presence?.Presortamidiup))
        //        actions++;
        //    bool isRepos = await _parametreRepository.IsRepos(soccod, date, codposte);
        //    if (actions == 0 && (presence?.Prerepos == "0" || !isRepos)) return true;
        //    return actions != 0 && presence?.Prerepos == "0";
        //}
        public async Task<SanctionDto?> GetAbsence(string soccod, string? empcod, DateTime? date)
        {
            try
            {
                var result = await (
                    from s in _dbContext.Sanctions
                    join a in _dbContext.Absences
                        on new { s.Soccod, s.Abscod } equals new { a.Soccod, a.Abscod }
                    where s.Soccod == soccod
                          && s.Empcod == empcod
                          && s.Condep <= date
                          && s.Conret > date
                    select new SanctionDto
                    {
                        Concod = s.Concod,
                        Abslib = a.Abslib,
                        Soccod = s.Soccod,
                        Conret = s.Conret,
                        Abscod = s.Abscod,
                        Connbjour = s.Connbjour,
                        Abscng = a.Abscng,
                        Abspaye = a.Abspayer
                    }
                ).FirstOrDefaultAsync();

                if (result == null)
                {
                    var presence = await _dbContext.Presences
                        .Where(p => p.Predat == date && p.Soccod == soccod && p.Empcod == empcod)
                        .FirstOrDefaultAsync();

                    // Vérifier d'abord si la présence indique une absence
                    if (GenericMethodes.NotPresent(presence))
                    {
                        string? codpost = await _employeRepository.GetEmpPoste(soccod, empcod, date);

                        // Appeler IsValid seulement si on a un codpost ou si on peut gérer le null
                        if (await IsValid(presence, soccod, date, codpost,empcod))
                        {
                            result = new SanctionDto()
                            {
                                Soccod = soccod,
                                Abscng = "3"
                            };
                        }
                    }
                }

                return result;
            }
            catch (Exception)
            {
                throw;
            }
        }

        public async Task<bool> IsValid(Presence presence, string soccod, DateTime? date, string? codposte, string empcod)
        {
            int actions = 0;

            // Compter le nombre d'actions (pointages) effectuées
            if (!string.IsNullOrEmpty(presence?.Preentmatup) && !string.IsNullOrEmpty(presence?.Presortmatup))
                actions++;
            if (!string.IsNullOrEmpty(presence?.Preentamidiup) && !string.IsNullOrEmpty(presence?.Presortamidiup))
                actions++;

            // Vérifier si c'est un jour de repos selon la configuration
            bool isRepos = false;
            string empferepos = "0";

            if (!string.IsNullOrEmpty(codposte))
            {
                (isRepos, empferepos) = await _parametreRepository.IsEmpcodRepos(soccod, date, codposte, empcod);
            }

            // Si aucune action ET (pas marqué comme repos OU n'est pas un jour de repos configuré)
            if (actions == 0 && (presence?.Prerepos == "0" || !isRepos))
                return false; // Invalide car aucun pointage et pas de repos justifié

            // Si des actions existent ET pas marqué comme repos
            if (actions > 0 && presence?.Prerepos == "0")
                return true; // Valide car il y a des pointages

            // Si marqué comme repos ET c'est effectivement un jour de repos configuré
            if (presence?.Prerepos == "1" && isRepos)
                return true; // Valide car repos justifié

            // Si marqué comme repos MAIS ce n'est PAS un jour de repos configuré
            if (presence?.Prerepos == "1" && !isRepos)
                return false; // Invalide car repos injustifié

            return false;
        }
        public Task<bool> IsSanction(string soccod, string? empcod, DateTime? predat)
        {
            throw new NotImplementedException();
        }
    }
}
