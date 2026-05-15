using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Text.Json;
using System.Text.RegularExpressions;
using UglyToad.PdfPig;

namespace ABRPOINT.Server.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    [Authorize]
    public class DocumentScanController : ControllerBase
    {
        private readonly IHttpClientFactory _httpClientFactory;
        private readonly IConfiguration _config;

        public DocumentScanController(IHttpClientFactory httpClientFactory, IConfiguration config)
        {
            _httpClientFactory = httpClientFactory;
            _config = config;
        }

        /// <summary>
        /// Scan a document (image/PDF) and extract employee information using AI Vision via OpenRouter.
        /// Supports contracts, CIN/ID cards, CVs, and other employment documents.
        /// </summary>
        [HttpPost("scan-employe")]
        [RequestSizeLimit(50_000_000)] // 50MB max — scans haute résolution + PDFs.
        [RequestFormLimits(MultipartBodyLengthLimit = 50_000_000)]
        public async Task<IActionResult> ScanEmployeDocument()
        {
            try
            {
                var form = await Request.ReadFormAsync();
                var file = form.Files.FirstOrDefault();

                if (file == null || file.Length == 0)
                    return BadRequest(new { message = "Aucun fichier fourni. Veuillez télécharger une image ou un PDF." });

                // Validate file type
                var allowedTypes = new[] { "image/jpeg", "image/png", "image/webp", "image/gif", "application/pdf" };
                if (!allowedTypes.Contains(file.ContentType.ToLower()))
                    return BadRequest(new { message = "Type de fichier non supporté. Utilisez JPG, PNG, WebP, GIF ou PDF." });

                // Convert to base64
                string base64Data;
                using (var ms = new MemoryStream())
                {
                    await file.CopyToAsync(ms);
                    base64Data = Convert.ToBase64String(ms.ToArray());
                }

                var apiKey = _config["OpenRouter:ApiKey"];
                var model = _config["OpenRouter:VisionModel"] ?? "google/gemini-2.0-flash-001";
                // Le placeholder de appsettings.json passe IsNullOrEmpty mais provoque
                // un 401 trompeur côté OpenRouter ("Missing Authentication header"). On
                // l'intercepte ici pour renvoyer un message actionnable côté UI.
                if (string.IsNullOrWhiteSpace(apiKey) || apiKey.StartsWith("REPLACE_WITH_", StringComparison.OrdinalIgnoreCase))
                    return StatusCode(500, new { message = "Clé API OpenRouter non configurée. Définir OPENROUTER_API_KEY dans le fichier .env du serveur puis redémarrer abrpoint.server." });

                // Build the AI Vision prompt for employee data extraction
                var extractionPrompt = @"Tu es un assistant expert en extraction de données à partir de documents RH/employé.
Analyse ce document (contrat de travail, carte d'identité CIN, CV, ou autre document employé) et extrais TOUTES les informations disponibles.

Réponds UNIQUEMENT avec un JSON valide (pas de markdown, pas de commentaires) avec cette structure exacte:
{
  ""documentType"": ""contrat"" | ""cin"" | ""cv"" | ""attestation"" | ""autre"",
  ""confidence"": 0.95,
  ""extractedData"": {
    ""empcod"": """",
    ""emplib"": ""Nom complet"",
    ""empmat"": ""Matricule"",
    ""empsexe"": ""M"" ou ""F"",
    ""empcin"": ""Numéro CIN"",
    ""empdnais"": ""DD/MM/YYYY"",
    ""emplnais"": ""Lieu de naissance"",
    ""empsitfam"": ""C"" | ""M"" | ""D"" | ""V"",
    ""empnbp"": 0,
    ""empadr"": ""Adresse"",
    ""emptel"": ""Téléphone"",
    ""empmob"": ""Mobile"",
    ""empemail"": ""Email"",
    ""empemb"": ""DD/MM/YYYY"",
    ""empcontrat"": ""CDI"" | ""CDD"" | ""STAGE"" | ""FREELANCE"",
    ""foncod"": ""Code fonction"",
    ""empfonc"": ""Fonction"",
    ""quacod"": ""Code qualification"",
    ""dircod"": ""Code direction"",
    ""sercod"": ""Code service"",
    ""seccod"": ""Code section"",
    ""empsbase"": 0,
    ""empsbrut"": 0,
    ""catcod"": ""Code catégorie"",
    ""natcod"": ""Code nationalité"",
    ""vilcod"": ""Code ville"",
    ""empfoncar"": ""Fonction en arabe"",
    ""emplibar"": ""Nom en arabe"",
    ""empadrar"": ""Adresse en arabe""
  },
  ""suggestions"": [
    ""Suggestion 1 pour améliorer les données"",
    ""Suggestion 2""
  ]
}

Règles importantes:
- Ne laisse aucune valeur null, utilise une chaîne vide "" si la valeur n'est pas trouvée
- Pour empsexe: ""M"" pour masculin, ""F"" pour féminin
- Pour empsitfam: ""C"" célibataire, ""M"" marié, ""D"" divorcé, ""V"" veuf
- Pour empcontrat: déduis le type de contrat si possible
- confidence: un nombre entre 0 et 1 indiquant ta confiance dans l'extraction
- Les dates doivent être au format DD/MM/YYYY
- Si tu trouves des montants (salaire), mets-les dans empsbase et empsbrut";

                var client = _httpClientFactory.CreateClient();

                // Build the request differently for PDF vs Image
                object requestBody;
                var isPdf = file.ContentType.ToLower() == "application/pdf";

                if (isPdf)
                {
                    // Extract text from PDF using PdfPig
                    string pdfText;
                    using (var pdfStream = new MemoryStream())
                    {
                        await file.CopyToAsync(pdfStream);
                        pdfStream.Position = 0;
                        using var pdfDoc = PdfDocument.Open(pdfStream);
                        var textParts = new System.Text.StringBuilder();
                        foreach (var page in pdfDoc.GetPages())
                        {
                            textParts.AppendLine(page.Text);
                        }
                        pdfText = textParts.ToString();
                    }

                    Console.WriteLine($"[DocumentScan] PDF text extracted: {pdfText.Length} chars");
                    Console.WriteLine($"[DocumentScan] PDF text preview: {pdfText.Substring(0, Math.Min(500, pdfText.Length))}");

                    if (string.IsNullOrWhiteSpace(pdfText))
                        return Ok(new { success = false, message = "Le PDF ne contient pas de texte extractible. Essayez de le scanner en image (JPG/PNG)." });

                    // For PDFs: send extracted text as a text message (no vision needed)
                    requestBody = new
                    {
                        model = model,
                        messages = new[]
                        {
                            new
                            {
                                role = "system",
                                content = "Tu es un assistant expert en extraction de données à partir de textes de documents RH/employé. Réponds UNIQUEMENT en JSON valide."
                            },
                            new
                            {
                                role = "user",
                                content = $"Voici le contenu textuel extrait d'un document PDF:\n\n---\n{pdfText}\n---\n\n{extractionPrompt}"
                            }
                        },
                        temperature = 0.1,
                        max_tokens = 4000
                    };
                }
                else
                {
                    // For images: use vision (image_url format)
                    requestBody = new
                    {
                        model = model,
                        messages = new[]
                        {
                            new
                            {
                                role = "user",
                                content = new object[]
                                {
                                    new
                                    {
                                        type = "image_url",
                                        image_url = new
                                        {
                                            url = $"data:{file.ContentType};base64,{base64Data}"
                                        }
                                    },
                                    new
                                    {
                                        type = "text",
                                        text = extractionPrompt
                                    }
                                }
                            }
                        },
                        temperature = 0.1,
                        max_tokens = 4000
                    };
                }

                var request = new HttpRequestMessage(HttpMethod.Post, "https://openrouter.ai/api/v1/chat/completions")
                {
                    Content = new StringContent(JsonSerializer.Serialize(requestBody), System.Text.Encoding.UTF8, "application/json")
                };
                request.Headers.Add("Authorization", $"Bearer {apiKey}");
                request.Headers.Add("HTTP-Referer", "https://localhost:5173");
                request.Headers.Add("X-Title", "ABRPOINT GestTemps");

                Console.WriteLine($"[DocumentScan] Sending request to OpenRouter. Model: {model}, IsPDF: {isPdf}, FileSize: {file.Length}");

                var response = await client.SendAsync(request);

                var respContent = await response.Content.ReadAsStringAsync();
                Console.WriteLine($"[DocumentScan] API Status: {response.StatusCode}, Response ({respContent.Length} chars): {respContent}");

                if (!response.IsSuccessStatusCode)
                {
                    Console.WriteLine($"[DocumentScan] OpenRouter API Error: {response.StatusCode} - {respContent}");
                    return StatusCode(502, new
                    {
                        message = "Erreur du service AI.",
                        statusCode = (int)response.StatusCode,
                        details = respContent
                    });
                }

                // Check if response contains an error object
                if (respContent.Contains("\"error\"") && !respContent.Contains("\"choices\""))
                {
                    Console.WriteLine($"[DocumentScan] API returned error: {respContent}");
                    return StatusCode(502, new { message = "Erreur retournée par l'API AI.", details = respContent });
                }

                var jsonOpts = new JsonSerializerOptions { PropertyNameCaseInsensitive = true };
                var apiResp = JsonSerializer.Deserialize<OpenRouterResponse>(respContent, jsonOpts);

                var responseText = apiResp?.Choices?.FirstOrDefault()?.Message?.Content;
                var finishReason = apiResp?.Choices?.FirstOrDefault()?.FinishReason;

                Console.WriteLine($"[DocumentScan] ResponseText length: {responseText?.Length ?? 0}, FinishReason: {finishReason}, Choices count: {apiResp?.Choices?.Count ?? 0}");

                if (string.IsNullOrEmpty(responseText))
                {
                    Console.WriteLine($"[DocumentScan] Empty responseText. Full response: {respContent}");
                    return Ok(new { success = false, message = $"Impossible d'extraire les données. Raison: {finishReason ?? "inconnue"}. Vérifiez les logs serveur pour plus de détails.", rawResponse = respContent });
                }

                // Clean the response - remove markdown code blocks if present
                var cleanedJson = CleanJsonResponse(responseText);

                // Parse the extracted JSON
                EmployeExtractionResult? extractionResult;
                try
                {
                    extractionResult = JsonSerializer.Deserialize<EmployeExtractionResult>(cleanedJson, new JsonSerializerOptions
                    {
                        PropertyNameCaseInsensitive = true
                    });
                }
                catch (JsonException ex)
                {
                    Console.WriteLine($"[DocumentScan] JSON Parse Error: erreur interne\nRaw: {cleanedJson}");
                    return Ok(new
                    {
                        success = false,
                        message = "Les données extraites n'ont pas pu être analysées. Le document est peut-être illisible.",
                        rawText = responseText
                    });
                }

                if (extractionResult?.ExtractedData == null)
                    return Ok(new { success = false, message = "Aucune donnée d'employé trouvée dans le document." });

                // Convert date formats from DD/MM/YYYY to YYYY-MM-DD for frontend
                var data = extractionResult.ExtractedData;
                data.Empdnais = ConvertDateFormat(data.Empdnais);
                data.Empemb = ConvertDateFormat(data.Empemb);

                return Ok(new
                {
                    success = true,
                    message = $"Document analysé avec succès (type: {extractionResult.DocumentType}, confiance: {extractionResult.Confidence:P0})",
                    documentType = extractionResult.DocumentType,
                    confidence = extractionResult.Confidence,
                    extractedData = data,
                    suggestions = extractionResult.Suggestions ?? new List<string>()
                });
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[DocumentScan] Error: erreur interne\n{ex.StackTrace}");
                return StatusCode(500, new { message = "Erreur lors de l'analyse du document.", details = "Erreur interne. Consultez les logs serveur pour le détail." });
            }
        }

        /// <summary>
        /// Quick text extraction using AI Vision via OpenRouter.
        /// </summary>
        [HttpPost("quick-scan")]
        [RequestSizeLimit(50_000_000)]
        [RequestFormLimits(MultipartBodyLengthLimit = 50_000_000)]
        public async Task<IActionResult> QuickScan()
        {
            try
            {
                var form = await Request.ReadFormAsync();
                var file = form.Files.FirstOrDefault();

                if (file == null || file.Length == 0)
                    return BadRequest(new { message = "Aucun fichier fourni." });

                var allowedTypes = new[] { "image/jpeg", "image/png", "image/webp" };
                if (!allowedTypes.Contains(file.ContentType.ToLower()))
                    return BadRequest(new { message = "Type de fichier non supporté pour le scan rapide." });

                string base64Data;
                using (var ms = new MemoryStream())
                {
                    await file.CopyToAsync(ms);
                    base64Data = Convert.ToBase64String(ms.ToArray());
                }

                var apiKey = _config["OpenRouter:ApiKey"];
                var model = _config["OpenRouter:VisionModel"] ?? "google/gemini-2.0-flash-001";
                // Le placeholder de appsettings.json passe IsNullOrEmpty mais provoque
                // un 401 trompeur côté OpenRouter ("Missing Authentication header"). On
                // l'intercepte ici pour renvoyer un message actionnable côté UI.
                if (string.IsNullOrWhiteSpace(apiKey) || apiKey.StartsWith("REPLACE_WITH_", StringComparison.OrdinalIgnoreCase))
                    return StatusCode(500, new { message = "Clé API OpenRouter non configurée. Définir OPENROUTER_API_KEY dans le fichier .env du serveur puis redémarrer abrpoint.server." });

                var quickPrompt = @"Extrais rapidement les informations de cet employé depuis ce document.
Réponds UNIQUEMENT en JSON sans markdown:
{""emplib"":"""",""empcin"":"""",""empsexe"":"""",""empdnais"":"""",""emplnais"":"""",""empadr"":"""",""emptel"":"""",""empmob"":"""",""empemail"":"""",""empemb"":"""",""empcontrat"":"""",""empfonc"":""""}";

                var client = _httpClientFactory.CreateClient();

                var requestBody = new
                {
                    model = model,
                    messages = new[]
                    {
                        new
                        {
                            role = "user",
                            content = new object[]
                            {
                                new
                                {
                                    type = "image_url",
                                    image_url = new
                                    {
                                        url = $"data:{file.ContentType};base64,{base64Data}"
                                    }
                                },
                                new
                                {
                                    type = "text",
                                    text = quickPrompt
                                }
                            }
                        }
                    },
                    temperature = 0.0,
                    max_tokens = 1000
                };

                var request = new HttpRequestMessage(HttpMethod.Post, "https://openrouter.ai/api/v1/chat/completions")
                {
                    Content = new StringContent(JsonSerializer.Serialize(requestBody), System.Text.Encoding.UTF8, "application/json")
                };
                request.Headers.Add("Authorization", $"Bearer {apiKey}");

                var response = await client.SendAsync(request);

                if (!response.IsSuccessStatusCode)
                {
                    var errorContent = await response.Content.ReadAsStringAsync();
                    Console.WriteLine($"[DocumentScan] OpenRouter QuickScan API Error: {response.StatusCode} - {errorContent}");
                    return StatusCode(502, new { message = "Erreur du service AI (scan rapide).", details = errorContent });
                }

                var respContent = await response.Content.ReadAsStringAsync();
                var apiResp = JsonSerializer.Deserialize<OpenRouterResponse>(respContent, new JsonSerializerOptions
                {
                    PropertyNameCaseInsensitive = true
                });
                var responseText = apiResp?.Choices?.FirstOrDefault()?.Message?.Content;

                if (string.IsNullOrEmpty(responseText))
                    return Ok(new { success = false, message = "Extraction rapide échouée." });

                var cleanedJson = CleanJsonResponse(responseText);
                return Ok(new { success = true, extractedData = cleanedJson });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = "Erreur lors du scan rapide.", details = "Erreur interne. Consultez les logs serveur pour le détail." });
            }
        }

        private string CleanJsonResponse(string text)
        {
            // Remove markdown code blocks
            var cleaned = Regex.Replace(text, @"```json\s*", "", RegexOptions.IgnoreCase);
            cleaned = Regex.Replace(cleaned, @"```\s*", "");
            cleaned = cleaned.Trim();

            // Find JSON object boundaries
            var startIdx = cleaned.IndexOf('{');
            var endIdx = cleaned.LastIndexOf('}');
            if (startIdx >= 0 && endIdx > startIdx)
            {
                cleaned = cleaned.Substring(startIdx, endIdx - startIdx + 1);
            }

            return cleaned;
        }

        private string? ConvertDateFormat(string? date)
        {
            if (string.IsNullOrEmpty(date)) return date;

            // Try DD/MM/YYYY -> YYYY-MM-DD
            var match = Regex.Match(date, @"(\d{1,2})/(\d{1,2})/(\d{4})");
            if (match.Success)
            {
                var day = match.Groups[1].Value.PadLeft(2, '0');
                var month = match.Groups[2].Value.PadLeft(2, '0');
                var year = match.Groups[3].Value;
                return $"{year}-{month}-{day}";
            }

            // Already YYYY-MM-DD?
            if (Regex.IsMatch(date, @"\d{4}-\d{2}-\d{2}"))
                return date;

            return date;
        }
    }

    // OpenRouter (OpenAI-compatible) Response Models
    public class OpenRouterResponse
    {
        [System.Text.Json.Serialization.JsonPropertyName("choices")]
        public List<OpenRouterChoice> Choices { get; set; } = new();
    }

    public class OpenRouterChoice
    {
        [System.Text.Json.Serialization.JsonPropertyName("message")]
        public OpenRouterMessage Message { get; set; } = new();
        [System.Text.Json.Serialization.JsonPropertyName("finish_reason")]
        public string? FinishReason { get; set; }
    }

    public class OpenRouterMessage
    {
        [System.Text.Json.Serialization.JsonPropertyName("content")]
        public string? Content { get; set; }
        [System.Text.Json.Serialization.JsonPropertyName("role")]
        public string Role { get; set; } = "assistant";
    }

    // Extraction result models
    public class EmployeExtractionResult
    {
        public string DocumentType { get; set; } = "autre";
        public double Confidence { get; set; }
        public EmployeExtractedData ExtractedData { get; set; } = new();
        public List<string> Suggestions { get; set; } = new();
    }

    public class EmployeExtractedData
    {
        public string Empcod { get; set; } = "";
        public string Emplib { get; set; } = "";
        public string Empmat { get; set; } = "";
        public string Empsexe { get; set; } = "";
        public string Empcin { get; set; } = "";
        public string Empdnais { get; set; } = "";
        public string Emplnais { get; set; } = "";
        public string Empsitfam { get; set; } = "";
        public int Empnbp { get; set; }
        public string Empadr { get; set; } = "";
        public string Emptel { get; set; } = "";
        public string Empmob { get; set; } = "";
        public string Empemail { get; set; } = "";
        public string Empemb { get; set; } = "";
        public string Empcontrat { get; set; } = "";
        public string Foncod { get; set; } = "";
        public string Empfonc { get; set; } = "";
        public string Quacod { get; set; } = "";
        public string Dircod { get; set; } = "";
        public string Sercod { get; set; } = "";
        public string Seccod { get; set; } = "";
        public double Empsbase { get; set; }
        public double Empsbrut { get; set; }
        public string Catcod { get; set; } = "";
        public string Natcod { get; set; } = "";
        public string Vilcod { get; set; } = "";
        public string Empfoncar { get; set; } = "";
        public string Emplibar { get; set; } = "";
        public string Empadrar { get; set; } = "";
    }
}