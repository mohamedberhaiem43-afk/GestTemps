using ABRPOINT.Server.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using UglyToad.PdfPig;
using System.Text;

namespace ABRPOINT.Server.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    [Authorize]
    public class AiController : ControllerBase
    {
        private readonly IAiService _aiService;

        public AiController(IAiService aiService)
        {
            _aiService = aiService;
        }

        [HttpPost("generate-template")]
        public async Task<IActionResult> GenerateTemplate([FromForm] string prompt, [FromForm] IFormFile? exampleFile)
        {
            string? contextText = null;
            if (exampleFile != null && exampleFile.Length > 0)
            {
                try {
                    using var stream = exampleFile.OpenReadStream();
                    using var pdf = PdfDocument.Open(stream);
                    var sb = new StringBuilder();
                    foreach (var page in pdf.GetPages())
                    {
                        sb.Append(page.Text);
                    }
                    contextText = sb.ToString();
                } catch (Exception ex) {
                    return BadRequest("Impossible de lire le fichier exemple : ");
                }
            }

            try {
                var html = await _aiService.GenerateTemplateAsync(prompt, contextText);
                return Ok(new { html });
            } catch (Exception ex) {
                return StatusCode(500, "Erreur interne. Consultez les logs serveur pour le détail.");
            }
        }
    }
}
