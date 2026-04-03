using ABRPOINT.Server.Interfaces;
using ABRPOINT.Server.Models;
using Microsoft.AspNetCore.Mvc;

namespace ABRPOINT.Server.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class ParTranchesController : ControllerBase
    {
        private readonly IparTrancheRepository _parTrancheRepository;
        public ParTranchesController(IparTrancheRepository parTrancheRepository)
        {
            _parTrancheRepository = parTrancheRepository;
        }

        [HttpGet("{soccod}")]
        public async Task<IActionResult> GetParTranches(string soccod)
        {
            try
            {
                IList<Partranche> parTranche = await _parTrancheRepository.GetPartranche(soccod);
                return Ok(parTranche);
            }
            catch (Exception)
            {
                throw;
            }
        }
        [HttpPut]
        public async Task<bool> UpdateParTranches(List<Partranche> partranche)
        {
            try
            {
                if(partranche != null)
                {
                    bool parTranche = await _parTrancheRepository.UpdateParTranche(partranche);
                    return true;
                }
                return false;
            }
            catch (Exception)
            {
                throw;
            }
        }
    }
}
