using Microsoft.Identity.Client.Platforms.Features.DesktopOs.Kerberos;

namespace ABRPOINT.Server.Models
{
    public interface IAttendanceService
    {
        Task<bool> ValidateWebAuthnCredential(Credential credential);
        bool RecordAttendance(string userId, DateTime timestamp);
    }
}
