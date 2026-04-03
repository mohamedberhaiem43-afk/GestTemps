using ABRPOINT.Server.Dtaos;

namespace ABRPOINT.Server.Services
{
    public interface IPointeuseHttpService
    {
        Task<List<LogEntry>> GetLogsAsync(List<PointeuseType> pointeuseTypes);
        Task<LogEntry?> GetLatestLogAsync(string ip, string password);
        Task<bool> ClearLogsAsync(string ip, int port, int password);
    }
}
