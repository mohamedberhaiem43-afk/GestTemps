using ABRPOINT.Server.Annotations.ContratAttributes;
using ABRPOINT.Server.Annotations.EtatsAttributes;
using ABRPOINT.Server.Data;
using ABRPOINT.Server.Dtaos;
using ABRPOINT.Server.Helpers;
using ABRPOINT.Server.Interfaces;
using ABRPOINT.Server.Models;
using ABRPOINT.Server.Services;
using ABRPOINT.Server.Tenancy;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Text.Json;

namespace ABRPOINT.Server.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    [Authorize]
    [RequirePlanFeature(nameof(PlanFeatures.ContractManagement))]
    public class ContratsController : ControllerBase
    {
        private readonly IContratRepository _contratRepository;
        private readonly IReportsGenerationService _reportsGenerationService;
        private readonly ApplicationDbContext _dbContext;
        private readonly IVaultRepository _vaultRepository;
        private readonly EncryptionService _encryptionService;
        private readonly ICurrentTenant _currentTenant;
        private readonly ILogger<ContratsController> _log;

        public ContratsController(
            IContratRepository contratRepository,
            IReportsGenerationService reportsGenerationService,
            ApplicationDbContext dbContext,
            IVaultRepository vaultRepository,
            EncryptionService encryptionService,
            ICurrentTenant currentTenant,
            ILogger<ContratsController> log)
        {
            _contratRepository = contratRepository;
            _reportsGenerationService = reportsGenerationService;
            _dbContext = dbContext;
            _vaultRepository = vaultRepository;
            _encryptionService = encryptionService;
            _currentTenant = currentTenant;
            _log = log;
        }

        [HttpGet("{soccod}/{srvcod}/{sitcod}/{echdeb}/{echfin}")]
        [CanGetContrat]
        public async Task<IActionResult> Get(string soccod, string srvcod, string sitcod, DateTime echdeb, DateTime echfin)
        {
            try
            {
                IEnumerable<Contrat> contrats = await _contratRepository.GetAllSearchAsync(soccod, srvcod, sitcod, echdeb, echfin);
                return Ok(contrats);
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = "Erreur lors de recuperer les contrats", details = "Erreur interne. Consultez les logs serveur pour le détail." });
            }
        }

        [HttpGet("{soccod}/{uticod}/{echdeb}/{echfin}")]
        [CanGetContrat]
        public async Task<IActionResult> Get(string soccod, string uticod, DateTime echdeb, DateTime echfin)
        {
            try
            {
                IEnumerable<Contrat> contrats = await _contratRepository.GetAllByUticodPeriodAsync(soccod, uticod, echdeb, echfin);
                return Ok(contrats);
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = "Erreur lors de recuperer des contrats", details = "Erreur interne. Consultez les logs serveur pour le détail." });
            }
        }

        [HttpGet("get-echeance/{soccod}/{echdeb}/{echfin}/{uticod}")]
        [CanGetEcheanceContrat]
        public async Task<IActionResult> GetEcheanceContrat(string soccod, DateTime echdeb, DateTime echfin, string uticod)
        {
            try
            {
                List<EcheanceContrat> contrats = await _contratRepository.GetEcheanceContratsByDate(soccod, echdeb, echfin, uticod);
                return Ok(contrats);
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = "Erreur lors de recuperer des contrats", details = "Erreur interne. Consultez les logs serveur pour le détail." });
            }
        }

        [HttpGet("get-echeance-contrat-report/{soccod}/{echdeb}/{echfin}")]
        [CanGetEcheanceContrat]
        public IActionResult GetEcheanceContratReport(string soccod, DateTime echdeb, DateTime echfin)
        {
            try
            {
                byte[] pdfBytes = _reportsGenerationService.GenerateEcheanceContratReport(soccod, echdeb, echfin);
                return File(pdfBytes, "application/pdf", "EcheanceContrat.pdf");
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = "Erreur lors de recuperer des contrats", details = "Erreur interne. Consultez les logs serveur pour le détail." });
            }
        }

        // A10 — Sans permission, n'importe quel user authentifié pouvait télécharger
        // le PDF du contrat de n'importe quel collaborateur.
        [HttpGet("get-contrat-report/{soccod}/{empcod}")]
        [CanGetContrat]
        public IActionResult GetContratReport(string soccod, string empcod)
        {
            try
            {
                byte[] pdfBytes = _reportsGenerationService.GenerateContratReport(soccod, empcod);
                return File(pdfBytes, "application/pdf", "Contrat.pdf");
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = "Erreur lors de recuperer des contrats", details = "Erreur interne. Consultez les logs serveur pour le détail." });
            }
        }

        [HttpGet("{soccod}/{uticod}")]
        [CanGetContrat]
        public async Task<IActionResult> Get(string soccod, string uticod)
        {
            try
            {
                IEnumerable<Contrat> contrats = await _contratRepository.GetAllByUticodAsync(soccod, uticod);
                return Ok(contrats);
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = "Erreur lors de recuperer des contrats", details = "Erreur interne. Consultez les logs serveur pour le détail." });
            }
        }

        [HttpGet("search")]
        [CanGetContrat]
        public async Task<IActionResult> Search(
            [FromQuery] string soccod,
            [FromQuery] string uticod,
            [FromQuery] string? srvcod,
            [FromQuery] string? sitcod,
            [FromQuery] DateTime? echdeb,
            [FromQuery] DateTime? echfin)
        {
            try
            {
                if (string.IsNullOrWhiteSpace(soccod) || string.IsNullOrWhiteSpace(uticod))
                    return BadRequest(new { message = "Les parametres soccod et uticod sont obligatoires." });

                IEnumerable<Contrat> contrats = await _contratRepository.SearchAsync(soccod, uticod, srvcod, sitcod, echdeb, echfin);
                return Ok(contrats);
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = "Erreur lors de recuperer des contrats", details = "Erreur interne. Consultez les logs serveur pour le détail." });
            }
        }
        [HttpGet("get-list-echeance/{soccod}/{uticod}")]
        [CanGetEcheanceContrat]
        public IActionResult GetEcheanceContrats(string soccod, string uticod)
        {
            try
            {
                return Ok(_contratRepository.GetEcheanceContrats(soccod, uticod));
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = "Erreur lors de recuperer les contrats", details = "Erreur interne. Consultez les logs serveur pour le détail." });
            }
        }

        [HttpPost]
        [CanAddContrat]
        public async Task<IActionResult> Add(Contrat contrat)
        {
            try
            {
                Contrat dbcontrat = await _contratRepository.GetByConcod(contrat.Soccod, contrat.Concod);
                bool isNew = dbcontrat == null;
                if (isNew)
                    await _contratRepository.AddAsync(contrat);
                else
                    await Put(contrat);

                // Auto-dépôt du contrat dans le coffre-fort de l'employé (best-effort) —
                // uniquement à la création (pas sur l'update Put, sinon on dupliquerait à
                // chaque édition mineure). Plan gating (DigitalVault) géré dans le helper.
                if (isNew)
                    await TryDepositContratInVaultAsync(contrat);

                return Ok(new { message = "Contrat ajoute avec succes" });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = "Erreur lors de l'ajout du contrat", details = "Erreur interne. Consultez les logs serveur pour le détail." });
            }
        }

        [HttpPost("renew")]
        [CanAddContrat]
        public async Task<IActionResult> Renew([FromBody] RenouvellementContratDto renouvellement)
        {
            try
            {
                if (!ModelState.IsValid)
                    return BadRequest(ModelState);

                Contrat renewedContract = await _contratRepository.RenewAsync(renouvellement);
                // Le renouvellement crée un nouveau Concod (cf. RenewAsync) — on dépose donc
                // aussi le PDF dans le coffre-fort, comme pour un ajout classique.
                await TryDepositContratInVaultAsync(renewedContract);
                return Ok(new
                {
                    message = "Contrat renouvele avec succes",
                    contrat = renewedContract
                });
            }
            catch (InvalidOperationException ex)
            {
                return BadRequest(new { message = "Erreur interne. Consultez les logs serveur pour le détail." });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = "Erreur lors du renouvellement du contrat", details = "Erreur interne. Consultez les logs serveur pour le détail." });
            }
        }

        [HttpPut]
        [CanUpdateContrat]
        public async Task<IActionResult> Put([FromBody] Contrat contrat)
        {
            try
            {
                if (contrat == null)
                    return BadRequest();

                await _contratRepository.UpdateAsync(contrat);
                return NoContent();
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = "Erreur lors de modification du contrat", details = "Erreur interne. Consultez les logs serveur pour le détail." });
            }
        }

        // A10 — Liste des contrats expirants : permission consult requise.
        [HttpGet("expiring/{soccod}")]
        [CanGetEcheanceContrat]
        public async Task<IActionResult> GetExpiringContracts(string soccod)
        {
            try
            {
                var now = DateTime.Now;
                var monthStart = new DateTime(now.Year, now.Month, 1);
                var monthEnd = monthStart.AddMonths(1).AddDays(-1);

                // Query employees with contracts expiring this month, joined with employee names
                var expiring = await (
                    from e in _dbContext.Employes
                    where e.Soccod == soccod && e.Actif == "A"
                        && e.Empsort.HasValue
                        && e.Empsort.Value >= monthStart
                        && e.Empsort.Value <= monthEnd
                    select new {
                        empcod = e.Empcod,
                        emplib = e.Emplib,
                        empsort = e.Empsort,
                        empemb = e.Empemb,
                        contype = e.Empcontrat ?? "CDD",
                        soccod = e.Soccod
                    }
                ).ToListAsync();

                return Ok(expiring);
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = "Erreur lors de recuperer les contrats qui expirent", details = "Erreur interne. Consultez les logs serveur pour le détail." });
            }
        }

        [HttpGet("expiring/{soccod}/{uticod}")]
        [CanGetEcheanceContrat]
        public async Task<IActionResult> GetExpiringContracts(string soccod, string uticod)
        {
            try
            {
                var now = DateTime.Now;
                var monthStart = new DateTime(now.Year, now.Month, 1);
                var monthEnd = monthStart.AddMonths(1).AddDays(-1);

                var allContrats = await _contratRepository.GetAllByUticodAsync(soccod, uticod);
                var expiringEmpcods = allContrats
                    .Where(c => c.Empsort.HasValue && c.Empsort.Value >= monthStart && c.Empsort.Value <= monthEnd)
                    .Select(c => c.Empcod)
                    .Distinct()
                    .ToList();

                var employees = await _dbContext.Employes
                    .Where(e => e.Soccod == soccod && expiringEmpcods.Contains(e.Empcod))
                    .ToDictionaryAsync(e => e.Empcod, e => e.Emplib);

                var expiring = allContrats
                    .Where(c => c.Empsort.HasValue && c.Empsort.Value >= monthStart && c.Empsort.Value <= monthEnd)
                    .Select(c => new {
                        c.Soccod, c.Concod, c.Empcod, c.Empsort, c.Contype, c.Empemb,
                        Emplib = employees.GetValueOrDefault(c.Empcod, c.Empcod)
                    })
                    .ToList();

                return Ok(expiring);
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = "Erreur lors de recuperer les contrats qui expirent", details = "Erreur interne. Consultez les logs serveur pour le détail." });
            }
        }

        // A16 — Génération du prochain numéro réservée à ceux qui peuvent créer un contrat.
        [HttpGet("get-next-concod/{soccod}")]
        [CanAddContrat]
        public async Task<IActionResult> GetNextConcod(string soccod)
        {
            try
            {
                var nextConcod = await _contratRepository.GetNextConcodAsync(soccod);
                return Ok(new { concod = nextConcod });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = "Erreur lors de la génération du numéro de contrat", details = "Erreur interne. Consultez les logs serveur pour le détail." });
            }
        }

        /// <summary>
        /// Génère le PDF du contrat fraîchement créé et le dépose silencieusement dans le
        /// coffre-fort numérique de l'employé concerné. Best-effort : toute erreur (plan
        /// Starter sans DigitalVault, génération PDF en panne, disque saturé, etc.) est
        /// loguée mais ne fait pas échouer la création du contrat — l'effet métier
        /// principal (persistance du contrat en DB) reste toujours validé.
        ///
        /// Notification interne envoyée à l'employé via la table notifications (UI bell)
        /// — pas de push Expo ici pour rester synchrone et discret.
        /// </summary>
        private async Task TryDepositContratInVaultAsync(Contrat contrat)
        {
            if (contrat == null || string.IsNullOrEmpty(contrat.Soccod) || string.IsNullOrEmpty(contrat.Empcod))
                return;

            // Plan gating : le coffre-fort n'est dispo qu'à partir de Standard. Sur Starter,
            // on skip silencieusement (les endpoints /api/vault renverraient 402 de toute
            // façon, et on ne veut pas casser la création de contrat pour autant).
            var plan = PlanCatalog.GetPlan(_currentTenant.Current?.PlanCode);
            if (plan?.Features.DigitalVault != true)
                return;

            try
            {
                var pdfBytes = _reportsGenerationService.GenerateContratReport(contrat.Soccod, contrat.Empcod);
                if (pdfBytes is null || pdfBytes.Length == 0)
                {
                    _log.LogWarning("Auto-dépôt coffre-fort : PDF vide pour le contrat {Concod} de {Soccod}/{Empcod}.",
                        contrat.Concod, contrat.Soccod, contrat.Empcod);
                    return;
                }

                var (saved, filePath, error) = await FileHelper.SaveBytes(pdfBytes, ".pdf", _currentTenant.Current?.Slug);
                if (!saved || string.IsNullOrEmpty(filePath))
                {
                    _log.LogWarning("Auto-dépôt coffre-fort : sauvegarde disque échouée pour le contrat {Concod} ({Error}).",
                        contrat.Concod, error);
                    return;
                }

                var doc = new DocumentVault
                {
                    Soccod = contrat.Soccod,
                    Empcod = contrat.Empcod,
                    DocName = $"Contrat_{contrat.Concod}.pdf",
                    DocType = "Contrat",
                    DocPath = _encryptionService.Encrypt(filePath),
                    DocSize = pdfBytes.Length,
                    DocDate = DateTime.UtcNow,
                };
                await _vaultRepository.AddDocumentAsync(doc);

                // Notification interne pour l'employé (best-effort, swallow erreurs).
                try
                {
                    _dbContext.Notifications.Add(new Notification
                    {
                        Uticod = contrat.Empcod, // Uticod == Empcod côté projet (claim NameIdentifier)
                        Soccod = contrat.Soccod,
                        Title = "Nouveau contrat dans votre coffre-fort",
                        Body = $"Votre contrat n° {contrat.Concod} vient d'être déposé dans votre coffre-fort numérique.",
                        Category = "vault_document_uploaded",
                        DataJson = JsonSerializer.Serialize(new { docId = doc.Id, docType = doc.DocType, docName = doc.DocName }),
                        CreatedAt = DateTime.UtcNow,
                    });
                    await _dbContext.SaveChangesAsync();
                }
                catch (Exception nx)
                {
                    _log.LogWarning(nx, "Notification coffre-fort non envoyée pour {Empcod}/{Concod} (best-effort).", contrat.Empcod, contrat.Concod);
                }
            }
            catch (Exception ex)
            {
                _log.LogWarning(ex, "Auto-dépôt coffre-fort échoué pour le contrat {Concod} (best-effort).", contrat.Concod);
            }
        }

        [HttpDelete("{soccod}/{concod}")]
        [CanDeleteContrat]
        public async Task<IActionResult> Delete(string soccod, string concod)
        {
            try
            {
                Contrat contrat = await _contratRepository.GetByConcod(soccod, concod);
                if (contrat == null)
                    return NotFound();

                await _contratRepository.DeleteAsync(contrat);
                return NoContent();
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = "Erreur lors de suppression du contrat", details = "Erreur interne. Consultez les logs serveur pour le détail." });
            }
        }
    }
}
