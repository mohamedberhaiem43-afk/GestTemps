using ABRPOINT.Server.Repository;
using Microsoft.AspNetCore.Mvc;

namespace ABRPOINT.Server.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class PointageMoisController : ControllerBase
    {
        private readonly IPointageMoisService _pointageMoisService;
        public PointageMoisController(IPointageMoisService pointageMoisService)
        {
            _pointageMoisService = pointageMoisService;
        }
        //[CanGetEtatMensuelle]
        [HttpGet("{soccod}/{mois}/{annee}/{semaine}")]
        public async Task<IActionResult> GetPointageMois(string soccod,[FromQuery] List<string> empcods,string mois,string annee,string semaine)
        {
            try
            {
                var result = await _pointageMoisService
                    .GetPointageMois(soccod, empcods, mois, annee, semaine);

                return Ok(result);
            }
            catch (Exception)
            {
                throw;
            }
        }
    }
}
