using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using UglyToad.PdfPig;
using System.Text.RegularExpressions;
using System.Text;
using ABRPOINT.Server.Interfaces;
using System.IO;

namespace ABRPOINT.Server.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    [Authorize]
    public class TemplatesController : ControllerBase
    {
        private readonly string _reportsPath;
        private readonly string _vaultPath;
        private readonly IReportsGenerationService _reportsService;

        public TemplatesController(IWebHostEnvironment env, IReportsGenerationService reportsService)
        {
            _reportsPath = Path.Combine(env.ContentRootPath, "Reports");
            _vaultPath = Path.Combine(env.ContentRootPath, "VaultTemplates");
            _reportsService = reportsService;

            if (!Directory.Exists(_vaultPath)) Directory.CreateDirectory(_vaultPath);
        }

        [HttpGet]
        public IActionResult GetTemplates()
        {
            if (!Directory.Exists(_vaultPath)) return Ok(new List<object>());

            var files = Directory.GetFiles(_vaultPath, "*.html")
                                .Select(f => new {
                                    name = Path.GetFileName(f),
                                    size = new FileInfo(f).Length,
                                    lastModified = new FileInfo(f).LastWriteTime
                                });

            return Ok(files);
        }

        [HttpGet("{name}")]
        public async Task<IActionResult> GetTemplateContent(string name)
        {
            var filePath = Path.Combine(_vaultPath, name);
            if (!System.IO.File.Exists(filePath)) return NotFound();

            var content = await System.IO.File.ReadAllTextAsync(filePath);
            return Ok(new { name, content });
        }

        [HttpPost("import-pdf")]
        [Consumes("multipart/form-data")]
        public async Task<IActionResult> ImportPdf([FromForm] IFormFile file)
        {
            if (file == null || file.Length == 0) return BadRequest("Fichier invalide");
            
            try 
            {
                using var stream = file.OpenReadStream();
                using var pdf = PdfDocument.Open(stream);
                var sb = new StringBuilder();
                foreach (var page in pdf.GetPages())
                {
                    var text = page.Text;
                    if (!string.IsNullOrWhiteSpace(text))
                    {
                        var lines = text.Split('\n');
                        foreach (var line in lines)
                        {
                            if (!string.IsNullOrWhiteSpace(line))
                                sb.Append($"<p>{System.Net.WebUtility.HtmlEncode(line.Trim())}</p>");
                        }
                    }
                }
                
                if (sb.Length == 0)
                    return BadRequest("Aucun texte n'a pu être extrait du PDF. Le document est peut-être une image scannée ou protégé.");

                return Ok(new { text = sb.ToString() });
            }
            catch (Exception ex)
            {
                return BadRequest("Erreur lors de l'extraction du PDF : " + ex.Message);
            }
        }

        [HttpPost]
        public async Task<IActionResult> CreateTemplate([FromBody] TemplateCreate request)
        {
            if (string.IsNullOrEmpty(request.Name)) return BadRequest("Name is required");
            var name = request.Name.EndsWith(".html") ? request.Name : request.Name + ".html";
            var filePath = Path.Combine(_vaultPath, name);
            
            if (System.IO.File.Exists(filePath)) return BadRequest("Template already exists");

            var defaultContent = "<h1>Nouveau Modèle</h1><p>Commencez à rédiger votre contrat ici...</p>";
            await System.IO.File.WriteAllTextAsync(filePath, defaultContent);
            
            return Ok(new { name, size = defaultContent.Length, lastModified = DateTime.Now });
        }

        [HttpPut("{name}")]
        public async Task<IActionResult> SaveTemplate(string name, [FromBody] TemplateUpdate request)
        {
            var filePath = Path.Combine(_vaultPath, name);
            if (!System.IO.File.Exists(filePath)) return NotFound();

            await System.IO.File.WriteAllTextAsync(filePath, request.Content);
            return Ok(new { success = true });
        }

        [HttpDelete("{name}")]
        public IActionResult DeleteTemplate(string name)
        {
            var filePath = Path.Combine(_vaultPath, name);
            if (!System.IO.File.Exists(filePath)) return NotFound(new { message = "Fichier introuvable" });

            System.IO.File.Delete(filePath);
            return Ok(new { success = true, message = "Modèle supprimé" });
        }

        [HttpPut("rename/{name}")]
        public IActionResult RenameTemplate(string name, [FromBody] TemplateRename request)
        {
            if (string.IsNullOrEmpty(request.NewName)) return BadRequest("Le nouveau nom est requis");

            var oldPath = Path.Combine(_vaultPath, name);
            if (!System.IO.File.Exists(oldPath)) return NotFound(new { message = "Fichier introuvable" });

            var newName = request.NewName.EndsWith(".html") ? request.NewName : request.NewName + ".html";
            var newPath = Path.Combine(_vaultPath, newName);

            if (System.IO.File.Exists(newPath)) return BadRequest(new { message = "Un fichier avec ce nom existe déjà" });

            System.IO.File.Move(oldPath, newPath);
            return Ok(new { success = true, oldName = name, newName });
        }

        [HttpGet("preview/{name}")]
        public async Task<IActionResult> PreviewTemplate(string name, [FromQuery] string soccod = "01", [FromQuery] string empcod = "001091")
        {
            try 
            {
                byte[] pdf;
                var lowerName = name.ToLower();
                
                if (lowerName.EndsWith(".html"))
                {
                    var filePath = Path.Combine(_vaultPath, name);
                    var html = await System.IO.File.ReadAllTextAsync(filePath);
                    pdf = _reportsService.GenerateFromHtml(html, soccod, empcod);
                }
                else if (lowerName.Contains("contrat")) {
                    pdf = _reportsService.GenerateContratReport(soccod, empcod);
                } 
                else if (lowerName.Contains("visite")) {
                    pdf = _reportsService.GenerateVisiteMedicalReport(soccod, empcod);
                } else if (lowerName.Contains("conge")) {
                    pdf = _reportsService.GenerateCahierCongeReport(soccod, DateTime.Now.AddMonths(-1), DateTime.Now, new List<string>{ empcod });
                } else {
                    // Fallback to contrat rendering which uses basic employee/soc info
                    pdf = _reportsService.GenerateContratReport(soccod, empcod);
                }

                return File(pdf, "application/pdf", name.Replace(".frx", ".pdf"));
            }
            catch (Exception ex)
            {
                return BadRequest(new { message = "Erreur lors de la génération de l'aperçu : " + ex.Message });
            }
        }

        public class TemplateUpdate
        {
            public string Content { get; set; } = null!;
        }

        public class TemplateCreate
        {
            public string Name { get; set; } = null!;
        }

        public class TemplateRename
        {
            public string NewName { get; set; } = null!;
        }
    }
}
