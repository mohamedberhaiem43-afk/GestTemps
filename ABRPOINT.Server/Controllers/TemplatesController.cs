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

        /// <summary>
        /// Path traversal hardening : transforme un nom de template fourni par le client
        /// en chemin absolu garanti à l'intérieur de <c>_vaultPath</c>, ou retourne
        /// <c>null</c> si la valeur est suspecte. Toutes les routes qui combinent
        /// <c>_vaultPath</c> avec un paramètre utilisateur DOIVENT passer par ce helper.
        ///
        /// Règles appliquées (chacune redondante par rapport aux autres = défense en profondeur) :
        ///   1. Refus de toute valeur vide.
        ///   2. Refus si la chaîne contient '..', '/', '\' ou un caractère NUL.
        ///   3. <c>Path.GetFileName</c> : si le résultat diffère de l'entrée, l'utilisateur
        ///      a tenté de glisser un séparateur — refus.
        ///   4. Whitelist regex : lettres Unicode, chiffres, espace, point, tiret, underscore.
        ///   5. Suffixe <c>.html</c> obligatoire (les templates sont du HTML — aucune raison
        ///      d'ouvrir d'autres extensions, en particulier pas <c>.cs</c>, <c>.json</c>, <c>.exe</c>…).
        ///   6. Vérification finale via <c>Path.GetFullPath</c> que le chemin résolu
        ///      reste sous <c>_vaultPath</c> (couvre les rares cas que la regex laisserait passer).
        /// </summary>
        private string? ResolveSafeTemplatePath(string? name)
        {
            if (string.IsNullOrWhiteSpace(name)) return null;
            if (name.Contains("..", StringComparison.Ordinal)
                || name.IndexOfAny(new[] { '/', '\\', '\0' }) >= 0)
            {
                return null;
            }

            var basic = Path.GetFileName(name);
            if (!string.Equals(basic, name, StringComparison.Ordinal)) return null;

            // Lettres (Unicode), chiffres, espace, point, tiret, underscore — termine par .html.
            // Évite les caractères de contrôle, les pipes, les wildcards et les chevrons HTML.
            if (!Regex.IsMatch(basic, @"^[\p{L}\p{N}_\-. ]+\.html$", RegexOptions.CultureInvariant))
                return null;

            var resolved = Path.GetFullPath(Path.Combine(_vaultPath, basic));
            var vaultRoot = Path.GetFullPath(_vaultPath);
            // Le séparateur final évite la confusion `/foo/vault` vs `/foo/vault-evil`.
            var sep = Path.DirectorySeparatorChar.ToString();
            if (!resolved.StartsWith(vaultRoot + sep, StringComparison.OrdinalIgnoreCase))
                return null;

            return resolved;
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
            // Path traversal hardening — sans ce check, `name = "../appsettings.json"` lit
            // un fichier arbitraire (config, secrets, modèles d'autres tenants).
            var filePath = ResolveSafeTemplatePath(name);
            if (filePath is null) return BadRequest(new { message = "Nom de modèle invalide." });
            if (!System.IO.File.Exists(filePath)) return NotFound();

            var content = await System.IO.File.ReadAllTextAsync(filePath);
            return Ok(new { name = Path.GetFileName(filePath), content });
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

            // Path traversal hardening — empêche `request.Name = "../../wwwroot/index"`
            // de créer un fichier hors du dossier des templates.
            var filePath = ResolveSafeTemplatePath(name);
            if (filePath is null) return BadRequest(new { message = "Nom de modèle invalide." });
            if (System.IO.File.Exists(filePath)) return BadRequest("Template already exists");

            var defaultContent = "<h1>Nouveau Modèle</h1><p>Commencez à rédiger votre contrat ici...</p>";
            await System.IO.File.WriteAllTextAsync(filePath, defaultContent);

            return Ok(new { name = Path.GetFileName(filePath), size = defaultContent.Length, lastModified = DateTime.Now });
        }

        [HttpPut("{name}")]
        public async Task<IActionResult> SaveTemplate(string name, [FromBody] TemplateUpdate request)
        {
            // Path traversal hardening — sans ce check, on pouvait écraser n'importe quel
            // fichier accessible au process via `name = "../appsettings.json"`.
            var filePath = ResolveSafeTemplatePath(name);
            if (filePath is null) return BadRequest(new { message = "Nom de modèle invalide." });
            if (!System.IO.File.Exists(filePath)) return NotFound();

            await System.IO.File.WriteAllTextAsync(filePath, request.Content);
            return Ok(new { success = true });
        }

        [HttpDelete("{name}")]
        public IActionResult DeleteTemplate(string name)
        {
            // Path traversal hardening — sans ce check, un appelant pouvait demander
            // la suppression de fichiers hors VaultTemplates.
            var filePath = ResolveSafeTemplatePath(name);
            if (filePath is null) return BadRequest(new { message = "Nom de modèle invalide." });
            if (!System.IO.File.Exists(filePath)) return NotFound(new { message = "Fichier introuvable" });

            System.IO.File.Delete(filePath);
            return Ok(new { success = true, message = "Modèle supprimé" });
        }

        [HttpPut("rename/{name}")]
        public IActionResult RenameTemplate(string name, [FromBody] TemplateRename request)
        {
            if (string.IsNullOrEmpty(request.NewName)) return BadRequest("Le nouveau nom est requis");

            // Path traversal hardening : on valide à la fois la source ET la destination.
            // Sans ça, un attaquant pouvait déplacer un fichier de la vault vers une autre
            // arborescence (RCE potentielle si la cible est servie statiquement) ou
            // l'inverse — déplacer un fichier sensible dans la vault pour le lire ensuite.
            var oldPath = ResolveSafeTemplatePath(name);
            if (oldPath is null) return BadRequest(new { message = "Nom de modèle invalide." });
            if (!System.IO.File.Exists(oldPath)) return NotFound(new { message = "Fichier introuvable" });

            var newName = request.NewName.EndsWith(".html") ? request.NewName : request.NewName + ".html";
            var newPath = ResolveSafeTemplatePath(newName);
            if (newPath is null) return BadRequest(new { message = "Nouveau nom de modèle invalide." });

            if (System.IO.File.Exists(newPath)) return BadRequest(new { message = "Un fichier avec ce nom existe déjà" });

            System.IO.File.Move(oldPath, newPath);
            return Ok(new { success = true, oldName = Path.GetFileName(oldPath), newName = Path.GetFileName(newPath) });
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
                    // Path traversal hardening — comme `GetTemplateContent`.
                    var filePath = ResolveSafeTemplatePath(name);
                    if (filePath is null) return BadRequest(new { message = "Nom de modèle invalide." });
                    if (!System.IO.File.Exists(filePath)) return NotFound();
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
