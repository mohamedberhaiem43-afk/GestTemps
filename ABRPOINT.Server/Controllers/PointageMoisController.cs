using ABRPOINT.Server.Annotations.EtatsAttributes;
using ABRPOINT.Server.Authorization;
using ABRPOINT.Server.Data;
using ABRPOINT.Server.Repository;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace ABRPOINT.Server.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    [Authorize]
    [ValidateSoccod] // S3 : isolation soccod intra-tenant — empêche les fuites de données RH inter-sociétés.
    public class PointageMoisController : ControllerBase
    {
        private readonly IPointageMoisService _pointageMoisService;
        private readonly ILogger<PointageMoisController>? _logger;
        private readonly IWebHostEnvironment _env;
        private readonly ApplicationDbContext _db;
        public PointageMoisController(IPointageMoisService pointageMoisService, IWebHostEnvironment env, ApplicationDbContext db, ILogger<PointageMoisController>? logger = null)
        {
            _pointageMoisService = pointageMoisService;
            _env = env;
            _db = db;
            _logger = logger;
        }

        /// <summary>
        /// Retourne les heures supplémentaires mensuelles (toutes semaines ou semaine unique)
        /// pour une liste d'employés.
        /// </summary>
        /// <param name="soccod">Code société</param>
        /// <param name="mois">Mois (1-12)</param>
        /// <param name="annee">Année (ex: 2026)</param>
        /// <param name="semaine">Numéro de semaine (0 = toutes, 1-6 = semaine spécifique)</param>
        /// <param name="empcods">Liste des codes employés</param>
        [CanGetEtatMensuelle]
        [HttpGet("{soccod}/{mois}/{annee}/{semaine}")]
        public async Task<IActionResult> GetPointageMois(
            string soccod,
            [FromQuery] List<string> empcods,
            string mois,
            string annee,
            string semaine)
        {
            // ── Validation des paramètres ─────────────────────────────────────
            if (string.IsNullOrWhiteSpace(soccod))
                return BadRequest(new { message = "Le code société est obligatoire." });

            if (empcods == null || empcods.Count == 0)
                return BadRequest(new { message = "Au moins un code employé est requis." });

            if (!int.TryParse(mois, out var moisVal) || moisVal < 1 || moisVal > 12)
                return BadRequest(new { message = "Le mois doit être un entier entre 1 et 12." });

            if (!int.TryParse(annee, out var anneeVal) || anneeVal < 2000 || anneeVal > 2100)
                return BadRequest(new { message = "L'année doit être un entier entre 2000 et 2100." });

            if (!int.TryParse(semaine, out var semVal) || semVal < 0 || semVal > 6)
                return BadRequest(new { message = "La semaine doit être un entier entre 0 et 6." });

            try
            {
                // Isolation par site (IDOR) : on restreint les empcods demandés aux employés des
                // sites du demandeur (admin = tout). Sans ça, un manager du site A pouvait lire les
                // heures sup d'un employé du site B en injectant son empcod dans la query string.
                // ScopedEmpcodsAsync substitue une sentinelle si aucun empcod accessible → jamais
                // de liste vide passée au service (qui l'interpréterait comme « tous les employés »).
                empcods = await SiteAccess.ScopedEmpcodsAsync(_db, soccod, SiteAccess.CallerUticod(HttpContext) ?? string.Empty, empcods);

                var result = await _pointageMoisService
                    .GetPointageMois(soccod, empcods, mois, annee, semaine);

                return Ok(result);
            }
            catch (Exception ex)
            {
                _logger?.LogError(ex,
                    "Échec GetPointageMois soccod={Soccod} mois={Mois} annee={Annee} semaine={Semaine} empcodsCount={Count}",
                    soccod, mois, annee, semaine, empcods.Count);
                if (_env.IsDevelopment())
                {
                    return StatusCode(500, new { message = "Erreur interne du serveur.", details = "Erreur interne. Consultez les logs serveur pour le détail." });
                }
                return StatusCode(500, new { message = "Erreur interne du serveur." });
            }
        }
    }
}