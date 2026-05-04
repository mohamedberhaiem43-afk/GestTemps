using ABRPOINT.Server.Annotations.EtatPriodiqueAttributes;
using ABRPOINT.Server.Dtaos;
using ABRPOINT.Server.Interfaces;
using ABRPOINT.Server.Models;
using ABRPOINT.Server.Repository;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace ABRPOINT.Server.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    [Authorize]
    public class PresencesController : ControllerBase
    {
        private readonly IPresenceRepository _presenceRepository;
        private readonly IPointageOptimizerService _pointageOptimizerService;
        private readonly IReportsGenerationService _reportGenerationService;
        private readonly ILogger<PresencesController>? _logger;
        private readonly Services.IGeoZoneValidator? _geoValidator;
        public PresencesController(IPresenceRepository presenceRepository, IReportsGenerationService reportGenerationService,IUtilisateurRepository utilisateurRepository,IPointageOptimizerService pointageOptimizerService, ILogger<PresencesController>? logger = null, Services.IGeoZoneValidator? geoValidator = null)
        {
            _presenceRepository = presenceRepository;
            _reportGenerationService = reportGenerationService;
            _pointageOptimizerService = pointageOptimizerService;
            _logger = logger;
            _geoValidator = geoValidator;
        }
        [HttpPut("optimiserPointage/{soccod}/{empmat}/{dateDeb}/{dateFin}")]
        public async Task OptimizePointage(string soccod,string empMat,DateTime dateDeb,DateTime dateFin)
        {
            try
            {
                await _pointageOptimizerService.OptimizePointage(soccod, empMat, dateDeb, dateFin);
            }
            catch (Exception)
            {
                throw;
            }
        }
        // GET: api/<DirectionsController>
        [HttpGet("{soccod}/{dateDebut}/{dateFin}/{regime}")]
        public async Task<IActionResult> Get(string soccod,DateTime dateDebut,DateTime dateFin, string regime, [FromQuery] List<string>empcods)
        {
            try
            {
                IEnumerable<EtatEmpPresence> result = await _presenceRepository.GetAllAsync(soccod, dateDebut, dateFin, regime, empcods);
                return Ok(result);
            }
            catch (Exception)
            {
                throw;
            }
        }
        [HttpGet("get-etat-retard-report/{soccod}/{dateDebut}/{dateFin}/{regime}")]
        public async Task<IActionResult> GetEtatRetardReport(string soccod, DateTime? dateDebut, DateTime? dateFin, string regime,[FromQuery] List<string> empcods)
        {
            try
            {
                byte[] pdfBytes = _reportGenerationService.GenerateEtatRetardReport(soccod, dateDebut, dateFin, regime,empcods);
                return File(pdfBytes, "application/pdf", "EtatRetard.pdf");
            }
            catch (Exception)
            {
                throw;
            }
        }
        [HttpGet("get-etat-presence-report/{soccod}/{dateDebut}/{dateFin}/{regime}")]
        public async Task<IActionResult> GetEtatPresenceReport(string soccod, DateTime? dateDebut, DateTime? dateFin, string regime,[FromQuery] List<string> empcods)
        {
            try
            {
                byte[] pdfBytes = _reportGenerationService.GenerateEtatPresenceReport(soccod, dateDebut, dateFin, regime,empcods);
                return File(pdfBytes, "application/pdf", "EtatPresence.pdf");
            }
            catch (Exception)
            {
                throw;
            }
        }
        [HttpPost("etat-global")]
        public IActionResult GenerateEtatGlobal([FromBody] EtatGlobalRequest request)
        {
            var pdf = _reportGenerationService.GenerateEtatGlobalReport(request);

            return File(pdf, "application/pdf", "EtatGlobal.pdf");
        }
        [HttpPost("etat-detaille")]
        public IActionResult GenerateEtatDetaille([FromBody] EtatDetailleRequest request)
        {
            var pdf = _reportGenerationService.GenerateEtatDetailleReport(request);

            return File(pdf, "application/pdf", "EtatGlobal.pdf");
        }


        [HttpGet("emp-point/{soccod}/{empcod}")]
        public async Task<IActionResult> GetEmpEtatPeriodique(string soccod,string empcod)
        {
            IEnumerable<Presence> result = await _presenceRepository.GetEmpEtatPeriodiqueAsync(soccod,empcod);
            return Ok(result);
        }
        [HttpGet("emp-point-filtrer/{soccod}/{empcod}/{dateDebut}/{dateFin}")]
        [CanGetEtatPeriodique]
        public async Task<IActionResult> GetEmpEtatPeriodiqueByDate(string soccod, string empcod, DateTime dateDebut, DateTime dateFin)
        {
            try
            {
                IEnumerable<PresenceDto> result = await _presenceRepository.GetEmpEtatPeriodiqueAsync(soccod, empcod, dateDebut, dateFin);
                return Ok(result);
            }
            catch (Exception)
            {
                throw;
            }
        }


        // POST api/<DirectionsController>
        [HttpPost]
        public async Task Post([FromBody] Presence presence)
        {
            await _presenceRepository.AddAsync(presence);
        }

        // GET: api/Presences/daily-pointage/{soccod}/{date}
        [HttpGet("daily-pointage/{soccod}/{date}")]
        public async Task<IActionResult> GetDailyPointage(string soccod, DateTime date)
        {
            try
            {
                var result = await _presenceRepository.GetDailyPointageAsync(soccod, date);
                return Ok(result);
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = "Erreur lors du chargement du pointage", details = ex.Message });
            }
        }

        // GET: api/Presences/my-history/{soccod}/{empcod}/{dateDebut}/{dateFin}
        [HttpGet("my-history/{soccod}/{empcod}/{dateDebut}/{dateFin}")]
        public async Task<IActionResult> GetMyPresenceHistory(string soccod, string empcod, DateTime dateDebut, DateTime dateFin)
        {
            try
            {
                IEnumerable<PresenceDto> result = await _presenceRepository.GetEmpEtatPeriodiqueAsync(soccod, empcod, dateDebut, dateFin);
                return Ok(result);
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = "Erreur lors du chargement de l'historique", details = ex.Message });
            }
        }

        // GET: api/Presences/entry-reminder/{soccod}/{empcod}
        [HttpGet("entry-reminder/{soccod}/{empcod}")]
        public async Task<IActionResult> GetEntryReminder(string soccod, string empcod)
        {
            try
            {
                var result = await _presenceRepository.GetEntryReminderAsync(soccod, empcod);
                return Ok(result);
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = "Erreur", details = ex.Message });
            }
        }

        // POST: api/Presences/mark-presence/{soccod}/{empcod}
        // Coordonnées GPS optionnelles : journalisées pour audit anti-fraude (à connecter à
        // une vérif de zone autorisée / table de log GPS dans une itération ultérieure).
        [HttpPost("mark-presence/{soccod}/{empcod}")]
        public async Task<IActionResult> MarkPresence(
            string soccod,
            string empcod,
            [FromQuery] string? poicod = null,
            [FromQuery] double? lat = null,
            [FromQuery] double? lon = null,
            [FromQuery] double? acc = null,
            // Horodatage côté client (téléphone). Le mobile envoie l'instant local de
            // l'utilisateur — c'est sa montre qui fait foi, pas l'horloge du serveur
            // (qui peut être dans un autre fuseau ou désynchronisée).
            [FromQuery] DateTime? clientTime = null)
        {
            try
            {
                if (string.IsNullOrEmpty(soccod) || string.IsNullOrEmpty(empcod))
                    return BadRequest(new { message = "soccod et empcod sont obligatoires" });

                if (lat.HasValue && lon.HasValue)
                {
                    // Audit trail simple via logger structurel : permet de tracer où le pointage
                    // a été déclenché (rejouable dans un dashboard "carte des pointages" plus tard).
                    _logger?.LogInformation(
                        "Mobile clock-in GPS soccod={Soccod} empcod={Empcod} lat={Lat} lon={Lon} acc={Acc}m",
                        soccod, empcod, lat, lon, acc);

                    // Validation de zone (config-driven via GeoZones:Mode dans appsettings).
                    if (_geoValidator != null && _geoValidator.Mode != "off")
                    {
                        var validation = _geoValidator.Validate(soccod, lat.Value, lon.Value);
                        if (!validation.InsideAnyZone)
                        {
                            var distance = validation.NearestDistanceMeters.HasValue
                                ? $"{validation.NearestDistanceMeters.Value:F0}m"
                                : "?";
                            _logger?.LogWarning(
                                "Pointage hors zone autorisée. soccod={Soccod} empcod={Empcod} nearest={Sitcod} distance={Distance}",
                                soccod, empcod, validation.NearestSitcod, distance);
                            if (_geoValidator.Mode == "reject")
                            {
                                return UnprocessableEntity(new
                                {
                                    message = $"Pointage refusé : vous êtes à {distance} de la zone autorisée la plus proche.",
                                    distance = validation.NearestDistanceMeters,
                                    nearestSitcod = validation.NearestSitcod,
                                });
                            }
                        }
                    }
                }

                // Si le mobile fournit un horodatage local, on s'en sert (DateTimeKind.Local
                // après bind ASP.NET) ; sinon repli sur l'horloge serveur pour les anciens
                // clients ou les pointages déclenchés via web.
                var stamp = clientTime ?? DateTime.Now;
                var result = await _presenceRepository.AddPresenceAsync(soccod, empcod, stamp, poicod ?? "");
                if (result == null)
                    return NotFound(new { message = "Employé introuvable" });

                return Ok(result);
            }
            catch (Microsoft.EntityFrameworkCore.DbUpdateConcurrencyException ex)
            {
                // Cas typique : double-tap utilisateur ou requête réseau rejouée → la fiche
                // Presence/Employe a déjà été modifiée par le premier appel pendant que le
                // second la traitait. Retourne 409 plutôt que 500 ; le front peut alors
                // afficher "déjà pointé" sans alarmer l'utilisateur.
                _logger?.LogWarning(ex, "Concurrence sur mark-presence soccod={Soccod} empcod={Empcod}", soccod, empcod);
                return Conflict(new { message = "Pointage déjà pris en compte. Réessayez dans quelques secondes si nécessaire." });
            }
            catch (Exception ex)
            {
                // Log structuré côté serveur (avec stack) + remontée du message racine au
                // client pour que l'utilisateur ait un indice actionnable au lieu d'un
                // simple "Erreur lors du pointage".
                _logger?.LogError(ex, "Échec mark-presence soccod={Soccod} empcod={Empcod}", soccod, empcod);
                var rootMessage = ex.GetBaseException().Message;
                return StatusCode(500, new
                {
                    message = $"Erreur lors du pointage : {rootMessage}",
                    details = ex.Message
                });
            }
        }
        

        // PUT api/<DirectionsController>/5
        [HttpPut("{soccod}/{empcod}/{predat}")]
        public async Task<IActionResult> Put(string soccod,string empcod,DateTime predat,[FromBody] EmpEtatPeriodique presence)
        {
            if (string.IsNullOrEmpty(soccod)||string.IsNullOrEmpty(empcod))
                return BadRequest("Veuillez saisir tous les champs obligatoires");
            if (presence == null)
                return BadRequest("Veuillez remplir tous les champs obligatoires");
            try
            {
                PresenceDto dbpresence = await _presenceRepository.GetAsync(soccod,empcod,predat);
                if(dbpresence == null)
                    dbpresence = await _presenceRepository.AddPresenceAsync(soccod, empcod, predat,"");
                dbpresence.Preentamidiup = presence.preentamidiup;
                dbpresence.Preentsupup = presence.preentsupup;
                dbpresence.Preentmatup = presence.preentmatup;
                dbpresence.Presortamidiup = presence.presortamidiup;
                dbpresence.Presortsupup = presence.presortsupup;
                dbpresence.Presortmatup = presence.presortmatup;
                dbpresence.Prerepos = presence.prerepos.ToString();
                dbpresence.Prerepas = presence.prerepas;
                
                await _presenceRepository.UpdateAsync(dbpresence);

                return Ok("modification effectue avec sucées");
            }
            catch (Exception ex)
            {
                // Sérialiser `ex` directement provoque une NotSupportedException sur la
                // propriété TargetSite (System.Reflection.MethodBase non sérialisable par
                // System.Text.Json) — le client recevait une erreur opaque qui masquait
                // le vrai problème. On renvoie le message + l'éventuelle inner exception.
                var message = ex.InnerException?.Message ?? ex.Message;
                return StatusCode(500, new { message });
            }
        }
        [HttpPut("update-compensation/{soccod}/{empcod}/{date}/{totcmp}")]
        public async Task<IActionResult> UpdateComponsation(string soccod,string empcod,DateTime date,float totcmp)
        {
            try
            {
                bool result = await _presenceRepository.UpdateTotcmpAsync(soccod, empcod, date, totcmp);
                if (result)
                    return Ok("componsation ajoutée avec succées");
                return StatusCode(500,"probléme d'ajout de componsation");
            }
            catch (Exception)
            {
                throw;
            }
        }

        // DELETE api/<DirectionsController>/5
        [HttpDelete("{soccod}/{concod}")]
        public async Task<IActionResult> Delete(string soccod, string concod)
        {
            Presence presence = null;
            if (presence == null)
            {
                return NotFound();
            }
            await _presenceRepository.DeleteAsync(presence);
            return NoContent();
        }
    }
}
