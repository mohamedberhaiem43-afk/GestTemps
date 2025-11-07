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
        private readonly ISanctionRepository _sanctionRepository;
        private readonly IEmployeRepository _employeRepository;
        public AbsenceRepository(ApplicationDbContext dbContext, ISanctionRepository sanctionRepository,IEmployeRepository employeRepository)
        {
            _dbContext = dbContext;
            _sanctionRepository = sanctionRepository;
            _employeRepository = employeRepository;

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

        public async Task<List<EtatAbsence>> GetEtatAbsence(string soccod, DateTime datedebut, DateTime datefin,
            bool absaut,bool absret,bool presNonOpt,bool sansPointageInvalide,string? selectedAbsType,List<string>? empcods)
        {
            try
            {
                var result = new List<EtatAbsence>();

                // Validate empcods
                if (empcods == null || empcods.Count == 0)
                    return result;

                // Generate the full range of dates between start and end
                var dates = Enumerable.Range(0, (datefin - datedebut).Days + 1)
                                      .Select(offset => datedebut.AddDays(offset))
                                      .ToList();

                foreach (var empcod in empcods)
                {
                    var employe = await _employeRepository.GetByEmpcod(soccod, empcod);                  
                    foreach (var date in dates)
                    {
                        var sanction = await _sanctionRepository.GetAbsence(soccod, empcod, date);
                        if (sanction != null)
                        {
                            var etatAbsence = new EtatAbsence
                            {
                                Empcod = empcod,
                                Empmat = employe.Empmat,
                                Emplib = employe.Emplib,
                                Empreg = employe.Empreg,
                                Date = date,
                                Abscod = sanction.Abscod,
                                Motif = sanction.Abslib
                            };

                            if (sanction.Abspaye == "O" || sanction.Abspaye == "N")
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
                                    if (!string.IsNullOrEmpty(sanction.Abslib) && sanction.Abslib.ToLower() == "maladie")
                                        etatAbsence.Absmal = 1;
                                    break;
                            }

                            result.Add(etatAbsence);
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
