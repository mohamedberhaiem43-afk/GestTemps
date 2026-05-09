using ABRPOINT.Server.Annotations.EtatPriodiqueAttributes;
using ABRPOINT.Server.Authorization;
using ABRPOINT.Server.Data;
using ABRPOINT.Server.Dtaos;
using ABRPOINT.Server.Interfaces;
using ABRPOINT.Server.Models;
using ABRPOINT.Server.Repository;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;

namespace ABRPOINT.Server.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    [Authorize]
    [ValidateSoccod] // S3 : empêche un user de la société A de lire/écrire celles de B au sein du même tenant.
    public class PresencesController : ControllerBase
    {
        private readonly IPresenceRepository _presenceRepository;
        private readonly IPointageOptimizerService _pointageOptimizerService;
        private readonly IReportsGenerationService _reportGenerationService;
        private readonly ApplicationDbContext _db;
        private readonly ILogger<PresencesController>? _logger;
        private readonly Services.IGeoZoneValidator? _geoValidator;
        private readonly IWebHostEnvironment _env;
        public PresencesController(IPresenceRepository presenceRepository, IReportsGenerationService reportGenerationService,IUtilisateurRepository utilisateurRepository,IPointageOptimizerService pointageOptimizerService, ApplicationDbContext db, IWebHostEnvironment env, ILogger<PresencesController>? logger = null, Services.IGeoZoneValidator? geoValidator = null)
        {
            _presenceRepository = presenceRepository;
            _reportGenerationService = reportGenerationService;
            _pointageOptimizerService = pointageOptimizerService;
            _db = db;
            _env = env;
            _logger = logger;
            _geoValidator = geoValidator;
        }

        // S7 : en production on masque les détails techniques (stack/inner exception) car ils
        // peuvent fuiter des chemins, noms de tables, ou logique métier. En dev on les expose
        // pour faciliter le debug — l'arbitrage est piloté par IWebHostEnvironment.
        private object MaskedError(string userMessage, Exception ex)
        {
            if (_env.IsDevelopment())
                return new { message = userMessage, details = ex.Message };
            return new { message = userMessage };
        }

        [HttpPut("optimiserPointage/{soccod}/{empmat}/{dateDeb}/{dateFin}")]
        [CanUpdateEtatPeriodique] // S4 : modifier le pointage = permission "modify" sur état périodique.
        public async Task OptimizePointage(string soccod,string empMat,DateTime dateDeb,DateTime dateFin)
        {
            try
            {
                await _pointageOptimizerService.OptimizePointage(soccod, empMat, dateDeb, dateFin);
            }
            catch (Exception ex)
            {
                _logger?.LogError(ex, "Échec OptimizePointage soccod={Soccod} empMat={EmpMat}", soccod, empMat);
                throw;
            }
        }
        // GET: api/<DirectionsController>
        [HttpGet("{soccod}/{dateDebut}/{dateFin}/{regime}")]
        [CanGetEtatPeriodique] // S4 : lire l'état périodique multi-employés = permission "consult".
        public async Task<IActionResult> Get(string soccod,DateTime dateDebut,DateTime dateFin, string regime, [FromQuery] List<string>empcods)
        {
            try
            {
                IEnumerable<EtatEmpPresence> result = await _presenceRepository.GetAllAsync(soccod, dateDebut, dateFin, regime, empcods);
                return Ok(result);
            }
            catch (Exception ex)
            {
                _logger?.LogError(ex, "Échec Get présences soccod={Soccod}", soccod);
                return StatusCode(500, MaskedError("Erreur lors du chargement des présences.", ex));
            }
        }
        [HttpGet("get-etat-retard-report/{soccod}/{dateDebut}/{dateFin}/{regime}")]
        [Annotations.EtatsAttributes.CanGetEtatRetard] // S4 : export PDF retards = permission dédiée.
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
        [CanGetEtatPeriodique] // S4 : export PDF présence = permission "consult".
        public async Task<IActionResult> GetEtatPresenceReport(string soccod, DateTime? dateDebut, DateTime? dateFin, string regime,[FromQuery] List<string> empcods)
        {
            try
            {
                byte[] pdfBytes = _reportGenerationService.GenerateEtatPresenceReport(soccod, dateDebut, dateFin, regime,empcods);
                return File(pdfBytes, "application/pdf", "EtatPresence.pdf");
            }
            catch (Exception ex)
            {
                _logger?.LogError(ex, "Échec GetEtatPresenceReport soccod={Soccod}", soccod);
                throw;
            }
        }
        [HttpPost("etat-global")]
        [CanGetEtatPeriodique]
        public IActionResult GenerateEtatGlobal([FromBody] EtatGlobalRequest request)
        {
            var pdf = _reportGenerationService.GenerateEtatGlobalReport(request);

            return File(pdf, "application/pdf", "EtatGlobal.pdf");
        }
        [HttpPost("etat-detaille")]
        [CanGetEtatPeriodique]
        public IActionResult GenerateEtatDetaille([FromBody] EtatDetailleRequest request)
        {
            var pdf = _reportGenerationService.GenerateEtatDetailleReport(request);

            return File(pdf, "application/pdf", "EtatGlobal.pdf");
        }


        [HttpGet("emp-point/{soccod}/{empcod}")]
        [CanGetEtatPeriodique]
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
        [CanAddEtatPeriodique] // S4 : créer du pointage manuel exige la permission "add".
        public async Task Post([FromBody] Presence presence)
        {
            await _presenceRepository.AddAsync(presence);
        }

        // GET: api/Presences/daily-pointage/{soccod}/{date}
        [HttpGet("daily-pointage/{soccod}/{date}")]
        [CanGetEtatPeriodique] // S4 : pointage du jour = vue agrégée — permission "consult".
        public async Task<IActionResult> GetDailyPointage(string soccod, DateTime date)
        {
            try
            {
                var result = await _presenceRepository.GetDailyPointageAsync(soccod, date);
                return Ok(result);
            }
            catch (Exception ex)
            {
                _logger?.LogError(ex, "Échec GetDailyPointage soccod={Soccod}", soccod);
                return StatusCode(500, MaskedError("Erreur lors du chargement du pointage.", ex));
            }
        }

        // GET: api/Presences/my-history/{soccod}/{empcod}/{dateDebut}/{dateFin}
        // Self-service : un employé consulte son propre historique. On laisse passer si
        // empcod == utilisateur courant, sinon on exige la permission lecture périodique.
        [HttpGet("my-history/{soccod}/{empcod}/{dateDebut}/{dateFin}")]
        public async Task<IActionResult> GetMyPresenceHistory(string soccod, string empcod, DateTime dateDebut, DateTime dateFin)
        {
            try
            {
                // S4 : vérifier que l'utilisateur consulte son propre historique. Sans ce check,
                // n'importe quel employé peut espionner les pointages de ses collègues en
                // changeant simplement l'empcod dans l'URL.
                var uticod = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;
                if (string.IsNullOrEmpty(uticod))
                    return Unauthorized();
                if (!string.Equals(uticod, empcod, StringComparison.OrdinalIgnoreCase))
                {
                    // Sinon il faut la permission consult sur l'état périodique (manager/RH).
                    var hasPerm = await UserHasEtatPeriodiqueConsultAsync(uticod);
                    if (!hasPerm)
                        return Forbid();
                }

                IEnumerable<PresenceDto> result = await _presenceRepository.GetEmpEtatPeriodiqueAsync(soccod, empcod, dateDebut, dateFin);
                return Ok(result);
            }
            catch (Exception ex)
            {
                _logger?.LogError(ex, "Échec GetMyPresenceHistory soccod={Soccod} empcod={Empcod}", soccod, empcod);
                return StatusCode(500, MaskedError("Erreur lors du chargement de l'historique.", ex));
            }
        }

        // Bypass admin + lookup matriciel pour `my-history`. Lève une exception métier muette
        // si un user inconnu tente l'accès — protégé par try/catch côté appelant.
        private async Task<bool> UserHasEtatPeriodiqueConsultAsync(string uticod)
        {
            var user = await _db.Utilisateurs.AsNoTracking()
                .Where(u => u.Uticod == uticod)
                .Select(u => new { u.Utiadm, u.Utirole }).FirstOrDefaultAsync();
            if (user == null) return false;
            if (user.Utiadm == "1" || ABRPOINT.Server.Authorization.PermissionCatalog.IsAdminRole(user.Utirole))
                return true;
            // RpModule "Préparation Paie" porte généralement la permission consult sur le périodique.
            // On accepte aussi "Pointage" historique. Si aucune permission ne match — refus.
            var matrix = await _db.RolePermissions.AsNoTracking()
                .Where(rp => rp.Role!.RoleName == user.Utirole)
                .Select(rp => new { rp.RpModule, rp.RpConsult })
                .ToListAsync();
            return matrix.Any(m => m.RpConsult == "1" &&
                (string.Equals(m.RpModule, "Préparation Paie", StringComparison.OrdinalIgnoreCase)
                 || string.Equals(m.RpModule, "Pointage", StringComparison.OrdinalIgnoreCase)
                 || string.Equals(m.RpModule, "Paie et Rémunération", StringComparison.OrdinalIgnoreCase)));
        }

        // SEC AI : un employé ne peut consulter le rappel d'entrée que pour lui-même
        // (sauf manager/admin), pour empêcher la surveillance des collègues via énumération
        // d'empcod. Sert aussi à MarkPresence en aval.
        private async Task<bool> CallerOwnsOrManagesEmpAsync(string targetEmpcod)
        {
            var caller = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;
            if (string.IsNullOrEmpty(caller)) return false;
            if (string.Equals(caller, targetEmpcod, StringComparison.OrdinalIgnoreCase)) return true;
            return await _db.Utilisateurs.AsNoTracking()
                .Where(u => u.Uticod == caller)
                .Select(u => u.Utiadm == "1"
                    || u.Utirole == ABRPOINT.Server.Authorization.PermissionCatalog.Roles.Administrator
                    || u.Utirole == ABRPOINT.Server.Authorization.PermissionCatalog.Roles.Manager
                    || u.Utirole == ABRPOINT.Server.Authorization.PermissionCatalog.Roles.ResponsableRH)
                .FirstOrDefaultAsync();
        }

        // GET: api/Presences/entry-reminder/{soccod}/{empcod}
        [HttpGet("entry-reminder/{soccod}/{empcod}")]
        public async Task<IActionResult> GetEntryReminder(string soccod, string empcod)
        {
            if (!await CallerOwnsOrManagesEmpAsync(empcod)) return Forbid();
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
        [EnableRateLimiting("clock-in")] // S8 : limite ~6 pointages/min/IP — bloque le flood/replay.
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

                // SEC AI : empêche un employé de pointer pour un collègue en changeant empcod
                // dans l'URL — c'est de la fraude horaire. Manager/admin restent autorisés
                // (cas légitime : pointage de rattrapage).
                if (!await CallerOwnsOrManagesEmpAsync(empcod)) return Forbid();

                // Validation de zone GPS — admin-définie via les colonnes sitlat/sitlon/sitrad
                // de la table site, ou via la config legacy GeoZones:Zones.
                //
                // Règle :
                //   - "off"  : aucune validation (pour debug/migration).
                //   - "warn" : log si hors zone, accepte le pointage.
                //   - "reject" / défaut quand au moins un site a un geofence : refuse 422.
                //
                // Si l'admin a configuré des zones mais que le client n'a pas envoyé de GPS,
                // on refuse aussi (sinon n'importe qui contourne en désactivant la localisation).
                if (_geoValidator != null)
                {
                    var configMode = _geoValidator.ConfiguredMode;
                    var hasGeofences = await _geoValidator.HasGeofencesAsync(soccod);
                    var effectiveMode = !string.IsNullOrEmpty(configMode)
                        ? configMode
                        : (hasGeofences ? "reject" : "off");

                    if (effectiveMode != "off" && hasGeofences)
                    {
                        if (!lat.HasValue || !lon.HasValue)
                        {
                            _logger?.LogWarning(
                                "Pointage refusé (GPS manquant alors que des zones sont configurées). soccod={Soccod} empcod={Empcod}",
                                soccod, empcod);
                            if (effectiveMode == "reject")
                            {
                                return UnprocessableEntity(new
                                {
                                    message = "Pointage refusé : la localisation est obligatoire. Veuillez autoriser l'accès à votre position et réessayer.",
                                    code = "gps_required",
                                });
                            }
                        }
                        else
                        {
                            _logger?.LogInformation(
                                "Clock-in GPS soccod={Soccod} empcod={Empcod} lat={Lat} lon={Lon} acc={Acc}m",
                                soccod, empcod, lat, lon, acc);

                            var validation = await _geoValidator.ValidateAsync(soccod, lat.Value, lon.Value);
                            if (!validation.InsideAnyZone)
                            {
                                var distance = validation.NearestDistanceMeters.HasValue
                                    ? $"{validation.NearestDistanceMeters.Value:F0}m"
                                    : "?";
                                _logger?.LogWarning(
                                    "Pointage hors zone autorisée. soccod={Soccod} empcod={Empcod} nearest={Sitcod} distance={Distance}",
                                    soccod, empcod, validation.NearestSitcod, distance);
                                if (effectiveMode == "reject")
                                {
                                    return UnprocessableEntity(new
                                    {
                                        message = $"Pointage refusé : vous êtes à {distance} de la zone autorisée la plus proche.",
                                        code = "outside_geofence",
                                        distance = validation.NearestDistanceMeters,
                                        nearestSitcod = validation.NearestSitcod,
                                    });
                                }
                            }
                        }
                    }
                    else if (lat.HasValue && lon.HasValue)
                    {
                        // Pas de geofence configuré : on journalise quand même pour audit anti-fraude.
                        _logger?.LogInformation(
                            "Clock-in GPS (no geofence) soccod={Soccod} empcod={Empcod} lat={Lat} lon={Lon} acc={Acc}m",
                            soccod, empcod, lat, lon, acc);
                    }
                }

                // Si le mobile fournit un horodatage local, on s'en sert (DateTimeKind.Local
                // après bind ASP.NET) ; sinon repli sur l'horloge serveur pour les anciens
                // clients ou les pointages déclenchés via web.
                var stamp = clientTime ?? DateTime.Now;

                // S5 — Tolérance d'écart entre l'horloge mobile et celle du serveur. Sans ce
                // garde-fou, un client malveillant peut envoyer un clientTime arbitraire pour
                // pointer rétroactivement (lundi matin alors qu'on est mardi soir) ou dans le
                // futur. Tolérance : ±10 min — large pour absorber les téléphones désynchronisés
                // et les fuseaux mal configurés, mais resserre la fenêtre de fraude. La date
                // d'embauche / sortie reste contrôlée plus bas.
                if (clientTime.HasValue)
                {
                    var skew = (DateTime.Now - clientTime.Value).Duration();
                    if (skew > TimeSpan.FromMinutes(10))
                    {
                        _logger?.LogWarning(
                            "Pointage avec écart d'horloge important. soccod={Soccod} empcod={Empcod} skewMinutes={Skew}",
                            soccod, empcod, (int)skew.TotalMinutes);
                        return UnprocessableEntity(new
                        {
                            message = "Pointage refusé : écart d'horloge trop important entre votre appareil et le serveur. Vérifiez la date/heure de votre téléphone.",
                            code = "clock_skew",
                            skewMinutes = (int)skew.TotalMinutes,
                        });
                    }
                }

                // Garde-fou : refuser tout pointage avant date d'embauche ou après date
                // de sortie. Sans ça un employé sorti continuerait à pouvoir pointer
                // (mobile, badge oublié, etc.) ou un nouvel arrivant pourrait pointer
                // rétroactivement sur des dates pré-embauche → distorsion paie/KPIs.
                var empInfo = await _db.Employes
                    .AsNoTracking()
                    .Where(e => e.Soccod == soccod && e.Empcod == empcod)
                    .Select(e => new { e.Empemb, e.Empsort, e.Emplib, e.Empmat })
                    .FirstOrDefaultAsync();
                if (empInfo == null)
                    return NotFound(new { message = "Employé introuvable" });

                if (empInfo.Empemb.HasValue && stamp.Date < empInfo.Empemb.Value.Date)
                {
                    return UnprocessableEntity(new
                    {
                        message = $"Pointage refusé : la date est antérieure à la date d'embauche ({empInfo.Empemb.Value:dd/MM/yyyy}).",
                        code = "before_hire_date",
                        empemb = empInfo.Empemb,
                    });
                }

                if (empInfo.Empsort.HasValue && stamp.Date > empInfo.Empsort.Value.Date)
                {
                    return UnprocessableEntity(new
                    {
                        message = $"Pointage refusé : l'employé est sorti depuis le {empInfo.Empsort.Value:dd/MM/yyyy}.",
                        code = "after_exit_date",
                        empsort = empInfo.Empsort,
                    });
                }

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
                // S7 — En production on ne propage pas la stack ni le message racine au
                // client (peut leaker chemins, noms de tables, requêtes SQL). En dev on
                // affiche tout pour faciliter le debug.
                _logger?.LogError(ex, "Échec mark-presence soccod={Soccod} empcod={Empcod}", soccod, empcod);
                return StatusCode(500, MaskedError("Erreur lors du pointage. Réessayez ou contactez votre administrateur.", ex));
            }
        }
        

        // PUT api/<DirectionsController>/5
        [HttpPut("{soccod}/{empcod}/{predat}")]
        [CanUpdateEtatPeriodique] // S4 : modifier un pointage existant.
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
                // S7 — Avant on remontait ex.InnerException?.Message au client (peut leaker
                // structure SQL). Maintenant : log côté serveur + message générique en prod.
                _logger?.LogError(ex, "Échec Put presence soccod={Soccod} empcod={Empcod} predat={Predat}", soccod, empcod, predat);
                return StatusCode(500, MaskedError("Erreur lors de la mise à jour du pointage.", ex));
            }
        }
        [HttpPut("update-compensation/{soccod}/{empcod}/{date}/{totcmp}")]
        [CanUpdateEtatPeriodique]
        public async Task<IActionResult> UpdateComponsation(string soccod,string empcod,DateTime date,float totcmp)
        {
            try
            {
                bool result = await _presenceRepository.UpdateTotcmpAsync(soccod, empcod, date, totcmp);
                if (result)
                    return Ok("componsation ajoutée avec succées");
                return StatusCode(500, MaskedError("Problème d'ajout de compensation.", new InvalidOperationException("update returned false")));
            }
            catch (Exception ex)
            {
                _logger?.LogError(ex, "Échec UpdateComponsation soccod={Soccod} empcod={Empcod}", soccod, empcod);
                throw;
            }
        }

        // DELETE api/<DirectionsController>/5
        [HttpDelete("{soccod}/{concod}")]
        [CanDeleteEtatPeriodique] // S4 : supprimer un pointage est destructeur.
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
