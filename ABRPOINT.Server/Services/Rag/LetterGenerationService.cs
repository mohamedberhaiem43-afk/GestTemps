using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;
using ABRPOINT.Server.Data;
using ABRPOINT.Server.Dtaos;
using ABRPOINT.Server.Models;
using ABRPOINT.Server.Tenancy;
using DinkToPdf;
using DinkToPdf.Contracts;
using DocumentFormat.OpenXml;
using DocumentFormat.OpenXml.Packaging;
using DocumentFormat.OpenXml.Wordprocessing;
using Microsoft.EntityFrameworkCore;

namespace ABRPOINT.Server.Services.Rag;

public sealed class LetterGenerationService : ILetterGenerationService
{
    private static readonly Regex PlaceholderRegex = new(@"{{\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*}}", RegexOptions.Compiled);

    private readonly ApplicationDbContext _db;
    private readonly ICurrentTenant _currentTenant;
    private readonly IClaudeRagService _claude;
    private readonly IConverter _pdf;
    private readonly ILogger<LetterGenerationService> _logger;

    public LetterGenerationService(
        ApplicationDbContext db,
        ICurrentTenant currentTenant,
        IClaudeRagService claude,
        IConverter pdf,
        ILogger<LetterGenerationService> logger)
    {
        _db = db;
        _currentTenant = currentTenant;
        _claude = claude;
        _pdf = pdf;
        _logger = logger;
    }

    public async Task<IReadOnlyList<RagLetterTemplateDto>> ListAsync(CancellationToken ct = default)
    {
        var soccod = RequireSoccod();
        var rows = await _db.RagLetterTemplates
            .Where(x => x.Soccod == soccod)
            .OrderBy(x => x.Name)
            .ToListAsync(ct);
        return rows.Select(ToDto).ToList();
    }

    public async Task<RagLetterTemplateDto?> GetAsync(int id, CancellationToken ct = default)
    {
        var soccod = RequireSoccod();
        var row = await _db.RagLetterTemplates.FirstOrDefaultAsync(x => x.Id == id && x.Soccod == soccod, ct);
        return row == null ? null : ToDto(row);
    }

    public async Task<RagLetterTemplateDto> CreateAsync(RagLetterTemplateUpsertRequest req, CancellationToken ct = default)
    {
        var soccod = RequireSoccod();
        ValidateUpsert(req);

        var row = new RagLetterTemplate
        {
            Soccod = soccod,
            Name = req.Name.Trim(),
            Description = req.Description,
            BodyHtml = req.BodyHtml,
            Category = req.Category,
            PlaceholdersJson = JsonSerializer.Serialize(ExtractPlaceholders(req.BodyHtml)),
            CreatedAt = DateTime.UtcNow
        };
        _db.RagLetterTemplates.Add(row);
        await _db.SaveChangesAsync(ct);
        return ToDto(row);
    }

    public async Task<RagLetterTemplateDto?> UpdateAsync(int id, RagLetterTemplateUpsertRequest req, CancellationToken ct = default)
    {
        var soccod = RequireSoccod();
        ValidateUpsert(req);

        var row = await _db.RagLetterTemplates.FirstOrDefaultAsync(x => x.Id == id && x.Soccod == soccod, ct);
        if (row == null) return null;

        row.Name = req.Name.Trim();
        row.Description = req.Description;
        row.BodyHtml = req.BodyHtml;
        row.Category = req.Category;
        row.PlaceholdersJson = JsonSerializer.Serialize(ExtractPlaceholders(req.BodyHtml));
        row.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync(ct);
        return ToDto(row);
    }

    public async Task<bool> DeleteAsync(int id, CancellationToken ct = default)
    {
        var soccod = RequireSoccod();
        var row = await _db.RagLetterTemplates.FirstOrDefaultAsync(x => x.Id == id && x.Soccod == soccod, ct);
        if (row == null) return false;
        _db.RagLetterTemplates.Remove(row);
        await _db.SaveChangesAsync(ct);
        return true;
    }

    public async Task<(byte[] Bytes, string ContentType, string FileName)> GenerateAsync(
        RagLetterGenerateRequest req,
        string? uticod,
        CancellationToken ct = default)
    {
        var soccod = RequireSoccod();

        var template = await _db.RagLetterTemplates
            .FirstOrDefaultAsync(x => x.Id == req.TemplateId && x.Soccod == soccod, ct)
            ?? throw new InvalidOperationException("Modèle introuvable.");

        // 1. Hydrate les variables.
        var vars = await BuildVariablesAsync(soccod, req.Empcod, ct);
        if (req.ExtraVars != null)
        {
            foreach (var kv in req.ExtraVars)
            {
                vars[kv.Key.ToLowerInvariant()] = kv.Value ?? "";
            }
        }

        var html = SubstitutePlaceholders(template.BodyHtml, vars);

        // 2. Polish IA optionnel.
        if (req.PolishWithAi)
        {
            try
            {
                html = await _claude.PolishAsync(html, "professionnel et formel français", ct);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Polish IA en échec — repli sur le HTML brut");
                // On laisse passer : mieux vaut un courrier non poli qu'une erreur 500.
            }
        }

        // 3. Audit log léger (catégorie letter_gen).
        _db.RagChatLogs.Add(new RagChatLog
        {
            Soccod = soccod,
            Uticod = uticod,
            Category = "letter_gen",
            Question = $"Generate template #{template.Id} ({template.Name}) for empcod={req.Empcod} (polish={req.PolishWithAi}, fmt={req.Format})",
            Answer = null,
            CreatedAt = DateTime.UtcNow
        });
        await _db.SaveChangesAsync(ct);

        // 4. Export.
        var safeName = Sanitize(template.Name);
        var fmt = (req.Format ?? "docx").ToLowerInvariant();
        if (fmt == "pdf")
        {
            var bytes = RenderPdf(html);
            return (bytes, "application/pdf", $"{safeName}.pdf");
        }
        else
        {
            var bytes = RenderDocx(html, template.Name);
            return (bytes, "application/vnd.openxmlformats-officedocument.wordprocessingml.document", $"{safeName}.docx");
        }
    }

    private async Task<Dictionary<string, string>> BuildVariablesAsync(string soccod, string empcod, CancellationToken ct)
    {
        var vars = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
        {
            ["today"] = DateTime.Now.ToString("dd/MM/yyyy"),
            ["soccod"] = soccod,
        };

        // Société.
        var socrow = await _db.Societes.FirstOrDefaultAsync(s => s.Soccod == soccod, ct);
        if (socrow != null)
        {
            vars["soclib"] = socrow.Soclib ?? "";
            vars["socadr"] = socrow.Socadr ?? "";
            vars["socville"] = socrow.Socville ?? "";
            vars["socemail"] = socrow.Socemail ?? "";
            vars["soctel"] = socrow.Soctel ?? "";
        }

        // Employé + dernier contrat.
        var emp = await _db.Employes.FirstOrDefaultAsync(e => e.Soccod == soccod && e.Empcod == empcod, ct);
        if (emp != null)
        {
            vars["empcod"] = emp.Empcod ?? "";
            vars["emplib"] = emp.Emplib ?? "";
            vars["empmat"] = emp.Empmat ?? "";
            vars["empfonc"] = emp.Empfonc ?? "";
            vars["empadr"] = emp.Empadr ?? "";
            vars["emptel"] = emp.Emptel ?? "";
            vars["empcin"] = emp.Empcin ?? "";
            vars["empemb"] = emp.Empemb?.ToString("dd/MM/yyyy") ?? "";
            vars["empdnais"] = emp.Empdnais ?? "";
            vars["emplnais"] = emp.Emplnais ?? "";
        }

        var lastContract = await _db.Contrats
            .Where(c => c.Soccod == soccod && c.Empcod == empcod)
            .OrderByDescending(c => c.Condat)
            .FirstOrDefaultAsync(ct);
        if (lastContract != null)
        {
            vars["contype"] = lastContract.Contype ?? "";
            vars["condat"] = lastContract.Condat?.ToString("dd/MM/yyyy") ?? "";
            vars["empdebut"] = lastContract.Empemb?.ToString("dd/MM/yyyy") ?? "";
            vars["empfin"] = lastContract.Empsort?.ToString("dd/MM/yyyy") ?? "";
        }

        return vars;
    }

    private static string SubstitutePlaceholders(string html, Dictionary<string, string> vars)
    {
        return PlaceholderRegex.Replace(html, m =>
        {
            var key = m.Groups[1].Value.ToLowerInvariant();
            return vars.TryGetValue(key, out var v) ? System.Net.WebUtility.HtmlEncode(v) : m.Value;
        });
    }

    private static List<string> ExtractPlaceholders(string html)
    {
        if (string.IsNullOrEmpty(html)) return new List<string>();
        return PlaceholderRegex.Matches(html)
            .Select(m => m.Groups[1].Value)
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .OrderBy(x => x)
            .ToList();
    }

    private byte[] RenderPdf(string html)
    {
        // white-space:pre-wrap : les modèles sont désormais rédigés en TEXTE SIMPLE
        // (l'utilisateur final ne manipule plus de HTML). On préserve donc les retours
        // à la ligne et les espaces saisis. Reste rétro-compatible avec d'anciens
        // modèles contenant du HTML (les balises sont toujours interprétées).
        var fullHtml = $@"<!DOCTYPE html><html><head><meta charset=""utf-8""/>
<style>body{{font-family:Helvetica,Arial,sans-serif;font-size:12pt;line-height:1.5;color:#222;white-space:pre-wrap;}}</style>
</head><body>{html}</body></html>";

        var doc = new HtmlToPdfDocument
        {
            GlobalSettings = new GlobalSettings
            {
                ColorMode = ColorMode.Color,
                Orientation = Orientation.Portrait,
                PaperSize = PaperKind.A4,
                Margins = new MarginSettings { Top = 25, Bottom = 25, Left = 20, Right = 20 }
            },
            Objects =
            {
                new ObjectSettings
                {
                    HtmlContent = fullHtml,
                    WebSettings = { DefaultEncoding = "utf-8" },
                }
            }
        };
        return _pdf.Convert(doc);
    }

    private static byte[] RenderDocx(string html, string title)
    {
        // v1 simple : on convertit le HTML en texte brut (un paragraphe par <p> ou <br>).
        // Le formatage riche (gras, listes, tableaux) n'est pas conservé — c'est explicite
        // dans la doc utilisateur, à enrichir en v1.1 via HtmlToOpenXml ou OpenXmlPowerTools.
        var paragraphs = HtmlToParagraphs(html);

        using var ms = new MemoryStream();
        using (var doc = WordprocessingDocument.Create(ms, WordprocessingDocumentType.Document))
        {
            var main = doc.AddMainDocumentPart();
            main.Document = new Document();
            var body = main.Document.AppendChild(new Body());

            // Titre.
            body.AppendChild(MakeParagraph(title, bold: true, size: 28));
            body.AppendChild(new Paragraph());

            foreach (var p in paragraphs)
            {
                body.AppendChild(MakeParagraph(p));
            }
        }
        return ms.ToArray();
    }

    private static Paragraph MakeParagraph(string text, bool bold = false, int size = 22)
    {
        var run = new Run();
        var props = new RunProperties();
        if (bold) props.Append(new Bold());
        props.Append(new FontSize { Val = size.ToString() }); // half-points
        run.Append(props);
        run.Append(new Text(text) { Space = SpaceProcessingModeValues.Preserve });
        var p = new Paragraph(run);
        return p;
    }

    private static List<string> HtmlToParagraphs(string html)
    {
        if (string.IsNullOrEmpty(html)) return new List<string>();
        // Remplace les balises de bloc par des sauts de ligne, strip le reste.
        var withBreaks = Regex.Replace(html, @"<\s*(br|/p|/div|/li|/h[1-6])\s*/?>", "\n", RegexOptions.IgnoreCase);
        var noTags = Regex.Replace(withBreaks, @"<[^>]+>", "");
        var decoded = System.Net.WebUtility.HtmlDecode(noTags);
        return decoded
            .Split('\n', StringSplitOptions.None)
            .Select(s => s.Trim())
            .Where(s => !string.IsNullOrEmpty(s))
            .ToList();
    }

    private static void ValidateUpsert(RagLetterTemplateUpsertRequest req)
    {
        if (req == null || string.IsNullOrWhiteSpace(req.Name))
            throw new ArgumentException("Nom de modèle requis.");
        if (string.IsNullOrWhiteSpace(req.BodyHtml))
            throw new ArgumentException("Contenu du modèle requis.");
        if (req.Name.Length > 120)
            throw new ArgumentException("Nom de modèle trop long (max 120).");
    }

    private static RagLetterTemplateDto ToDto(RagLetterTemplate r)
    {
        var placeholders = new List<string>();
        if (!string.IsNullOrWhiteSpace(r.PlaceholdersJson))
        {
            try { placeholders = JsonSerializer.Deserialize<List<string>>(r.PlaceholdersJson) ?? new(); }
            catch { /* ignore */ }
        }
        return new RagLetterTemplateDto
        {
            Id = r.Id,
            Name = r.Name,
            Description = r.Description,
            BodyHtml = r.BodyHtml,
            Placeholders = placeholders,
            Category = r.Category,
            CreatedAt = r.CreatedAt,
            UpdatedAt = r.UpdatedAt
        };
    }

    private string RequireSoccod()
    {
        var s = _currentTenant.Current?.LegacySoccod;
        if (string.IsNullOrEmpty(s))
            throw new InvalidOperationException("Tenant manquant.");
        return s;
    }

    private static string Sanitize(string s)
    {
        var safe = new StringBuilder(s.Length);
        foreach (var c in s)
        {
            safe.Append(char.IsLetterOrDigit(c) || c == '-' || c == '_' ? c : '_');
        }
        return safe.ToString();
    }
}
