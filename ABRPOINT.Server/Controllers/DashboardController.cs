using ABRPOINT.Server.CalculService.DashboardService;
using ABRPOINT.Server.Dtaos;
using Microsoft.AspNetCore.Mvc;

namespace ABRPOINT.Server.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class DashboardController : ControllerBase
    {
        private readonly IDashboardService _dashboardService;

        public DashboardController(IDashboardService dashboardService)
        {
            _dashboardService = dashboardService;
        }
        [HttpPost("data")]
        public async Task<ActionResult<DashboardData>> GetDashboardData([FromBody] DashboardRequest request)
        {
            if (string.IsNullOrEmpty(request.Soccod))
                return BadRequest("Le code société est requis");

            var dateDebut = request.DateDebut ?? request.Date ?? DateTime.Today;
            var dateFin = request.DateFin ?? request.Date ?? DateTime.Today;

            if (dateDebut > dateFin)
                return BadRequest("Date début > date fin");

            var data = await _dashboardService.GetDashboardData(
                request.Soccod,
                dateDebut,
                dateFin,
                request.Departement,
                request.Empcods
            );

            return Ok(data);
        }
        [HttpPost("get-pointage-invalides")]
        public async Task<List<PointageInvalideDto>> GetPointageInvalide([FromBody] DashboardRequest request)
        {
            try
            {
                var result = await _dashboardService.GetPointagesInvalides(request);
                return result;
            }
            catch (Exception)
            {
                throw;
            }
        }
        /// <summary>
        /// Récupère l'évolution des données sur une période
        /// </summary>
        [HttpPost("evolution")]
        public async Task<ActionResult<List<EvolutionJournaliere>>> GetEvolution([FromBody] EvolutionRequest request)
        {
            try
            {
                if (string.IsNullOrEmpty(request.Soccod))
                {
                    return BadRequest("Le code société est requis");
                }

                if (request.DateDebut == default || request.DateFin == default)
                {
                    return BadRequest("Les dates de début et fin sont requises");
                }

                if (request.DateDebut > request.DateFin)
                {
                    return BadRequest("La date de début doit être antérieure à la date de fin");
                }

                // Limiter à 90 jours maximum
                if ((request.DateFin - request.DateDebut).TotalDays > 90)
                {
                    return BadRequest("La période ne peut pas dépasser 90 jours");
                }

                var evolution = await _dashboardService.GetEvolutionHebdomadaire(
                    request.Soccod,
                    request.DateDebut,
                    request.DateFin,
                    request.Departement,
                    request.Empcods
                );

                return Ok(evolution);
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = "Erreur lors de la récupération de l'évolution", error = ex.Message });
            }
        }

        /// <summary>
        /// Récupère la liste des employés avec leur statut du jour
        /// </summary>
        [HttpPost("employes-statut")]
        public async Task<ActionResult<List<EmployeStatut>>> GetEmployesStatut([FromBody] DashboardRequest request)
        {
            try
            {
                if (string.IsNullOrEmpty(request.Soccod))
                {
                    return BadRequest("Le code société est requis");
                }

                var employes = await _dashboardService.GetEmployesStatutJour(
                    request.Soccod,
                    request.Date ?? DateTime.Today,
                    request.Departement,
                    request.Empcods
                );

                return Ok(employes);
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = "Erreur lors de la récupération des statuts", error = ex.Message });
            }
        }

        /// <summary>
        /// Récupère un résumé rapide pour aujourd'hui
        /// </summary>
        [HttpGet("resume-jour/{soccod}/{departement}")]
        public async Task<ActionResult<ResumeDuJour>> GetResumeDuJour(string soccod,string departement)
        {
            try
            {
                if (string.IsNullOrEmpty(soccod))
                {
                    return BadRequest("Le code société est requis");
                }

                var data = await _dashboardService.GetDashboardData(
                    soccod,
                    DateTime.Today,
                    departement,
                    null
                );

                var resume = new ResumeDuJour
                {
                    Date = DateTime.Today,
                    EffectifPresent = data.EffectifPresent,
                    EffectifTotal = data.EffectifTotal,
                    TauxPresence = data.PourcentagePresence,
                    HeuresTravaillees = data.HeuresTravaillees,
                    Retards = data.NombreEmployesEnRetard,
                    Absences = data.TotalAbsences,
                    DemandesEnAttente = data.TotalDemandesEnAttente,
                    Anomalies = data.PointagesIncomplets
                };

                return Ok(resume);
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = "Erreur lors de la récupération du résumé", error = ex.Message });
            }
        }

        /// <summary>
        /// Récupère les KPIs pour plusieurs départements
        /// </summary>
        [HttpPost("kpis-departements")]
        public async Task<ActionResult<List<KpiDepartement>>> GetKpisDepartements([FromBody] DashboardRequest request)
        {
            try
            {
                if (string.IsNullOrEmpty(request.Soccod))
                {
                    return BadRequest("Le code société est requis");
                }

                var data = await _dashboardService.GetDashboardData(
                    request.Soccod,
                    request.Date ?? DateTime.Today,
                    null, // Tous les départements
                    request.Empcods
                );

                var kpis = new List<KpiDepartement>();

                if (data.DonneesDepartements != null && data.DonneesDepartements.Any())
                {
                    foreach (var dept in data.DonneesDepartements)
                    {
                        kpis.Add(new KpiDepartement
                        {
                            Departement = dept.Departement,
                            EffectifTotal = dept.EffectifTotal,
                            EffectifPresent = dept.EffectifPresent,
                            TauxPresence = dept.PourcentagePresence
                        });
                    }
                }

                return Ok(kpis);
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = "Erreur lors de la récupération des KPIs", error = ex.Message });
            }
        }
    
    }
}


// DTOs pour les requêtes
public class DashboardRequest
{
    public string Soccod { get; set; }
    public DateTime? Date { get; set; }
    public string? Departement { get; set; }
    public List<string>? Empcods { get; set; }

    // Nouveaux champs pour les plages de dates
    public string? DateRange { get; set; }
    public DateTime? DateDebut { get; set; }
    public DateTime? DateFin { get; set; }
}

public class EvolutionRequest
{
    public string Soccod { get; set; }
    public DateTime DateDebut { get; set; }
    public DateTime DateFin { get; set; }
    public string? Departement { get; set; }
    public List<string> Empcods { get; set; }
}

// DTOs pour les réponses
public class ResumeDuJour
{
    public DateTime Date { get; set; }
    public int EffectifPresent { get; set; }
    public int EffectifTotal { get; set; }
    public decimal TauxPresence { get; set; }
    public float HeuresTravaillees { get; set; }
    public int Retards { get; set; }
    public int Absences { get; set; }
    public int DemandesEnAttente { get; set; }
    public int Anomalies { get; set; }
}

public class KpiDepartement
{
    public string Departement { get; set; }
    public int EffectifTotal { get; set; }
    public int EffectifPresent { get; set; }
    public decimal TauxPresence { get; set; }
}
