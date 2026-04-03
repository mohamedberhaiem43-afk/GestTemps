using ABRPOINT.Server.Data;
using ABRPOINT.Server.Dtaos;
using ABRPOINT.Server.Exceptions;
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
        public AbsenceRepository(ApplicationDbContext dbContext,IEmployeRepository employeRepository,ISanctionRepository sanctionRepository)
        {
            _dbContext = dbContext;
            _employeRepository = employeRepository;
            _sanctionRepository = sanctionRepository;

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
                throw new RepositoryException("Probléme au niveau base de donnée",dbEx);
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

            // ================= Helpers =================
            static int GetMinutes(DateTime? t)
                => t.HasValue ? (int)t.Value.TimeOfDay.TotalMinutes : 0;

            static string FormatMinutes(int minutes)
                => TimeSpan.FromMinutes(minutes).ToString(@"hh\:mm");


            // ================= Employés =================
            var employes = await _dbContext.Employes
                .AsNoTracking()
                .Where(e => e.Soccod == soccod && empcods.Contains(e.Empcod))
                .ToDictionaryAsync(e => e.Empcod);

            // ================= Sanctions =================
            var sanctions = await (
                from s in _dbContext.Sanctions.AsNoTracking()
                join a in _dbContext.Absences.AsNoTracking()
                    on new { s.Soccod, s.Abscod } equals new { a.Soccod, a.Abscod }
                where s.Soccod == soccod
                      && empcods.Contains(s.Empcod)
                      && s.Condep <= datefin
                      && s.Conret >= datedebut
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

            // ================= Présences =================
            var presences = await _dbContext.Presences
                .AsNoTracking()
                .Where(p => p.Soccod == soccod
                         && empcods.Contains(p.Empcod)
                         && p.Predat >= datedebut
                         && p.Predat <= datefin)
                .Select(p => new
                {
                    p.Empcod,
                    p.Predat,
                    p.Preretmateup,
                    p.Preretmatsup,
                    p.Preretameup,
                    p.Preretamsup,
                    p.Tothabs
                })
                .ToListAsync();


            // clé logique : (employé + date)
            var result = new Dictionary<(string Empcod, DateTime Date), EtatAbsence>();


            // ================= TRAITEMENT ABSENCES =================
            foreach (var sanction in sanctions)
            {
                if (!employes.TryGetValue(sanction.Empcod, out var employe))
                    continue;

                for (var date = sanction.Condep!.Value.Date; date <= sanction.Conret!.Value.Date; date = date.AddDays(1))
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


            // ================= TRAITEMENT RETARDS =================
            foreach (var presence in presences)
            {
                if (!employes.TryGetValue(presence.Empcod, out var employe))
                    continue;

                int totalRetard =
                    GetMinutes(presence.Preretmateup) +
                    GetMinutes(presence.Preretmatsup) +
                    GetMinutes(presence.Preretameup) +
                    GetMinutes(presence.Preretamsup);

                if (totalRetard == 0 && (string.IsNullOrEmpty(presence.Tothabs) && presence.Tothabs == "00:00"))
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


            // ================= RESULTAT FINAL =================
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

                throw new RepositoryException("Probléme au niveau base de donnée ",dbEx);
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
                throw new InvalidOperationException("clé dupliqué est détéctée ",opEx);
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
                throw new ArgumentException("code société est null",nameof(soccod));
            try
            {
                IEnumerable<Absence> absences = _dbContext.Absences
                    .Where(a => a.Soccod == soccod)
                    .GroupBy(a =>new { a.Abscod, a.Soccod })
                    .Select(g=>g.First())
                    .ToList();
                if (absences == null)
                    throw new ArgumentNullException("Aucune absences trouvée");

                return absences;
                
            }
            catch (Exception ex)
            {

                throw new RepositoryException("Erreur innatendue s'est produit lors de récupération d'absences "
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
                    throw new ArgumentNullException($"Aucun absence trouvée avec code societe '{soccod}'" +
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
