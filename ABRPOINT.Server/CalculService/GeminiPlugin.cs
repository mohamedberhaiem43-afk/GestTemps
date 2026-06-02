using Microsoft.SemanticKernel;
using System.Text;
using System.Text.Json;
using System.ComponentModel;
using ABRPOINT.Server.Dtaos;

public class GeminiPlugin
{
    private readonly IHttpClientFactory _httpClientFactory;
    private readonly string _apiKey;
    private readonly string _model;
    private readonly Kernel _kernel;

    private const string OpenRouterBaseUrl = "https://openrouter.ai/api/v1/chat/completions";

    public GeminiPlugin(IHttpClientFactory httpClientFactory, string apiKey, string model, Kernel kernel)
    {
        _httpClientFactory = httpClientFactory;
        _apiKey = apiKey;
        _model = model ?? "google/gemini-3.5-flash";
        _kernel = kernel;
    }

    [KernelFunction("GenerateResponse")]
    [Description("Génère une réponse en langage naturel avec AI via OpenRouter")]
    public async Task<string> GenerateAsync(
        [Description("La question ou requête de l'utilisateur")] string prompt,
        [Description("Contexte ou historique de conversation")] string? context = null)
    {
        var client = _httpClientFactory.CreateClient();
        var userMessage = context != null ? $"{context}\n\nQuestion: {prompt}" : prompt;

        var requestBody = new
        {
            model = _model,
            messages = new object[]
            {
                new
                {
                    role = "system",
                    content = "Tu es l'assistant IA expert de Concorde Workforce, la plateforme de gestion de présence, pointage, congés et paie. Réponds en français de manière claire, professionnelle et utile. Utilise des emojis pour rendre les réponses plus attractives. Tu peux aider avec la navigation dans l'application, l'explication des fonctionnalités, l'interprétation des données de pointage et de présence. Quand tu désignes le produit, écris toujours « Concorde Workforce » (jamais ABRPOINT ni GestTemps)."
                },
                new
                {
                    role = "user",
                    content = userMessage
                }
            },
            temperature = 0.7,
            max_tokens = 2000
        };

        var request = new HttpRequestMessage(HttpMethod.Post, OpenRouterBaseUrl)
        {
            Content = new StringContent(JsonSerializer.Serialize(requestBody), Encoding.UTF8, "application/json")
        };
        request.Headers.Add("Authorization", $"Bearer {_apiKey}");
        request.Headers.Add("HTTP-Referer", "https://localhost:5173");
        request.Headers.Add("X-Title", "Concorde Workforce");

        var response = await client.SendAsync(request);

        if (!response.IsSuccessStatusCode)
        {
            var errorContent = await response.Content.ReadAsStringAsync();
            Console.WriteLine($"[GeminiPlugin] OpenRouter API Error: {response.StatusCode} - {errorContent}");
            return $"Erreur API ({response.StatusCode}). Veuillez réessayer.";
        }

        var respContent = await response.Content.ReadAsStringAsync();
        var apiResp = JsonSerializer.Deserialize<OpenRouterChatResponse>(respContent, new JsonSerializerOptions
        {
            PropertyNameCaseInsensitive = true
        });

        var responseText = apiResp?.Choices?.FirstOrDefault()?.Message?.Content;

        if (string.IsNullOrEmpty(responseText))
        {
            return "Pas de réponse";
        }

        return responseText;
    }
}

// OpenRouter Chat Completion Response Models
public class OpenRouterChatResponse
{
    [System.Text.Json.Serialization.JsonPropertyName("choices")]
    public List<OpenRouterChatChoice>? Choices { get; set; }
}

public class OpenRouterChatChoice
{
    [System.Text.Json.Serialization.JsonPropertyName("message")]
    public OpenRouterChatMessage? Message { get; set; }
    [System.Text.Json.Serialization.JsonPropertyName("finish_reason")]
    public string? FinishReason { get; set; }
}

public class OpenRouterChatMessage
{
    [System.Text.Json.Serialization.JsonPropertyName("content")]
    public string? Content { get; set; }
    [System.Text.Json.Serialization.JsonPropertyName("role")]
    public string? Role { get; set; }
}