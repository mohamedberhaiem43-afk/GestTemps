using ABRPOINT.Server.Dtaos;
using System.Text.Json;

namespace ABRPOINT.Server.Services
{
    public class PointeuseHttpService : IPointeuseHttpService
    {
        private readonly HttpClient _client;

        public PointeuseHttpService(IHttpClientFactory httpClientFactory)
        {
            _client = httpClientFactory.CreateClient("PythonApi");
        }

        public async Task<LogEntry?> GetLatestLogAsync(string ip, string password)
        {
            var response = await _client.GetAsync($"/get_latest_log?ip={ip}&password={password}");
            if (!response.IsSuccessStatusCode) return null;

            var json = await response.Content.ReadAsStringAsync();
            var options = new JsonSerializerOptions
            {
                PropertyNameCaseInsensitive = true,
                Converters = { new DateTimeConverter() }
            };
            return JsonSerializer.Deserialize<LogEntry>(json, options);
        }

        public async Task<bool> ClearLogsAsync(string ip, int port, int password)
        {
            var response = await _client.PostAsync($"/clear_logs?ip={ip}&port={port}&password={password}", null);
            return response.IsSuccessStatusCode;
        }
        public async Task<List<LogEntry>> GetLogsAsync(List<PointeuseType> pointeuseTypes)
        {
            try
            {
                var allLogs = new List<LogEntry>();
                HttpResponseMessage? response;

                foreach (var p in pointeuseTypes)
                {
                    if (p.Poicom == "H")
                    {
                        string ipOnly = p.Ip;
                        int port = 4370;

                        if (p.Ip.Contains(":"))
                        {
                            var parts = p.Ip.Split(':');
                            ipOnly = parts[0];
                            port = int.Parse(parts[1]);
                        }

                        response = await _client.GetAsync($"/get_hikvision_logs?ip={ipOnly}&password={p.Poipwd}&port={port}&days=1000");
                    }

                    else
                        response = await _client.GetAsync($"/get_logs?ip={p.Ip}&password={p.Poipwd}");

                   if (!response.IsSuccessStatusCode)
                        continue;

                    var json = await response.Content.ReadAsStringAsync();
                    JsonSerializerOptions options;
                    if (p.Poicom == "H")
                    {
                        options = new JsonSerializerOptions
                        {
                            PropertyNameCaseInsensitive = true,
                        };
                    }
                    else
                    {
                        options = new JsonSerializerOptions
                        {
                            PropertyNameCaseInsensitive = true,
                            Converters = { new DateTimeConverter() }
                        };
                    }

                        var logResponse = JsonSerializer.Deserialize<LogResponse>(json, options);
                    if (logResponse?.Logs != null)
                        allLogs.AddRange(logResponse.Logs);
                }

                return allLogs;
            }
            catch (Exception)
            {
                throw;
            }

        }

    }
}
