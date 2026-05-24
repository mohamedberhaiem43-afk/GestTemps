using ABRPOINT.Server.Annotations.EtatPriodiqueAttributes;
using ABRPOINT.Server.Authorization;
using ABRPOINT.Server.Data;
using ABRPOINT.Server.Dtaos;
using ABRPOINT.Server.Interfaces;
using ABRPOINT.Server.Models;
using ABRPOINT.Server.Repository;
using ABRPOINT.Server.Tenancy;
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
        private readonly ICurrentTenant? _currentTenant;
        public PresencesController(IPresenceRepository presenceRepository, IReportsGenerationService reportGenerationService,IUtilisateurRepository utilisateurRepository,IPointageOptimizerService pointageOptimizerService, ApplicationDbContext db, IWebHostEnvironment env, ILogger<PresencesController>? logger = null, Services.IGeoZoneValidator? geoValidator = null, ICurrentTenant? currentTenant = null)
        {
            _presenceRepository = presenceRepository;
            _reportGenerationService = reportGenerationService;
            _pointageOptimizerService = pointageOptimizerService;
            _db = db;
            _env = env;
            _logger = logger;
            _geoValidator = geoValidator;
            _currentTenant = currentTenant;
        }

        // S7 : en production on masque les détails techniques (stack/inner exception) car ils
        // peuvent fuiter des chemins, noms de tables, ou logique métier. En dev on les expose
        // pour faciliter le debug — l'arbitrage est piloté par IWebHostEnvironment.
        private object MaskedError(string userMessage, Exception ex)
        {
            if (_env.IsDevelopment())
                return new { message = userMessage, details = "Erreur interne. Consultez les logs serveur pour le détail." };
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
                return StatusCode(500, new { message = "Erreur", details = "Erreur interne. Consultez les logs serveur pour le détail." });
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

                // Plan gating : si des coordonnées GPS sont envoyées (pointage géolocalisé), on
                // exige que le plan du tenant inclue la feature Geolocation. Sur Starter, le
                // pointage reste possible mais sans GPS — on rejette ici les requêtes qui
                // tenteraient de bypasser le gating UI via appel direct. Pendant l'essai
                // (Trialing), toutes les features sont accordées.
                if ((lat.HasValue || lon.HasValue) && _currentTenant?.Current is { } tenant
                    && !TrialPolicy.IsTrialing(tenant))
                {
                    var plan = PlanCatalog.GetPlan(tenant.PlanCode);
                    if (plan is not null && !plan.Features.Geolocation)
                    {
                        return new ObjectResult(new
                        {
                            code = "plan_feature_locked",
                            feature = nameof(PlanFeatures.Geolocation),
                            currentPlan = plan.Code,
                            message = $"Le pointage géolocalisé n'est pas inclus dans le plan {plan.DisplayName}."
                        })
                        { StatusCode = StatusCodes.Status402PaymentRequired };
                    }
                }

                // RGPD clause 13.3 — politique géoloc paramétrée par le tenant via UI :
                //   • Sous-finalité « clock-in » désactivée → on ignore complètement les
                //     coordonnées (le pointage continue sans validation GPS, l'admin a
                //     explicitement choisi de ne pas géolocaliser le pointage).
                //   • Hors plage horaire autorisée → idem : pointage accepté, géoloc
                //     ignorée (décision produit 2026-05 : pas de prise d'otage opé).
                // Sans table geolocation_policy (legacy), comportement inchangé.
                var geoPolicy = await _db.GeolocationPolicies.AsNoTracking().FirstOrDefaultAsync();
                var geolocActive = geoPolicy is null
                    || (geoPolicy.EnabledForClockIn && geoPolicy.IsWithinWindow(DateTime.Now));
                if (!geolocActive)
                {
                    // On efface les coordonnées reçues pour qu'elles ne soient ni
                    // utilisées par la suite ni journalisées (clé : limitation à la
                    // finalité déclarée — point 4 de la clause 13.3).
                    lat = null; lon = null; acc = null;
                }

                // Validation de zone GPS — règle STRICTE par site (2026-05-22) :
                // l'employé ne peut pointer QUE depuis le geofence de SON site rattaché
                // (Empsite / Sitcod), pas depuis n'importe quel site de la société.
                // Cela évite qu'un salarié du site A puisse pointer depuis le site B
                // simplement parce que B a son propre geofence configuré.
                //
                // Sources de configuration :
                //   - Colonnes site.sitlat / sitlon / sitrad (admin via FilialeModern).
                //   - Mode global appsettings "GeoZones:Mode" : "off" / "warn" / "reject".
                //     Sinon, dès qu'au moins un site du tenant a un geofence configuré,
                //     on bascule en "reject" auto (l'admin a explicitement défini des zones).
                //
                // Si le SITE RATTACHÉ de l'employé n'a pas de geofence configuré, aucune
                // restriction n'est appliquée (l'admin a opté pour un site « libre »).
                // Si l'admin a configuré le geofence du site mais que le client n'a pas
                // envoyé de GPS, on refuse (sinon contournement trivial en désactivant
                // la localisation).
                if (_geoValidator != null && geolocActive)
                {
                    // On a besoin du sitcod rattaché de l'employé pour cibler le bon
                    // geofence. La PK composite (soccod, empcod, sitcod) autorise plusieurs
                    // sites pour le même empcod : on prend le premier — la pratique métier
                    // veut qu'un salarié appartienne à un seul site actif à la fois.
                    var empSitcod = await _db.Employes.AsNoTracking()
                        .Where(e => e.Soccod == soccod && e.Empcod == empcod)
                        .Select(e => e.Sitcod)
                        .FirstOrDefaultAsync();

                    // ─── Bypass télétravail approuvé ───
                    // Exigence produit 2026-05 : un salarié avec une demande de
                    // télétravail Approved couvrant la date du pointage doit
                    // pouvoir pointer depuis n'importe quelle position (domicile
                    // tiers, coworking…). On saute donc l'intégralité du contrôle
                    // GPS, mais on log les coordonnées si fournies pour conserver
                    // une trace anti-fraude (si un attaquant détourne le bypass,
                    // les positions divergentes ressortent dans l'audit).
                    //
                    // Note : on n'utilise pas `stamp` car il est calculé plus bas
                    // (ligne ~425). On recalcule la date du pointage avec la même
                    // règle (clientTime ?? Now) pour rester cohérent.
                    var pointageDate = (clientTime ?? DateTime.Now).Date;
                    var hasApprovedTeletravail = await _db.Teletravails.AsNoTracking()
                        .AnyAsync(t => t.Soccod == soccod
                                    && t.Empcod == empcod
                                    && t.Status == "Approved"
                                    && t.StartDate.Date <= pointageDate
                                    && t.EndDate.Date >= pointageDate);

                    if (hasApprovedTeletravail)
                    {
                        _logger?.LogInformation(
                            "Pointage GPS bypass (télétravail approuvé) — empcod={Empcod} soccod={Soccod} date={Date:yyyy-MM-dd} site={Sitcod} lat={Lat} lon={Lon} acc={Acc}m",
                            empcod, soccod, pointageDate, empSitcod, lat, lon, acc);
                        // Pas de check geofence — on tombe dans la suite du flux
                        // (skew, dates contrat, AddPresence). Le pointage est
                        // accepté quelle que soit la position.
                    }
                    else
                    {

                    var configMode = _geoValidator.ConfiguredMode;
                    var siteHasGeofence = !string.IsNullOrEmpty(empSitcod)
                        && await _geoValidator.HasGeofenceForSiteAsync(soccod, empSitcod);
                    var tenantHasAnyGeofence = await _geoValidator.HasGeofencesAsync(soccod);
                    var effectiveMode = !string.IsNullOrEmpty(configMode)
                        ? configMode
                        : (tenantHasAnyGeofence ? "reject" : "off");

                    if (effectiveMode != "off" && siteHasGeofence)
                    {
                        if (!lat.HasValue || !lon.HasValue)
                        {
                            _logger?.LogWarning(
                                "Pointage refusé (GPS manquant alors que le site {Sitcod} a un geofence). soccod={Soccod} empcod={Empcod}",
                                empSitcod, soccod, empcod);
                            if (effectiveMode == "reject")
                            {
                                return UnprocessableEntity(new
                                {
                                    message = "Pointage refusé : la localisation est obligatoire pour pointer depuis votre site. Veuillez autoriser l'accès à votre position et réessayer.",
                                    code = "gps_required",
                                });
                            }
                        }
                        else
                        {
                            _logger?.LogInformation(
                                "Clock-in GPS site={Sitcod} soccod={Soccod} empcod={Empcod} lat={Lat} lon={Lon} acc={Acc}m",
                                empSitcod, soccod, empcod, lat, lon, acc);

                            var validation = await _geoValidator.ValidateForSiteAsync(soccod, empSitcod, lat.Value, lon.Value);
                            if (!validation.InsideAnyZone)
                            {
                                var distance = validation.NearestDistanceMeters.HasValue
                                    ? $"{validation.NearestDistanceMeters.Value:F0}m"
                                    : "?";
                                _logger?.LogWarning(
                                    "Pointage hors zone du site rattaché. soccod={Soccod} empcod={Empcod} site={Sitcod} distance={Distance}",
                                    soccod, empcod, empSitcod, distance);
                                if (effectiveMode == "reject")
                                {
                                    return UnprocessableEntity(new
                                    {
                                        message = $"Pointage refusé : vous êtes à {distance} de votre site ({empSitcod}). Le pointage n'est autorisé que depuis le périmètre défini pour votre filiale.",
                                        code = "outside_site_geofence",
                                        distance = validation.NearestDistanceMeters,
                                        sitcod = empSitcod,
                                    });
                                }
                            }
                        }
                    }
                    else if (lat.HasValue && lon.HasValue)
                    {
                        // Pas de geofence sur le site rattaché : on journalise quand même
                        // les coordonnées pour audit anti-fraude (et pour aider à dimensionner
                        // le rayon ultérieurement si l'admin active la zone plus tard).
                        _logger?.LogInformation(
                            "Clock-in GPS (no geofence on site {Sitcod}) soccod={Soccod} empcod={Empcod} lat={Lat} lon={Lon} acc={Acc}m",
                            empSitcod, soccod, empcod, lat, lon, acc);
                    }

                    } // fin else !hasApprovedTeletravail — bypass télétravail au-dessus
                }

                // Si le mobile fournit un horodatage local, on s'en sert (DateTimeKind.Local
                // après bind ASP.NET) ; sinon repli sur l'horloge serveur pour les anciens
                // clients ou les pointages déclenchés via web.
                var stamp = clientTime ?? DateTime.Now;

                // S5 — Tolérance d'écart entre l'horloge mobile et celle du serveur.
                //
                // Le client envoie son heure locale sans suffixe TZ (DateTimeKind.Unspecified
                // après bind). On compare à DateTime.Now du serveur — qui est en heure locale
                // serveur (Europe/Paris via TZ env var). Si l'utilisateur est dans un autre
                // fuseau (Tunisie en CEST → 1h d'écart en été, Maroc en hiver → 1h, Algérie
                // → 1h, Madagascar → 2h…), un écart "normal" peut atteindre 1-2h sans qu'il
                // y ait fraude. Tolérance précédente de 10 min refusait à tort ces pointages.
                //
                // Tolérance : ±90 min — couvre les fuseaux courants (Maghreb, Europe, DOM-TOM
                // proches) tout en bloquant les rétro-pointages qui sont l'attaque réelle
                // (envoyer "lundi matin" un mardi soir → écart de plusieurs heures à plusieurs
                // jours → toujours rejeté). Pour des fuseaux plus éloignés il faudra envoyer
                // l'horodatage en UTC depuis le client (TODO).
                if (clientTime.HasValue)
                {
                    var skew = (DateTime.Now - clientTime.Value).Duration();
                    if (skew > TimeSpan.FromMinutes(90))
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
