using ABRPOINT.Server.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace ABRPOINT.Server.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    [Authorize]
    public class CalendsocsController : ControllerBase
    {
        private readonly ICalendrierRepository _calendrierRepository;

        public CalendsocsController(ICalendrierRepository calendrierRepository)
        {
            _calendrierRepository = calendrierRepository;
        }
        [HttpGet("{soccod}/{annee}")]
        public async Task<IActionResult> GetCumul(string soccod, string annee)
        {
            try
            {
                var cummul = await _calendrierRepository.GetCumulAsync(soccod, annee);
                return Ok(cummul);
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Erreur lors de la récupération du cumul: erreur interne");
                return StatusCode(500, "Erreur interne du serveur");
            }
        }
        [HttpGet("get-calendrier/{soccod}/{annee}")]
        public async Task<IActionResult> GetAnneeCalendrier(string soccod, string annee)
        {
            try
            {
                var cummul = await _calendrierRepository.GetAnneeCalendrierAsync(soccod, annee);
                return Ok(cummul);
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Erreur lors de la récupération de la calendrier: erreur interne");
                return StatusCode(500, "Erreur interne du serveur");
            }
        }
        [HttpGet("get-calendrier/{soccod}")]
        public async Task<IDictionary<string,string>> GetCalendriers(string soccod)
        {
            try
            {
                IDictionary<string, string> calendriers = await _calendrierRepository.GetCalendriersAsync(soccod);
                return calendriers;
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Erreur lors de la récupération de la calendrier: erreur interne");
                return (IDictionary<string, string>)StatusCode(500, "Erreur interne du serveur");
            }
        }
        [HttpPut("update-calendrier/{soccod}/{caltype}/{annee}/{tousMois}/{mois}/{nbhJours}/{jourRepos}/{nbhSamedi}")]
        public async Task<IActionResult> UpdateCalendrier(string soccod,string caltype, string annee,byte tousMois,
                                                          string mois,float nbhJours,string jourRepos,float nbhSamedi)
        {
            try
            {
                await _calendrierRepository.UpdateCalendrierAsync(soccod,caltype, annee,nbhJours,nbhSamedi,jourRepos,mois,tousMois);
                return Ok("Calendrier modifiée avec sucées");
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Erreur lors de la modification de la calendrier: erreur interne");
                return StatusCode(500, "Erreur interne du serveur");
            }
        }

        [HttpPost("add-calendrier/{soccod}/{annee}/{caltype}")]
        public async Task<IActionResult> AddCalendrier(string soccod, string annee, string caltype)
        {
            try
            {
                await _calendrierRepository.AddCalendrierAsync(soccod, annee, caltype);
                return Ok("Calendrier ajouté avec succès");
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Erreur lors de l'ajout du calendrier: erreur interne");
                return StatusCode(500, "Erreur interne du serveur");
            }
        }

    }
}
