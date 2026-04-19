using ABRPOINT.Server.Helpers;
using ABRPOINT.Server.Interfaces;
using ABRPOINT.Server.Models;
using ABRPOINT.Server.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

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

        public VaultController(IVaultRepository vaultRepository, IReportsGenerationService reportsService, EncryptionService encryptionService)
        {
            _vaultRepository = vaultRepository;
            _reportsService = reportsService;
            _encryptionService = encryptionService;
        }

        [HttpGet("{soccod}/{empcod}")]
        public async Task<IActionResult> GetDocuments(string soccod, string empcod)
        {
            var docs = await _vaultRepository.GetDocumentsAsync(soccod, empcod);
            foreach (var d in docs) d.DocPath = _encryptionService.Decrypt(d.DocPath);
            return Ok(docs);
        }

        [HttpGet("admin/{soccod}")]
        public async Task<IActionResult> GetAllDocuments(string soccod)
        {
            var docs = await _vaultRepository.GetAllDocumentsBySocAsync(soccod);
            foreach (var d in docs) d.DocPath = _encryptionService.Decrypt(d.DocPath);
            return Ok(docs);
        }

        [HttpGet("doc/{id}")]
        public async Task<IActionResult> GetDocumentById(int id)
        {
            var doc = await _vaultRepository.GetDocumentByIdAsync(id);
            if (doc == null) return NotFound();
            doc.DocPath = _encryptionService.Decrypt(doc.DocPath);
            return Ok(doc);
        }

        [HttpPost("upload")]
        public async Task<IActionResult> UploadDocument([FromForm] IFormFile file, [FromForm] string soccod, [FromForm] string empcod, [FromForm] string docType)
        {
            try
            {
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
                return StatusCode(500, $"Internal server error: {ex.Message}");
            }
        }

        [HttpDelete("{id}")]
        public async Task<IActionResult> DeleteDocument(int id)
        {
            var success = await _vaultRepository.DeleteDocumentAsync(id);
            if (!success) return NotFound();
            return NoContent();
        }

        [HttpGet("download/{id}")]
        public async Task<IActionResult> DownloadDocument(int id)
        {
            var doc = await _vaultRepository.GetDocumentByIdAsync(id);
            if (doc == null) return NotFound();

            doc.DocPath = _encryptionService.Decrypt(doc.DocPath);
            var fileName = Path.GetFileName(doc.DocPath);
            var filePath = Path.Combine(FileHelper.GetUploadsPath(), fileName);

            if (!System.IO.File.Exists(filePath))
                return NotFound("File not found on disk.");

            var ext = Path.GetExtension(filePath).ToLowerInvariant();
            
            // If it's a signed dynamic document, regenerate it with signature
            if (doc.IsSigned && (ext == ".frx" || ext == ".html"))
            {
                 byte[] pdf;
                 if (ext == ".html") {
                     var html = await System.IO.File.ReadAllTextAsync(filePath);
                     pdf = _reportsService.GenerateFromHtml(html, doc.Soccod, doc.Empcod);
                 } else {
                     var lowerName = doc.DocName.ToLower();
                     if (lowerName.Contains("contrat")) pdf = _reportsService.GenerateContratReport(doc.Soccod, doc.Empcod);
                     else if (lowerName.Contains("autorisation")) pdf = _reportsService.GenerateAutorisationSortieReport(doc.Soccod, doc.Id.ToString());
                     else pdf = _reportsService.GenerateFromHtml("<h1>" + doc.DocType + "</h1>", doc.Soccod, doc.Empcod);
                 }
                 return File(pdf, "application/pdf", doc.DocName.Replace(ext, ".pdf"));
            }

            var memory = new MemoryStream();
            using (var stream = new FileStream(filePath, FileMode.Open))
            {
                await stream.CopyToAsync(memory);
            }
            memory.Position = 0;

            return File(memory, GetContentType(filePath), doc.DocName);
        }

        [HttpGet("preview/{id}")]
        public async Task<IActionResult> PreviewDocument(int id)
        {
            var doc = await _vaultRepository.GetDocumentByIdAsync(id);
            if (doc == null) return NotFound();

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

        [HttpPost("sign/{id}")]
        public async Task<IActionResult> SignDocument(int id, [FromBody] SignRequest request)
        {
            var doc = await _vaultRepository.GetDocumentByIdAsync(id);
            if (doc == null) return NotFound();

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
