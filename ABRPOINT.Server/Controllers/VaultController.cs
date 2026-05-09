using ABRPOINT.Server.Authorization;
using ABRPOINT.Server.Data;
using ABRPOINT.Server.Helpers;
using ABRPOINT.Server.Interfaces;
using ABRPOINT.Server.Models;
using ABRPOINT.Server.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;
using System.Text.Json;

namespace ABRPOINT.Server.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    [Authorize]
    public class VaultController : ControllerBase
    {
        private readonly IVaultRepository _vaultRepository;
        private readonly IReportsGenerationService _reportsService;
        private readonly EncryptionService _encryptionService;
        private readonly ApplicationDbContext _db;

        public VaultController(IVaultRepository vaultRepository, IReportsGenerationService reportsService, EncryptionService encryptionService, ApplicationDbContext db)
        {
            _vaultRepository = vaultRepository;
            _reportsService = reportsService;
            _encryptionService = encryptionService;
            _db = db;
        }

        [HttpGet("{soccod}/{empcod}")]
        public async Task<IActionResult> GetDocuments(string soccod, string empcod)
        {
            var callerUticod = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (string.IsNullOrEmpty(callerUticod)) return Unauthorized();

            // L'employé n'a accès qu'à son propre coffre-fort. Un admin / manager peut consulter
            // celui de n'importe quel employé (limité au service du manager).
            if (!string.Equals(callerUticod, empcod, StringComparison.OrdinalIgnoreCase))
            {
                var caller = await _db.Utilisateurs
                    .AsNoTracking()
                    .Where(u => u.Uticod == callerUticod)
                    .Select(u => new { u.Utiadm, u.Utirole })
                    .FirstOrDefaultAsync();
                if (caller is null) return Unauthorized();

                var isAdmin = caller.Utiadm == "1" || PermissionCatalog.IsAdminRole(caller.Utirole);
                var isManager = string.Equals(caller.Utirole, PermissionCatalog.Roles.Manager, StringComparison.OrdinalIgnoreCase);
                if (!isAdmin && !isManager) return Forbid();

                if (!isAdmin && isManager)
                {
                    var callerSercod = await _db.Employes
                        .Where(e => e.Soccod == soccod && e.Empcod == callerUticod)
                        .Select(e => e.Sercod)
                        .FirstOrDefaultAsync();
                    var targetSercod = await _db.Employes
                        .Where(e => e.Soccod == soccod && e.Empcod == empcod)
                        .Select(e => e.Sercod)
                        .FirstOrDefaultAsync();
                    if (string.IsNullOrEmpty(callerSercod) || callerSercod != targetSercod)
                        return Forbid();
                }
            }

            var docs = await _vaultRepository.GetDocumentsAsync(soccod, empcod);
            foreach (var d in docs) d.DocPath = _encryptionService.Decrypt(d.DocPath);
            return Ok(docs);
        }

        // SEC-13 — Vue globale réservée aux admins. Sans, n'importe quel user authentifié
        // pouvait lister tous les documents RH du tenant (fiches de paie, contrats…).
        [HttpGet("admin/{soccod}")]
        public async Task<IActionResult> GetAllDocuments(string soccod)
        {
            if (!await CallerIsAdminAsync()) return Forbid();
            var docs = await _vaultRepository.GetAllDocumentsBySocAsync(soccod);
            foreach (var d in docs) d.DocPath = _encryptionService.Decrypt(d.DocPath);
            return Ok(docs);
        }

        // Helper : caller est-il admin (Utiadm=1 ou rôle admin) ?
        private async Task<bool> CallerIsAdminAsync()
        {
            var caller = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (string.IsNullOrEmpty(caller)) return false;
            return await _db.Utilisateurs.AsNoTracking()
                .Where(u => u.Uticod == caller)
                .Select(u => u.Utiadm == "1" || PermissionCatalog.IsAdminRole(u.Utirole))
                .FirstOrDefaultAsync();
        }

        // Helper : le caller a-t-il accès au document (propriétaire / manager du service / admin) ?
        // Utilisé par download/preview/sign — alignement avec GetDocuments / DeleteDocument.
        private async Task<bool> CallerCanAccessDocAsync(DocumentVault doc)
        {
            var caller = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (string.IsNullOrEmpty(caller)) return false;
            if (string.Equals(caller, doc.Empcod, StringComparison.OrdinalIgnoreCase)) return true;

            var meta = await _db.Utilisateurs.AsNoTracking()
                .Where(u => u.Uticod == caller)
                .Select(u => new { u.Utiadm, u.Utirole })
                .FirstOrDefaultAsync();
            if (meta is null) return false;

            var isAdmin = meta.Utiadm == "1" || PermissionCatalog.IsAdminRole(meta.Utirole);
            if (isAdmin) return true;

            var isManager = string.Equals(meta.Utirole, PermissionCatalog.Roles.Manager, StringComparison.OrdinalIgnoreCase);
            if (!isManager) return false;

            // Manager : doit appartenir au même service que la cible.
            var callerSercod = await _db.Employes.AsNoTracking()
                .Where(e => e.Soccod == doc.Soccod && e.Empcod == caller)
                .Select(e => e.Sercod).FirstOrDefaultAsync();
            var targetSercod = await _db.Employes.AsNoTracking()
                .Where(e => e.Soccod == doc.Soccod && e.Empcod == doc.Empcod)
                .Select(e => e.Sercod).FirstOrDefaultAsync();
            return !string.IsNullOrEmpty(callerSercod) && callerSercod == targetSercod;
        }

        // SEC AI : sans check d'ownership, n'importe quel utilisateur authentifié pouvait
        // énumérer les IDs séquentiels et lire les métadonnées (y compris le DocPath déchiffré)
        // de n'importe quel document du coffre-fort — bulletins de paie, contrats, etc.
        // Aligné avec download/preview/delete : on passe par CallerCanAccessDocAsync.
        [HttpGet("doc/{id}")]
        public async Task<IActionResult> GetDocumentById(int id)
        {
            var doc = await _vaultRepository.GetDocumentByIdAsync(id);
            if (doc == null) return NotFound();
            if (!await CallerCanAccessDocAsync(doc)) return Forbid();
            doc.DocPath = _encryptionService.Decrypt(doc.DocPath);
            return Ok(doc);
        }

        // SEC-14 — Upload self-service : `empcod` doit correspondre au caller (sauf admin).
        // Avant, un employé pouvait déposer un document dans le coffre-fort d'un collègue.
        [HttpPost("upload")]
        [EnableRateLimiting("file-upload")]
        public async Task<IActionResult> UploadDocument([FromForm] IFormFile file, [FromForm] string soccod, [FromForm] string empcod, [FromForm] string docType)
        {
            try
            {
                var caller = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
                if (string.IsNullOrEmpty(caller)) return Unauthorized();
                if (!string.Equals(caller, empcod, StringComparison.OrdinalIgnoreCase)
                    && !await CallerIsAdminAsync())
                {
                    return Forbid();
                }

                var (success, filePath, error) = await FileHelper.SaveFile(file);
                if (!success) return BadRequest(error);

                var doc = new DocumentVault
                {
                    Soccod = soccod,
                    Empcod = empcod,
                    DocName = file.FileName,
                    DocType = docType,
                    DocPath = _encryptionService.Encrypt(filePath),
                    DocSize = file.Length,
                    DocDate = DateTime.UtcNow
                };

                await _vaultRepository.AddDocumentAsync(doc);
                doc.DocPath = _encryptionService.Decrypt(doc.DocPath);
                return Ok(doc);
            }
            catch (Exception ex)
            {
                // SEC-19 — Pas de fuite ex.Message vers le client.
                Console.Error.WriteLine($"[Vault.Upload] {ex}");
                return StatusCode(500, new { message = "Erreur lors du dépôt du document." });
            }
        }

        /// <summary>
        /// Dépose un document dans le coffre-fort d'un employé spécifique (utilisé par
        /// l'admin / le manager pour partager une fiche de paie, contrat, attestation…).
        ///
        /// Sécurité :
        ///   - Réservé aux comptes admin (Utiadm="1" OU rôle "Administrator") ou manager (rôle "Manager").
        ///   - Pour un manager, la cible doit appartenir à son service (Empcod.Sercod == manager.Sercod).
        ///
        /// Effet : crée la ligne DocumentVault liée à l'employé cible + une notification interne
        /// pour que ce dernier soit informé du nouveau document.
        /// </summary>
        [HttpPost("upload-for-employee")]
        [EnableRateLimiting("file-upload")]
        public async Task<IActionResult> UploadDocumentForEmployee(
            [FromForm] IFormFile file,
            [FromForm] string soccod,
            [FromForm] string targetEmpcod,
            [FromForm] string docType,
            [FromForm] string? message)
        {
            var callerUticod = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (string.IsNullOrEmpty(callerUticod)) return Unauthorized();
            if (string.IsNullOrWhiteSpace(targetEmpcod)) return BadRequest("targetEmpcod requis.");

            // Charge le profil appelant pour vérifier ses droits.
            var caller = await _db.Utilisateurs
                .AsNoTracking()
                .Where(u => u.Uticod == callerUticod)
                .Select(u => new { u.Utiadm, u.Utirole })
                .FirstOrDefaultAsync();
            if (caller is null) return Unauthorized();

            var isAdmin = caller.Utiadm == "1" || PermissionCatalog.IsAdminRole(caller.Utirole);
            var isManager = string.Equals(caller.Utirole, PermissionCatalog.Roles.Manager, StringComparison.OrdinalIgnoreCase);
            if (!isAdmin && !isManager)
                return Forbid();

            // Pour un manager : la cible doit être dans son service.
            if (!isAdmin && isManager)
            {
                var callerSercod = await _db.Employes
                    .Where(e => e.Soccod == soccod && e.Empcod == callerUticod)
                    .Select(e => e.Sercod)
                    .FirstOrDefaultAsync();
                var targetSercod = await _db.Employes
                    .Where(e => e.Soccod == soccod && e.Empcod == targetEmpcod)
                    .Select(e => e.Sercod)
                    .FirstOrDefaultAsync();
                if (string.IsNullOrEmpty(callerSercod) || callerSercod != targetSercod)
                    return Forbid();
            }

            var (saved, filePath, error) = await FileHelper.SaveFile(file);
            if (!saved) return BadRequest(error);

            var doc = new DocumentVault
            {
                Soccod = soccod,
                Empcod = targetEmpcod,
                DocName = file.FileName,
                DocType = string.IsNullOrWhiteSpace(docType) ? "Autre" : docType,
                DocPath = _encryptionService.Encrypt(filePath),
                DocSize = file.Length,
                DocDate = DateTime.UtcNow
            };
            await _vaultRepository.AddDocumentAsync(doc);

            // Notification pour le destinataire — l'Uticod du compte employé est égal à son Empcod
            // dans ce projet (cf. claim NameIdentifier = uticod = empcod).
            try
            {
                _db.Notifications.Add(new Notification
                {
                    Uticod = targetEmpcod,
                    Soccod = soccod,
                    Title = "Nouveau document dans votre coffre-fort",
                    Body = string.IsNullOrWhiteSpace(message)
                        ? $"Un document « {doc.DocType} » a été déposé : {doc.DocName}"
                        : message!,
                    Category = "vault_document_uploaded",
                    DataJson = JsonSerializer.Serialize(new { docId = doc.Id, docType = doc.DocType, docName = doc.DocName }),
                    CreatedAt = DateTime.UtcNow,
                });
                await _db.SaveChangesAsync();
            }
            catch
            {
                // Ne pas faire échouer l'upload si la notification ne peut pas être créée :
                // le document est déjà sauvegardé, c'est l'effet métier principal.
            }

            doc.DocPath = _encryptionService.Decrypt(doc.DocPath);
            return Ok(doc);
        }

        [HttpDelete("{id}")]
        public async Task<IActionResult> DeleteDocument(int id)
        {
            var callerUticod = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (string.IsNullOrEmpty(callerUticod)) return Unauthorized();

            var doc = await _vaultRepository.GetDocumentByIdAsync(id);
            if (doc == null) return NotFound();

            // Un document signé ne peut plus être supprimé : la signature
            // électronique en fait une pièce probante (intégrité, audit).
            if (doc.IsSigned)
                return BadRequest(new { message = "Un document signé ne peut pas être supprimé." });

            // Autorisation alignée sur GetDocuments :
            // - employé : uniquement ses propres documents ;
            // - manager : documents des employés de son service ;
            // - admin   : tous les documents.
            if (!string.Equals(callerUticod, doc.Empcod, StringComparison.OrdinalIgnoreCase))
            {
                var caller = await _db.Utilisateurs
                    .AsNoTracking()
                    .Where(u => u.Uticod == callerUticod)
                    .Select(u => new { u.Utiadm, u.Utirole })
                    .FirstOrDefaultAsync();
                if (caller is null) return Unauthorized();

                var isAdmin = caller.Utiadm == "1" || PermissionCatalog.IsAdminRole(caller.Utirole);
                var isManager = string.Equals(caller.Utirole, PermissionCatalog.Roles.Manager, StringComparison.OrdinalIgnoreCase);
                if (!isAdmin && !isManager) return Forbid();

                if (!isAdmin && isManager)
                {
                    var callerSercod = await _db.Employes
                        .Where(e => e.Soccod == doc.Soccod && e.Empcod == callerUticod)
                        .Select(e => e.Sercod)
                        .FirstOrDefaultAsync();
                    var targetSercod = await _db.Employes
                        .Where(e => e.Soccod == doc.Soccod && e.Empcod == doc.Empcod)
                        .Select(e => e.Sercod)
                        .FirstOrDefaultAsync();
                    if (string.IsNullOrEmpty(callerSercod) || callerSercod != targetSercod)
                        return Forbid();
                }
            }

            var success = await _vaultRepository.DeleteDocumentAsync(id);
            if (!success) return NotFound();
            return NoContent();
        }

        // SEC-06 — Download : ownership check. Avant, une simple devinette d'ID
        // séquentiel donnait accès aux fiches de paie / contrats de tous les employés.
        [HttpGet("download/{id}")]
        public async Task<IActionResult> DownloadDocument(int id)
        {
            var doc = await _vaultRepository.GetDocumentByIdAsync(id);
            if (doc == null) return NotFound();
            if (!await CallerCanAccessDocAsync(doc)) return Forbid();

            doc.DocPath = _encryptionService.Decrypt(doc.DocPath);
            var fileName = Path.GetFileName(doc.DocPath);
            var filePath = Path.Combine(FileHelper.GetUploadsPath(), fileName);

            if (!System.IO.File.Exists(filePath))
                return NotFound("File not found on disk.");

            var ext = Path.GetExtension(filePath).ToLowerInvariant();

            // If it's a signed dynamic document, regenerate it with signature.
            // Important : ne PAS produire un PDF factice (`<h1>{docType}</h1>`) quand le
            // template métier n'est pas reconnu — l'utilisateur récupérait alors une
            // « page prédéfinie figée » à la place de sa preuve signée. Si aucun
            // template ne correspond, on retombe sur l'envoi du fichier original.
            if (doc.IsSigned && (ext == ".frx" || ext == ".html"))
            {
                byte[]? pdf = null;
                if (ext == ".html") {
                    var html = await System.IO.File.ReadAllTextAsync(filePath);
                    pdf = _reportsService.GenerateFromHtml(html, doc.Soccod, doc.Empcod);
                } else {
                    var lowerName = doc.DocName.ToLower();
                    if (lowerName.Contains("contrat")) pdf = _reportsService.GenerateContratReport(doc.Soccod, doc.Empcod);
                    else if (lowerName.Contains("autorisation")) pdf = _reportsService.GenerateAutorisationSortieReport(doc.Soccod, doc.Id.ToString());
                }
                if (pdf != null)
                    return File(pdf, "application/pdf", doc.DocName.Replace(ext, ".pdf"));
                // Sinon : fall-through vers le retour standard du fichier brut.
            }

            var memory = new MemoryStream();
            using (var stream = new FileStream(filePath, FileMode.Open))
            {
                await stream.CopyToAsync(memory);
            }
            memory.Position = 0;

            return File(memory, GetContentType(filePath), doc.DocName);
        }

        // SEC-06 — Preview : même ownership check que download.
        [HttpGet("preview/{id}")]
        public async Task<IActionResult> PreviewDocument(int id)
        {
            var doc = await _vaultRepository.GetDocumentByIdAsync(id);
            if (doc == null) return NotFound();
            if (!await CallerCanAccessDocAsync(doc)) return Forbid();

            doc.DocPath = _encryptionService.Decrypt(doc.DocPath);
            var fileName = Path.GetFileName(doc.DocPath);
            var filePath = Path.Combine(FileHelper.GetUploadsPath(), fileName);

            if (!System.IO.File.Exists(filePath))
                return NotFound("File not found on disk.");

            var ext = Path.GetExtension(filePath).ToLowerInvariant();

            // If it's a FastReport template or Visual HTML template, render it on the fly
            bool isFrx = ext == ".frx";
            bool isHtml = ext == ".html";

            if (isFrx || isHtml)
            {
                try {
                    byte[] pdf;
                    if (isHtml)
                    {
                        var html = await System.IO.File.ReadAllTextAsync(filePath);
                        pdf = _reportsService.GenerateFromHtml(html, doc.Soccod, doc.Empcod);
                    }
                    else 
                    {
                        var lowerName = doc.DocName.ToLower();
                        if (lowerName.Contains("contrat")) pdf = _reportsService.GenerateContratReport(doc.Soccod, doc.Empcod);
                        else if (lowerName.Contains("visite")) pdf = _reportsService.GenerateVisiteMedicalReport(doc.Soccod, doc.Empcod);
                        else if (lowerName.Contains("conge")) pdf = _reportsService.GenerateCahierCongeReport(doc.Soccod, DateTime.Now.AddMonths(-1), DateTime.Now, new List<string>{ doc.Empcod });
                        else pdf = _reportsService.GenerateContratReport(doc.Soccod, doc.Empcod);
                    }

                    return File(pdf, "application/pdf", doc.DocName.Replace(".frx", ".pdf").Replace(".html", ".pdf"));
                }
                catch (Exception ex) {
                    return BadRequest(new { message = "Impossible de générer l'aperçu : " + ex.Message });
                }
            }

            var contentType = GetContentType(filePath);
            var memory = new MemoryStream();
            using (var stream = new FileStream(filePath, FileMode.Open))
            {
                await stream.CopyToAsync(memory);
            }
            memory.Position = 0;

            // Inline disposition — browser renders it instead of downloading
            Response.Headers["Content-Disposition"] = $"inline; filename=\"{doc.DocName}\"";
            return File(memory, contentType);
        }

        // SEC-07 — La signature électronique a une valeur juridique (verrouille la
        // suppression). Sans ownership check, n'importe qui pouvait signer le contrat
        // d'un autre employé. Restriction : seul le propriétaire (ou un admin) peut signer.
        [HttpPost("sign/{id}")]
        public async Task<IActionResult> SignDocument(int id, [FromBody] SignRequest request)
        {
            var doc = await _vaultRepository.GetDocumentByIdAsync(id);
            if (doc == null) return NotFound();

            var caller = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (string.IsNullOrEmpty(caller)) return Unauthorized();
            // Pour la signature, on n'autorise PAS le manager : la signature engage
            // personnellement le destinataire du document (pas son N+1).
            if (!string.Equals(caller, doc.Empcod, StringComparison.OrdinalIgnoreCase)
                && !await CallerIsAdminAsync())
            {
                return Forbid();
            }

            // Save signature image to disk
            var (success, filePath, error) = await FileHelper.SaveBase64Image(request.SignatureData);
            if (success) doc.SignaturePath = filePath;

            doc.IsSigned = true;
            doc.SignatureDate = DateTime.UtcNow;
            doc.Status = "Signed";

            await _vaultRepository.UpdateDocumentAsync(doc);
            
            return Ok(new { success = true, certificateId = $"CERT-LEDG-{DateTime.Now.Year}-{Guid.NewGuid().ToString().Substring(0, 8).ToUpper()}" });
        }

        public class SignRequest
        {
            public string SignatureData { get; set; } = null!;
            public string SignerName { get; set; } = null!;
        }

        private string GetContentType(string path)
        {
            var types = new Dictionary<string, string>
            {
                {".pdf", "application/pdf"},
                {".doc", "application/vnd.ms-word"},
                {".docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"},
                {".xls", "application/vnd.ms-excel"},
                {".xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"},
                {".png", "image/png"},
                {".jpg", "image/jpeg"},
                {".jpeg", "image/jpeg"},
                {".gif", "image/gif"},
                {".csv", "text/csv"}
            };
            var ext = Path.GetExtension(path).ToLowerInvariant();
            return types.ContainsKey(ext) ? types[ext] : "application/octet-stream";
        }
    }
}
