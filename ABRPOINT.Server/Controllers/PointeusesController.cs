using ABRPOINT.Helper;
using ABRPOINT.Server.Dtaos;
using ABRPOINT.Server.Interfaces;
using ABRPOINT.Server.Models;
using ABRPOINT.Server.Services;
using Microsoft.AspNetCore.Mvc;

namespace ABRPOINT.Server.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    //[Authorize]
    public class PointeuseController : ControllerBase
    {
        private readonly IPointeuseRepository _pointeuseRepository;
        private readonly IEmployeRepository _employeRepository;
        private readonly IPresenceRepository _presenceRepository;
        private readonly IParametreRepository _parametreRepository;
        private readonly IPointeuseHttpService _httpService;
        public PointeuseController(IPointeuseRepository pointeuseRepository, IEmployeRepository employeRepository,
            IPresenceRepository presenceRepository,IPointeuseHttpService httpService,IParametreRepository parametreRepository)
        {
            _pointeuseRepository = pointeuseRepository;
            _employeRepository = employeRepository;
            _parametreRepository = parametreRepository;
            _presenceRepository = presenceRepository;
            _httpService = httpService;

        }

        [HttpPost("connect-pointeuse/{soccod}")]
        public async Task<IActionResult> ConnectPointeusesAsync(string soccod, [FromQuery] string ip, [FromQuery] string pswd)
        {
            var results = new List<string>();
            try
            {
                var latestLog = await _httpService.GetLatestLogAsync(ip, pswd);

                if (latestLog == null)
                {
                    results.Add($"No log found for {ip}");
                }
                else
                {
                    string poicod = await _pointeuseRepository.GetByIp(soccod, ip);
                    await _presenceRepository.AddPresence(soccod, latestLog.Employe_code, latestLog.Time,poicod);
                    results.Add($"OK: {latestLog.Employe_code} at {latestLog.Time} from {ip}");
                }
            }
            catch (Exception ex)
            {
                results.Add($"Error on {ip}: {ex.Message}");
            }
            return Ok(results);
        }

        [HttpPost("purger")]
        public async Task<IActionResult> PurgerPointeuse([FromQuery] string soccod, [FromQuery] string poicod, [FromQuery] string ip, [FromQuery] int port = 4370, [FromQuery] int pswd = 123456)
        {
            try
            {
                var cleared = await _httpService.ClearLogsAsync(ip, port, pswd);
                return Ok(cleared ? "Logs purged successfully" : "Failed to purge logs");
            }
            catch (Exception ex)
            {
                return BadRequest($"Error purging logs: {ex.Message}");
            }
        }

        [HttpGet("get-pointages")]
        public async Task<IActionResult> GetPointages([FromQuery] string[] poicods)
        {
            try
            {
                if (poicods.Length == 0)
                {
                    return BadRequest(new
                    {
                        data = new List<object>(),
                        Message = "No poicod provided"
                    });
                }
                
                List<PointeuseType> pointeuseTypes = await _pointeuseRepository.GetPointeuseTypesByPoicod(poicods);
                // 🔎 Récupérer les logs via le service
                var logs = await _httpService.GetLogsAsync(pointeuseTypes);
                if (logs == null || logs.Count == 0)
                    return NotFound("No attendance logs found.");

                // 🔎 Enrichir les logs avec les noms
                foreach (var log in logs)
                {
                    short? longbdg = await _parametreRepository.GetLongbdg(pointeuseTypes[0].Soccod);
                    string empcode = GenericMethodes.FormatEmpmat(log.Employe_code, longbdg);
                    string emplib = await _employeRepository.GetByEmpMat(empcode);
                    log.User_name = emplib;
                }

                return Ok(new
                {
                    data = logs,
                    Message = $"{logs.Count} logs retrieved successfully"
                });
            }
            catch (Exception ex)
            {
                return StatusCode(500, $"Internal server error: {ex.Message}");
            }
        }

        // GET: api/Pointeuse
        [HttpGet("{soccod}")]
        public async Task<ActionResult<IEnumerable<Pointeuse>>> GetAll(string soccod)
        {
            try
            {
                IEnumerable<Pointeuse> pointeuses = await _pointeuseRepository.GetAllAsync(soccod);
                return Ok(pointeuses);
            }
            catch (Exception)
            {
                return StatusCode(500);
            }
        }
        [HttpGet("lecture-pointeuse/{soccod}")]
        public async Task<ActionResult<IEnumerable<PointeuseDto>>> GetAllPointeuse(string soccod)
        {
            try
            {
                IEnumerable<PointeuseDto> pointeuses = await _pointeuseRepository.GetAllAsyncWithLatestRead(soccod);
                return Ok(pointeuses);
            }
            catch (Exception)
            {
                return StatusCode(500);
            }
        }

        [HttpGet("get-ips/{soccod}")]
        public async Task<ActionResult<IEnumerable<string>>> GetAllIps(string soccod)
        {
            try
            {
                var pointeuses = await _pointeuseRepository.GetAllIps(soccod);
                return Ok(pointeuses);
            }
            catch (Exception)
            {

                return StatusCode(500);
            }

        }

        // GET: api/Pointeuse/{poicod}/{soccod}
        [HttpGet("{poicod}/{soccod}")]
        public ActionResult<Pointeuse> Get(string poicod, string soccod)
        {
            var pointeuse = _pointeuseRepository.GetById(poicod, soccod);
            if (pointeuse == null)
            {
                return NotFound();
            }

            return Ok(pointeuse);
        }

        // POST: api/Pointeuse
        [HttpPost]
        public async Task<ActionResult<Pointeuse>> Create(Pointeuse pointeuse)
        {
            if (pointeuse == null)
                return BadRequest("Veuillez remplir tous les champs obligatoires");
            try
            {
                Pointeuse dbpointeuse = await _pointeuseRepository.GetById(pointeuse.Poicod,pointeuse.Soccod);
                if (dbpointeuse != null)
                    await Update(pointeuse.Poicod, pointeuse.Soccod, pointeuse);
                else
                    await _pointeuseRepository.AddAsync(pointeuse);
                return CreatedAtAction(nameof(Get), new { poicod = pointeuse.Poicod, soccod = pointeuse.Soccod }, pointeuse);
            }
            catch (Exception ex)
            {
                return StatusCode(500,ex);
            }
        }

        // PUT: api/Pointeuse/{poicod}/{soccod}
        [HttpPut("{poicod}/{soccod}")]
        public async Task<IActionResult> Update(string poicod, string soccod, Pointeuse pointeuse)
        {
            if (poicod != pointeuse.Poicod || soccod != pointeuse.Soccod)
            {
                return BadRequest();
            }

            _pointeuseRepository.Update(pointeuse);
            return NoContent();
        }

        // DELETE: api/Pointeuse/{poicod}/{soccod}
        [HttpDelete("{soccod}/{poicod}")]
        public async Task<IActionResult> Delete(string poicod, string soccod)
        {
            try
            {
                var pointeuse = await _pointeuseRepository.GetById(poicod, soccod);
                if (pointeuse == null)
                {
                    return NotFound();
                }   

                _pointeuseRepository.Delete(pointeuse);
                return NoContent();
            }
            catch (Exception)
            {
                throw;
            }
        }
    }
}
/*
 

using System;
using zkemkeeper;

class Program
{
    static void Main(string[] args)
    {
        CZKEM axCZKEM1 = new CZKEM();
        
        // Connexion à la pointeuse
        bool bIsConnected = axCZKEM1.Connect_Net("192.168.1.201", 4370);
        
        if (bIsConnected)
        {
            Console.WriteLine("Connexion réussie !");
            
            // Lire les logs d'entrée/sortie
            int dwEnrollNumber = 0;
            int dwVerifyMode = 0;
            int dwInOutMode = 0;
            int dwWorkCode = 0;
            
            axCZKEM1.ReadGeneralLogData();
            while (axCZKEM1.SSR_GetGeneralLogData(ref dwEnrollNumber, ref dwVerifyMode, ref dwInOutMode, ref dwWorkCode))
            {
                Console.WriteLine($"Employé {dwEnrollNumber}, Mode de vérification {dwVerifyMode}, Mode d'entrée/sortie {dwInOutMode}, Code de travail {dwWorkCode}");
            }
        }
        else
        {
            Console.WriteLine("Échec de la connexion à la pointeuse.");
        }

        // Déconnexion
        axCZKEM1.Disconnect();
    }
}
 

 
 */