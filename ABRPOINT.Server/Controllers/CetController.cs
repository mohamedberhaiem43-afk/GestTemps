using ABRPOINT.Server.Data;
using ABRPOINT.Server.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace ABRPOINT.Server.Controllers
{
    /// <summary>
    /// Compte Épargne Temps (CET) — application de la règle :
    ///   Les congés payés non pris à la date limite paramétrée (par défaut 31-05) sont
    ///   automatiquement transférés vers le CET, dans la limite du plafond paramétré
    ///   (par défaut 10 jours).
    ///
    /// Date et plafond sont stockés sur Parametre (Parcetdatelim, Parcetmaxjours) au
    /// niveau de chaque société, modifiables via PUT /api/cet/parametres.
    /// </summary>
    [Route("api/[controller]")]
    [ApiController]
    [Authorize]
    public class CetController : ControllerBase
    {
        private readonly ApplicationDbContext _db;

        public CetController(ApplicationDbContext db)
        {
            _db = db;
        }

        public sealed class CetParametersDto
        {
            public string Soccod { get; set; } = string.Empty;
            /// <summary>"DD-MM" — date limite annuelle (ex: "31-05").</summary>
            public string? Datelim { get; set; }
            /// <summary>Plafond CET annuel en jours (ex: 10).</summary>
            public float? Maxjours { get; set; }
        }

        public sealed class CetTransferLine
        {
            public string Empcod { get; set; } = string.Empty;
            public float SoldeAvant { get; set; }
            public float Transferes { get; set; }
            public float CetApres { get; set; }
        }

        public sealed class CetTransferResult
        {
            public string Soccod { get; set; } = string.Empty;
            public string Annee { get; set; } = string.Empty;
            public string DateLimite { get; set; } = string.Empty;
            public float MaxJours { get; set; }
            public int EmployesTraites { get; set; }
            public float TotalJoursTransferes { get; set; }
            public List<CetTransferLine> Details { get; set; } = new();
        }

        public sealed class CetSoldeLine
        {
            public string Empcod { get; set; } = string.Empty;
            public string? Emplib { get; set; }
            public string? Annee { get; set; }
            public float Cetjours { get; set; }
        }

        /// <summary>
        /// Liste permanente des soldes CET cumulés par salarié pour la société. Permet de
        /// consulter à tout moment l'état réel du CET (indépendamment d'un aperçu/transfert).
        /// </summary>
        [HttpGet("soldes/{soccod}")]
        public async Task<IActionResult> GetSoldes(string soccod)
        {
            var list = await (
                from s in _db.Soldes
                join e in _db.Employes on new { s.Soccod, s.Empcod } equals new { e.Soccod, e.Empcod } into ej
                from e in ej.DefaultIfEmpty()
                where s.Soccod == soccod
                select new CetSoldeLine
                {
                    Empcod = s.Empcod,
                    Emplib = e != null ? e.Emplib : null,
                    Annee = s.Annee,
                    Cetjours = s.Cetjours ?? 0f,
                }).ToListAsync();

            // Comptes alimentés en premier, puis tri par matricule.
            return Ok(list.OrderByDescending(x => x.Cetjours).ThenBy(x => x.Empcod).ToList());
        }

        /// <summary>Renvoie les paramètres CET pour la société. Crée la ligne par défaut si absente.</summary>
        [HttpGet("parametres/{soccod}")]
        public async Task<IActionResult> GetParametres(string soccod)
        {
            var p = await _db.Parametres.FirstOrDefaultAsync(x => x.Soccod == soccod);
            return Ok(new CetParametersDto
            {
                Soccod = soccod,
                Datelim = p?.Parcetdatelim ?? "31-05",
                Maxjours = p?.Parcetmaxjours ?? 10f,
            });
        }

        /// <summary>Met à jour les paramètres CET (date limite + plafond).</summary>
        [HttpPut("parametres")]
        public async Task<IActionResult> UpdateParametres([FromBody] CetParametersDto dto)
        {
            if (string.IsNullOrWhiteSpace(dto.Soccod))
                return BadRequest(new { error = "Soccod requis." });
            if (!string.IsNullOrWhiteSpace(dto.Datelim) && !System.Text.RegularExpressions.Regex.IsMatch(dto.Datelim, @"^\d{2}-\d{2}$"))
                return BadRequest(new { error = "Datelim doit être au format DD-MM (ex: 31-05)." });
            if (dto.Maxjours.HasValue && dto.Maxjours.Value < 0)
                return BadRequest(new { error = "Maxjours ne peut pas être négatif." });

            // Upsert : la ligne Parametre n'est pas créée automatiquement à la création
            // de la société, donc le premier enregistrement de paramètres CET (ou de
            // n'importe quel autre paramètre) doit créer la ligne plutôt que de renvoyer
            // 404. Cohérent avec GET /parametres/{soccod} qui retourne déjà des valeurs
            // par défaut quand la ligne est absente.
            var p = await _db.Parametres.FirstOrDefaultAsync(x => x.Soccod == dto.Soccod);
            if (p == null)
            {
                p = new Parametre { Soccod = dto.Soccod };
                _db.Parametres.Add(p);
            }
            p.Parcetdatelim = dto.Datelim;
            p.Parcetmaxjours = dto.Maxjours;
            await _db.SaveChangesAsync();
            return Ok(new { success = true });
        }

        /// <summary>
        /// Aperçu (dry-run) du transfert CET pour une société + année donnée. Ne modifie rien.
        /// </summary>
        [HttpGet("preview/{soccod}/{annee}")]
        public async Task<IActionResult> Preview(string soccod, string annee)
            => Ok(await ComputeAsync(soccod, annee, applyChanges: false));

        /// <summary>
        /// Applique le transfert CET : pour chaque solde, transfère min(reste, plafond) vers Cetjours
        /// puis met Conge à Empconge (solde restant à 0). Retourne le détail des lignes traitées.
        /// </summary>
        [HttpPost("apply/{soccod}/{annee}")]
        public async Task<IActionResult> Apply(string soccod, string annee)
            => Ok(await ComputeAsync(soccod, annee, applyChanges: true));

        private async Task<CetTransferResult> ComputeAsync(string soccod, string annee, bool applyChanges)
        {
            var param = await _db.Parametres.FirstOrDefaultAsync(x => x.Soccod == soccod);
            var dateLim = param?.Parcetdatelim ?? "31-05";
            var maxJours = param?.Parcetmaxjours ?? 10f;

            var soldes = await _db.Soldes
                .Where(s => s.Soccod == soccod && s.Annee == annee)
                .ToListAsync();

            var result = new CetTransferResult
            {
                Soccod = soccod,
                Annee = annee,
                DateLimite = dateLim,
                MaxJours = maxJours,
            };

            foreach (var s in soldes)
            {
                var alloue = s.Conge ?? 0f;        // Total alloué sur l'année
                var pris = s.Empconge ?? 0f;       // Déjà consommé
                var reste = alloue - pris;
                if (reste <= 0) continue;
                var transfer = Math.Min(reste, maxJours);
                if (transfer <= 0) continue;

                if (applyChanges)
                {
                    s.Cetjours = (s.Cetjours ?? 0f) + transfer;
                    // Le reste éventuel au-delà du plafond est perdu (règle métier classique
                    // française : "ce qui n'a pas été pris ni transféré au CET tombe").
                    s.Conge = pris; // Solde restant remis à zéro pour l'année.
                }

                result.Details.Add(new CetTransferLine
                {
                    Empcod = s.Empcod,
                    SoldeAvant = reste,
                    Transferes = transfer,
                    CetApres = (s.Cetjours ?? 0f) + (applyChanges ? 0f : transfer),
                });
                result.TotalJoursTransferes += transfer;
                result.EmployesTraites++;
            }

            if (applyChanges) await _db.SaveChangesAsync();
            return result;
        }
    }
}
