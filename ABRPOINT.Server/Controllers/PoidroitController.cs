using ABRPOINT.Server.Annotations.AdminAttributes;
using ABRPOINT.Server.Dtaos;
using ABRPOINT.Server.Interfaces;
using ABRPOINT.Server.Models;
using Microsoft.AspNetCore.Mvc;

namespace ABRPOINT.Server.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    [Admin]
    public class PoidroitController : ControllerBase
    {
        private readonly IPointdroitRepository _pointdroitRepository;
        public PoidroitController(IPointdroitRepository pointdroitRepository)
        {
            _pointdroitRepository = pointdroitRepository;
        }
        [HttpGet("{soccod}/{uticod}")]
        public async Task<List<PointdroitDto?>> GetPointdroit(string soccod, string uticod)
        {
            try
            {
                var pointdroits = await _pointdroitRepository.GetPointdroit(soccod, uticod);
                return pointdroits;
            }
            catch (Exception)
            {
                throw;
            }
        }
        [HttpPut]
        public async Task<bool> UpdatePointdroit([FromBody] List<Pointdroit> pointdroit)
        {
            try
            {
                bool pointdroits = await _pointdroitRepository.UpdatePointdroit(pointdroit);
                return pointdroits;
            }
            catch (Exception)
            {
                throw;
            }
        }
    }
}
