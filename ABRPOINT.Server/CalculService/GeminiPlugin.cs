using Microsoft.SemanticKernel;
using System.Text;
using System.Text.Json;
using System.ComponentModel;
using ABRPOINT.Server.Dtaos;

public class GeminiPlugin
{
    private readonly IHttpClientFactory _httpClientFactory;
    private readonly string _apiKey;
    private readonly Kernel _kernel; // ⭐ Ajouter référence au Kernel

    public GeminiPlugin(IHttpClientFactory httpClientFactory, string apiKey, Kernel kernel)
    {
        _httpClientFactory = httpClientFactory;
        _apiKey = apiKey;
        _kernel = kernel;
    }

    [KernelFunction("GenerateResponse")]
    [Description("Génère une réponse en langage naturel avec Gemini AI")]
    public async Task<string> GenerateAsync(
        [Description("La question ou requête de l'utilisateur")] string prompt,
        [Description("Contexte ou historique de conversation")] string? context = null)
    {
        var client = _httpClientFactory.CreateClient();
        var userMessage = context != null ? $"{context}\n\nQuestion: {prompt}" : prompt;

        var requestBody = new
        {
            contents = new[]
            {
                new { role = "user", parts = new[] { new { text = userMessage } } }
            },
            generationConfig = new
            {
                temperature = 0.7,
                maxOutputTokens = 1000
            },
            tools = new[]
            {
                new
                {
                    function_declarations = new[]
                    {
                        new
                        {
                            name = "get_pointage_mois",
                            description = "Récupère les données de pointage mensuel pour des employés spécifiques",
                            parameters = new
                            {
                                type = "object",
                                properties = new
                                {
                                    soccod = new { type = "string", description = "Code de la société" },
                                    empcods = new { type = "array", items = new { type = "string" }, description = "Liste des codes employés" },
                                    mois = new { type = "string", description = "Mois au format MM (ex: 01, 02, ...)" },
                                    annee = new { type = "string", description = "Année au format YYYY (ex: 2024)" },
                                    semaine = new { type = "string", description = "Numéro de semaine (optionnel, défaut: 0)" }
                                },
                                required = new[] { "soccod", "empcods", "mois", "annee" }
                            }
                        }
                    }
                }
            }
        };

        var url = $"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={_apiKey}";
        var request = new HttpRequestMessage(HttpMethod.Post, url)
        {
            Content = new StringContent(JsonSerializer.Serialize(requestBody), Encoding.UTF8, "application/json")
        };

        var response = await client.SendAsync(request);
        response.EnsureSuccessStatusCode();

        var respContent = await response.Content.ReadAsStringAsync();
        var geminiResp = JsonSerializer.Deserialize<GeminiApiResponse>(respContent);

        // ⭐ VÉRIFIER SI GEMINI DEMANDE D'APPELER UNE FONCTION
        var firstCandidate = geminiResp?.Candidates?.FirstOrDefault();
        if (firstCandidate?.Content?.Parts != null)
        {
            foreach (var part in firstCandidate.Content.Parts)
            {
                // Si Gemini retourne un appel de fonction
                if (part.FunctionCall != null)
                {
                    var functionName = part.FunctionCall.Name;
                    var functionArgs = part.FunctionCall.Args;

                    // Appeler le PointagePlugin
                    if (functionName == "get_pointage_mois")
                    {
                        var pointageResult = await CallPointagePlugin(functionArgs);

                        // Renvoyer le résultat à Gemini pour qu'il formule une réponse
                        return await GetFinalResponseWithFunctionResult(
                            userMessage,
                            functionName,
                            pointageResult
                        );
                    }
                }

                // Si c'est une réponse texte normale
                if (!string.IsNullOrEmpty(part.Text))
                {
                    return part.Text;
                }
            }
        }

        return "Pas de réponse";
    }

    // ⭐ Appeler le PointagePlugin
    private async Task<string> CallPointagePlugin(Dictionary<string, JsonElement> args)
    {
        var kernelArgs = new KernelArguments
        {
            ["soccod"] = args["soccod"].GetString(),
            ["empcods"] = args["empcods"].EnumerateArray().Select(e => e.GetString()).ToList(),
            ["mois"] = args["mois"].GetString(),
            ["annee"] = args["annee"].GetString(),
            ["semaine"] = args.ContainsKey("semaine") ? args["semaine"].GetString() : "0"
        };

        var result = await _kernel.InvokeAsync<List<PointageMois>>(
            pluginName: "Pointage",
            functionName: "GetPointageMois",
            arguments: kernelArgs
        );

        return JsonSerializer.Serialize(result, new JsonSerializerOptions { WriteIndented = true });
    }

    // ⭐ Renvoyer le résultat à Gemini pour formulation finale
    private async Task<string> GetFinalResponseWithFunctionResult(
        string originalPrompt,
        string functionName,
        string functionResult)
    {
        var client = _httpClientFactory.CreateClient();

        var requestBody = new
        {
            contents = new object[]
            {
                new
                {
                    role = "user",
                    parts = new[] { new { text = originalPrompt } }
                },
                new
                {
                    role = "model",
                    parts = new[]
                    {
                        new
                        {
                            functionCall = new
                            {
                                name = functionName
                            }
                        }
                    }
                },
                new
                {
                    role = "function",
                    parts = new[]
                    {
                        new
                        {
                            functionResponse = new
                            {
                                name = functionName,
                                response = new { result = functionResult }
                            }
                        }
                    }
                }
            },
            generationConfig = new { temperature = 0.7, maxOutputTokens = 1000 }
        };

        var url = $"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={_apiKey}";
        var request = new HttpRequestMessage(HttpMethod.Post, url)
        {
            Content = new StringContent(JsonSerializer.Serialize(requestBody), Encoding.UTF8, "application/json")
        };

        var response = await client.SendAsync(request);
        response.EnsureSuccessStatusCode();

        var respContent = await response.Content.ReadAsStringAsync();
        var geminiResp = JsonSerializer.Deserialize<GeminiApiResponse>(respContent);

        return geminiResp?.Candidates?.FirstOrDefault()?.Content?.Parts?.FirstOrDefault()?.Text
               ?? "Impossible de générer une réponse finale";
    }
}

// ⭐ MODÈLES DE RÉPONSE AMÉLIORÉS
public class GeminiApiResponse
{
    public List<Candidate> Candidates { get; set; } = new();
}

public class Candidate
{
    public Content Content { get; set; } = new();
}

public class Content
{
    public List<Part> Parts { get; set; } = new();
}

public class Part
{
    public string? Text { get; set; }
    public FunctionCall? FunctionCall { get; set; }
}

public class FunctionCall
{
    public string Name { get; set; } = "";
    public Dictionary<string, JsonElement> Args { get; set; } = new();
}