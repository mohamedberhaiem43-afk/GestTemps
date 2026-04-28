using System.Net.Http.Json;
using System.Text.Json.Serialization;

namespace ABRPOINT.Server.Services;

/// <summary>
/// Wrapper minimaliste pour l'API Expo Push (https://exp.host/--/api/v2/push/send).
/// Pas de dépendance externe : on POST en JSON, on parse les tickets retournés
/// pour identifier les tokens devenus invalides (DeviceNotRegistered).
/// </summary>
public interface IExpoPushService
{
    Task<ExpoPushResult> SendAsync(IEnumerable<ExpoPushMessage> messages, CancellationToken ct = default);
}

public sealed record ExpoPushMessage(
    string To,
    string Title,
    string Body,
    object? Data = null,
    string? ChannelId = null,
    string? Sound = "default");

public sealed record ExpoPushResult(int Sent, IReadOnlyList<string> InvalidTokens);

public sealed class ExpoPushService : IExpoPushService
{
    private const string Endpoint = "https://exp.host/--/api/v2/push/send";
    private readonly IHttpClientFactory _httpFactory;
    private readonly ILogger<ExpoPushService> _log;

    public ExpoPushService(IHttpClientFactory httpFactory, ILogger<ExpoPushService> log)
    {
        _httpFactory = httpFactory;
        _log = log;
    }

    public async Task<ExpoPushResult> SendAsync(IEnumerable<ExpoPushMessage> messages, CancellationToken ct = default)
    {
        var list = messages.Where(m => !string.IsNullOrWhiteSpace(m.To)).ToList();
        if (list.Count == 0) return new ExpoPushResult(0, Array.Empty<string>());

        var http = _httpFactory.CreateClient(nameof(ExpoPushService));
        http.DefaultRequestHeaders.Accept.Add(new("application/json"));
        http.Timeout = TimeSpan.FromSeconds(20);

        var payload = list.Select(m => new
        {
            to = m.To,
            title = m.Title,
            body = m.Body,
            data = m.Data,
            sound = m.Sound,
            channelId = m.ChannelId,
            priority = "high",
        });

        try
        {
            var response = await http.PostAsJsonAsync(Endpoint, payload, ct);
            if (!response.IsSuccessStatusCode)
            {
                var raw = await response.Content.ReadAsStringAsync(ct);
                _log.LogWarning("Expo push API non-200 : {Status} {Body}", response.StatusCode, raw);
                return new ExpoPushResult(0, Array.Empty<string>());
            }

            var parsed = await response.Content.ReadFromJsonAsync<ExpoBatchResponse>(cancellationToken: ct);
            var tickets = parsed?.Data ?? new List<ExpoTicket>();
            var invalid = new List<string>();
            for (int i = 0; i < tickets.Count && i < list.Count; i++)
            {
                if (tickets[i].Status == "error" &&
                    string.Equals(tickets[i].Details?.Error, "DeviceNotRegistered", StringComparison.OrdinalIgnoreCase))
                {
                    invalid.Add(list[i].To);
                }
            }
            return new ExpoPushResult(list.Count - invalid.Count, invalid);
        }
        catch (Exception ex)
        {
            _log.LogError(ex, "Expo push send a échoué.");
            return new ExpoPushResult(0, Array.Empty<string>());
        }
    }

    private sealed class ExpoBatchResponse
    {
        [JsonPropertyName("data")] public List<ExpoTicket> Data { get; set; } = new();
    }
    private sealed class ExpoTicket
    {
        [JsonPropertyName("status")] public string? Status { get; set; }
        [JsonPropertyName("id")] public string? Id { get; set; }
        [JsonPropertyName("message")] public string? Message { get; set; }
        [JsonPropertyName("details")] public ExpoTicketDetails? Details { get; set; }
    }
    private sealed class ExpoTicketDetails
    {
        [JsonPropertyName("error")] public string? Error { get; set; }
    }
}
