using ABRPOINT.Server.Interfaces;
using Microsoft.AspNetCore.Mvc;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;
using System.Text.RegularExpressions;

namespace ABRPOINT.Server.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class AIAssistantController:ControllerBase
    {
        private readonly IHttpClientFactory _httpClientFactory;
        private readonly IConfiguration _configuration;
        private readonly IPresenceRepository _presenceRepository;

        public AIAssistantController(
        IHttpClientFactory httpClientFactory,
        IConfiguration configuration,
        IPresenceRepository presenceRepository)
        {
            _httpClientFactory = httpClientFactory;
            _configuration = configuration;
            _presenceRepository = presenceRepository;
        }
        [HttpPost("chat")]
        public async Task<IActionResult> Chat([FromBody] ChatRequest request)
        {
            try
            {
                var apiKey = _configuration["Gemini:ApiKey"];
                var client = _httpClientFactory.CreateClient();

                // Enrichir le contexte avec des données réelles
                var contextData = await GetContextData(request.Query);

                var systemPrompt = BuildSystemPrompt(contextData);
                var contents = request.Messages
                .TakeLast(5) // MAX 5 messages
                .Select(m => new
                {
                    role = m.Role,
                    parts = new[] { new { text = m.Content } }
                }).ToList();

                contents.Add(new
                {
                    role = "user",
                    parts = new[] { new { text = request.NewMessage } }
                });

                var requestBody = new
                {
                    contents = contents,
                    systemInstruction = new
                    {
                        parts = new[] { new { text = systemPrompt } }
                    },
                    generationConfig = new
                    {
                        temperature = 0.7,
                        maxOutputTokens = 512

                    }
                };

                var url = $"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={apiKey}";

                var httpRequest = new HttpRequestMessage(HttpMethod.Post, url)
                {
                    Content = new StringContent(
                        JsonSerializer.Serialize(requestBody),
                        Encoding.UTF8,
                        "application/json"
                    )
                };

                var response = await client.SendAsync(httpRequest);
                var responseContent = await response.Content.ReadAsStringAsync();
                var geminiResponse = JsonSerializer.Deserialize<GeminiResponse>(responseContent);

                if (geminiResponse?.Candidates != null && geminiResponse.Candidates.Count > 0)
                {
                    var text = geminiResponse.Candidates[0].Content.Parts[0].Text;
                    return Ok(new { response = text, role = "model" });
                }
                if (response.StatusCode == System.Net.HttpStatusCode.TooManyRequests)
                {
                    return StatusCode(429, new
                    {
                        error = "Trop de requêtes vers l’IA. Veuillez réessayer dans quelques secondes."
                    });
                }


                return BadRequest(new { error = "No response from Gemini" });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { error = ex.Message });
            }
        }

        private async Task<DatabaseContext> GetContextData(string query)
        {
            var context = new DatabaseContext();

            // Détecter le type de question
            var lowerQuery = query.ToLower();

            // Si la question concerne les présences
            if (lowerQuery.Contains("présence") || lowerQuery.Contains("presence") ||
                lowerQuery.Contains("retard") || lowerQuery.Contains("absence"))
            {
                // Récupérer les statistiques récentes
                var today = DateTime.Today;
                var startDate = today.AddDays(-7); // 7 derniers jours

                context.PresenceStats = await _presenceRepository.GetStatistics(startDate, today);
                context.RecentAbsences = await _presenceRepository.GetRecentAbsences(startDate, today, 10);
            }

            // Si la question concerne les repos
            if (lowerQuery.Contains("repos") || lowerQuery.Contains("congé") || lowerQuery.Contains("conge"))
            {
                var startDate = DateTime.Today;
                var endDate = startDate.AddDays(30); // 30 prochains jours

                //context.UpcomingRepos = await _reposRepository.GetUpcomingRepos(startDate, endDate, 10);
            }

            // Si la question demande des statistiques globales
            if (lowerQuery.Contains("statistique") || lowerQuery.Contains("combien") ||
                lowerQuery.Contains("total") || lowerQuery.Contains("nombre"))
            {
                context.GlobalStats = await _presenceRepository.GetGlobalStatistics();
            }

            return context;
        }

        private string BuildSystemPrompt(DatabaseContext context)
        {
            var prompt = @"Tu es un assistant virtuel expert pour une application de gestion de présence et pointage des employés.

# RÔLE
Tu aides les utilisateurs à utiliser l'application, comprendre les données, et résoudre les problèmes.

# CONTEXTE DE L'APPLICATION

## Composants Principaux
1. **EmpPresence** : Affiche l'état de présence des employés
2. **Repos** : Gestion des jours de repos
3. **Pointeuse** : Enregistrement des entrées/sorties
4. **Saisie** : Saisie manuelle des pointages

## Navigation
Tu peux diriger les utilisateurs vers ces pages:
- EmpPresence [NAVIGATE:emppresence]
- Repos [NAVIGATE:repos]
- Pointeuse [NAVIGATE:pointeuse]
- Saisie [NAVIGATE:saisie]
- Dashboard [NAVIGATE:dashboard]

";

            // Ajouter les données réelles au contexte
            if (context.PresenceStats != null)
            {
                prompt += $@"
## DONNÉES DE PRÉSENCE RÉCENTES (7 derniers jours)
- Total employés: {context.PresenceStats.TotalEmployees}
- Présents aujourd'hui: {context.PresenceStats.PresentToday}
- Absents aujourd'hui: {context.PresenceStats.AbsentToday}
- Total retards: {context.PresenceStats.TotalRetards}
- Taux de présence: {context.PresenceStats.AttendanceRate:F2}%
";
            }

            if (context.RecentAbsences != null && context.RecentAbsences.Any())
            {
                prompt += "\n## ABSENCES RÉCENTES\n";
                foreach (var absence in context.RecentAbsences.Take(5))
                {
                    prompt += $"- {absence.EmployeeName} ({absence.Date:dd/MM/yyyy}): {absence.Motif}\n";
                }
            }

            if (context.UpcomingRepos != null && context.UpcomingRepos.Any())
            {
                prompt += "\n## REPOS À VENIR (30 prochains jours)\n";
                foreach (var repos in context.UpcomingRepos.Take(5))
                {
                    prompt += $"- {repos.EmployeeName} ({repos.Date:dd/MM/yyyy}): {repos.Type}\n";
                }
            }

            if (context.GlobalStats != null)
            {
                prompt += $@"
## STATISTIQUES GLOBALES
- Total employés dans le système: {context.GlobalStats.TotalEmployees}
- Moyenne présence mensuelle: {context.GlobalStats.AverageMonthlyAttendance:F2}%
- Total heures travaillées (ce mois): {context.GlobalStats.TotalHoursThisMonth}
";
            }

            prompt += @"

# INSTRUCTIONS
1. Utilise les données réelles ci-dessus pour répondre aux questions
2. Sois précis avec les chiffres
3. Si les données ne sont pas disponibles, dis-le clairement
4. Guide l'utilisateur vers les bonnes pages avec [NAVIGATE:page]
5. Réponds de manière concise en français

Maintenant, réponds à la question de l'utilisateur avec les données réelles.";

            return prompt;
        }

        private async Task<IActionResult> HandleCongeReportRequest(ChatRequest request)
        {
            // Extrayez le code congé (concod) du message
            var concod = ExtractConcocFromMessage(request.NewMessage);

            if (string.IsNullOrEmpty(concod))
            {
                return BadRequest(new
                {
                    response = "Je ne peux pas identifier le code congé dans votre demande. Veuillez spécifier le code congé (ex: télécharger le rapport pour le congé CONG-2024-001).",
                    requiresClarification = true
                });
            }

            // Vérifiez si le congé existe (vous devrez injecter le repository des congés)
            // var congeExists = await _congeRepository.Exists(concod);
            // if (!congeExists) { ... }

            return Ok(new
            {
                response = $"Je vais générer le rapport pour le congé {concod}. Cliquez sur le bouton ci-dessous pour télécharger le PDF.",
                actions = new[] {
            new {
                type = "download",
                label = "📥 Télécharger le rapport",
                url = $"/api/conge/download-conge-report/{concod}",
                method = "GET"
            }
        },
                concod = concod
            });
        }

        private string ExtractConcocFromMessage(string message)
        {
            // Logique pour extraire le code congé
            // Exemple: "télécharger rapport congé CONG-2024-001" -> "CONG-2024-001"

            // Regex pour trouver les codes congé
            var regex = new Regex(@"(CONG|C|RG|REP)[-_]?\d{4}[-_]?\d{3,}");
            var match = regex.Match(message.ToUpper());

            if (match.Success)
                return match.Value;

            // Chercher des numéros après certains mots-clés
            var keywords = new[] { "congé", "conge", "rapport", "numéro", "code" };
            var words = message.Split(' ', StringSplitOptions.RemoveEmptyEntries);

            for (int i = 0; i < words.Length; i++)
            {
                if (keywords.Any(k => words[i].ToLower().Contains(k)) && i + 1 < words.Length)
                {
                    // Le mot suivant pourrait être le code
                    var possibleCode = words[i + 1].Trim('.', ',', '!', '?');
                    if (!string.IsNullOrWhiteSpace(possibleCode))
                        return possibleCode;
                }
            }

            return null;
        }

    }

    // Models
    public class ChatRequest
    {
        public List<ChatMessage> Messages { get; set; } = new();
        public string NewMessage { get; set; } = string.Empty;
        public string Query { get; set; } = string.Empty;
    }

    public class ChatMessage
    {
        public string Role { get; set; } = string.Empty;
        public string Content { get; set; } = string.Empty;
    }

    public class DatabaseContext
    {
        public PresenceStatistics? PresenceStats { get; set; }
        public List<AbsenceInfo>? RecentAbsences { get; set; }
        public List<ReposInfo>? UpcomingRepos { get; set; }
        public GlobalStatistics? GlobalStats { get; set; }
    }

    public class PresenceStatistics
    {
        public int TotalEmployees { get; set; }
        public int PresentToday { get; set; }
        public int AbsentToday { get; set; }
        public int TotalRetards { get; set; }
        public decimal AttendanceRate { get; set; }
    }

    public class AbsenceInfo
    {
        public string EmployeeName { get; set; } = string.Empty;
        public DateTime Date { get; set; }
        public string Motif { get; set; } = string.Empty;
    }

    public class ReposInfo
    {
        public string EmployeeName { get; set; } = string.Empty;
        public DateTime Date { get; set; }
        public string Type { get; set; } = string.Empty;
    }

    public class GlobalStatistics
    {
        public int TotalEmployees { get; set; }
        public decimal AverageMonthlyAttendance { get; set; }
        public decimal TotalHoursThisMonth { get; set; }
    }

    public class GeminiResponse
    {
        [JsonPropertyName("candidates")]
        public List<Candidate> Candidates { get; set; } = new();
    }

    public class Candidate
    {
        [JsonPropertyName("content")]
        public Content Content { get; set; } = new();
    }

    public class Content
    {
        [JsonPropertyName("parts")]
        public List<Part> Parts { get; set; } = new();
    }

    public class Part
    {
        [JsonPropertyName("text")]
        public string Text { get; set; } = string.Empty;
    }
}

