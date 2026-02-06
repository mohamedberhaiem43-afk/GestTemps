using ABRPOINT.Server.CalculService.HeureSupp;
using ABRPOINT.Server.Dtaos;
using ABRPOINT.Server.Interfaces;

namespace ABRPOINT.Server.Repository
{
    public class PointageMoisService : IPointageMoisService
    {
        private readonly IEmployeRepository _employeRepository;
        private readonly IHeuresSupplementaireHebdomadairesService _heuresSupplementairesService;

        public PointageMoisService(IEmployeRepository employeRepository,IHeuresSupplementaireHebdomadairesService heuresSupplementairesService)
        {
            _employeRepository = employeRepository;
            _heuresSupplementairesService = heuresSupplementairesService;
        }

        public async Task<List<PointageMois>> GetPointageMois(string soccod,List<string> empcods,string mois,string annee,string semaine)
        {
            var pointages = new List<PointageMois>();

            foreach (var empcod in empcods)
            {
                var employe = await _employeRepository.GetByEmpcod(soccod, empcod);
                if (employe == null) continue;

                var pointageMois = new PointageMois
                {
                    EmpCode = empcod,
                    EmpMat = employe.Empmat,
                    EmpLib = employe.Emplib,
                    EmpReg = employe.Empreg,
                    EmpSite = employe.Sitcod
                };

                if (semaine == "0")
                {
                    var resultats =
                        await _heuresSupplementairesService
                            .CalculerHeuresSupplementairesMultiSemaines(
                                soccod, empcod, mois, annee,
                                employe.Empreg, employe.Empniv);

                    pointageMois.heuresSupplementairesResultats.AddRange(resultats);
                }
                else
                {
                    var resultat =
                        await _heuresSupplementairesService
                            .CalculerHeuresSupplementairesHebdomadaires(
                                soccod, empcod, mois, annee, semaine,
                                employe.Empreg, employe.Empniv);

                    pointageMois.heuresSupplementairesResultats.Add(resultat);
                }

                pointages.Add(pointageMois);
            }

            return pointages;
        }
    }

}
