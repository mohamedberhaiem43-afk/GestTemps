using System.Text.Json;
using System.Text;

namespace ABRPOINT.Server.Services
{
    public interface IAiService
    {
        Task<string> GenerateTemplateAsync(string prompt, string? contextText = null);
    }

    public class AiService : IAiService
    {
        private readonly HttpClient _httpClient;
        private readonly string _apiKey;
        private readonly string _model;

        public AiService(IConfiguration config, HttpClient httpClient)
        {
            _httpClient = httpClient;
            _apiKey = config["OpenRouter:ApiKey"] ?? "";
            _model = config["OpenRouter:ChatModel"] ?? "google/gemma-4-31b-it:free";
        }

        public async Task<string> GenerateTemplateAsync(string prompt, string? contextText = null)
        {
            if (string.IsNullOrEmpty(_apiKey)) throw new Exception("OpenRouter API Key is missing");

            var systemPrompt = @"Vous êtes un expert juridique en DROIT DU TRAVAIL FRANÇAIS. 
Générez le code HTML pour un document RH basé sur la demande de l'utilisateur. 
RÈGLES CRITIQUES :
1. DROIT FRANÇAIS : Respectez strictement les conventions collectives, le Code du Travail (CDI, CDD, etc.).
2. STRUCTURE : Utilisez <header> pour l'en-tête (incluez [Logo_Entreprise] à gauche), <footer> pour le pied de page, et <main> pour le contenu.
3. VARIABLES : Utilisez UNIQUEMENT :
   - [Logo_Entreprise] (pour le logo)
   - [Table.soclib], [Table.socadr], [Table.emplib], [Table.empmat], [Table.empcin], [Table.empadr], [Table.emptel], [Table.empfonc], [Table.empemb], [Table.empsbase]
   - {{Signature_Employe}}, {{Signature_Entreprise}}

4. STYLE : Utilisez <p>, <b>, <i>, <u>, <br>, <hr> et <table>. ÉVITEZ les <div> complexes ou les classes CSS.
5. EXPORT : Retournez UNIQUEMENT le code HTML. Ne mettez pas de balise <html> ou <body>.";

            if (!string.IsNullOrEmpty(contextText))
            {
                systemPrompt += $"\n\nVoici un exemple de document pour vous inspirer de la structure :\n{contextText}";
            }

            var requestBody = new
            {
                model = _model,
                messages = new[]
                {
                    new { role = "system", content = systemPrompt },
                    new { role = "user", content = prompt }
                }
            };

            var request = new HttpRequestMessage(HttpMethod.Post, "https://openrouter.ai/api/v1/chat/completions");
            request.Headers.Add("Authorization", $"Bearer {_apiKey}");
            request.Content = new StringContent(JsonSerializer.Serialize(requestBody), Encoding.UTF8, "application/json");

            var response = await _httpClient.SendAsync(request);
            if (!response.IsSuccessStatusCode)
            {
                var err = await response.Content.ReadAsStringAsync();
                throw new Exception($"OpenRouter API Error: {err}");
            }

            var result = await response.Content.ReadFromJsonAsync<JsonElement>();
            var content = result.GetProperty("choices")[0].GetProperty("message").GetProperty("content").GetString() ?? "";

            // Strip markdown code blocks if present
            if (content.Contains("```html"))
            {
                content = content.Split("```html")[1].Split("```")[0];
            }
            else if (content.Contains("```"))
            {
                content = content.Split("```")[1].Split("```")[0];
            }

            return content.Trim();
        }
    }
}
