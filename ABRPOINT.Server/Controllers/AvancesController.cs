using ABRPOINT.Server.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace ABRPOINT.Server.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    [Authorize]
    public class AvancesController : Controller
    {
        private readonly IAvanceRepository _avanceRepository;
        public AvancesController(IAvanceRepository avanceRepository)
        {
            _avanceRepository = avanceRepository;
        }
        [HttpGet("{soccod}/{mois}/{annee}/{niveau}")]
        public async Task<IActionResult> AvancesList(string soccod,string mois,string annee,string niveau)
        {
            try
            {
                var avances = await _avanceRepository.GetAvances(soccod,mois,annee,niveau);
                return Json(avances);
            }
            catch (Exception)
            {
                throw;
            }
        }
        [HttpPut("{soccod}/{mois}/{annee}/{empcod}/{niveau}/{montant}")]
        public async Task<IActionResult> UpdateAvance(string soccod,string mois,string annee,string empcod,string niveau,float montant)
        {
            try
            {
                await _avanceRepository.UpdateAvance(soccod,mois,annee,empcod,niveau,montant);
                return Json(new {isValid =true});
            }
            catch (Exception)
            {
                throw;
            }
        }
    }
}
