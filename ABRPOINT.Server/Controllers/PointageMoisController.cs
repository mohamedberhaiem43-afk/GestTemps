using ABRPOINT.Server.Annotations.EtatsAttributes;
using ABRPOINT.Server.CalculService.HeureSupp;
using ABRPOINT.Server.Dtaos;
using ABRPOINT.Server.Interfaces;
using Microsoft.AspNetCore.Mvc;

namespace ABRPOINT.Server.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class PointageMoisController : ControllerBase
    {
        private readonly IEmployeRepository _employeRepository;
        private readonly IHeuresSupplementaireHebdomadairesService _heuresSupplementairesService;
        public PointageMoisController(IHeuresSupplementaireHebdomadairesService heuresSupplementairesService,IEmployeRepository employeRepository)
        {
            _heuresSupplementairesService = heuresSupplementairesService;
            _employeRepository = employeRepository;
        }
        [HttpGet("{soccod}/{mois}/{annee}/{semaine}")]
        [CanGetEtatMensuelle]
        public async Task<IActionResult> GetPointageMois(string soccod,[FromQuery] List<string> empcods,string mois,string annee,string semaine)
        {
            {
                try
                {
                    List<PointageMois> pointages = new List<PointageMois>();

                    foreach (var empcod in empcods)
                    {
                        PointageMois pointageMois = new PointageMois();
                        pointageMois.EmpCode = empcod;

                        var employe = await _employeRepository.GetByEmpcod(soccod, empcod);
                        if (employe == null) continue;

                        pointageMois.EmpMat = employe.Empmat;
                        pointageMois.EmpLib = employe.Emplib;
                        pointageMois.EmpReg = employe.Empreg;
                        pointageMois.EmpSite = employe.Sitcod;

                        if (semaine == "0")
                        {
                            for (int i = 1; i <= 6; i++)
                            {
                                var resultat = await _heuresSupplementairesService
                                    .CalculerHeuresSupplementairesHebdomadaires(
                                        soccod, empcod, mois, annee, i.ToString(),
                                        employe.Empreg, employe.Empniv);

                                pointageMois.heuresSupplementairesResultats.Add(resultat);
                            }
                        }
                        else
                        {
                            var resultat = await _heuresSupplementairesService
                                .CalculerHeuresSupplementairesHebdomadaires(
                                    soccod, empcod, mois, annee, semaine,
                                    employe.Empreg, employe.Empniv);

                            pointageMois.heuresSupplementairesResultats.Add(resultat);
                        }

                        pointages.Add(pointageMois);
                    }

                    return Ok(pointages);
                }
                catch (Exception ex)
                {
                    throw;
                }
            }
        }
    }
}
