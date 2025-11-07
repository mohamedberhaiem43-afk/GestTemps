using ABRPOINT.Server.Data;
using ABRPOINT.Server.Models;
using Microsoft.Identity.Client.Platforms.Features.DesktopOs.Kerberos;

namespace ABRPOINT.Server.Repository
{
    public class AttendaceRepository : IAttendanceService
    {
        private readonly ApplicationDbContext _context; // Your database context
        private readonly IWebAuthnValidator _webAuthnValidator; // A service to handle WebAuthn validation

        public bool RecordAttendance(string userId, DateTime timestamp)
        {
            try
            {
                // Create a new attendance record
                var attendanceRecord = new Presence
                {
                    Empcod = userId,
                    Predat = timestamp,
                    //EventType = DetermineEventType(userId, timestamp) // e.g., 'clock-in' or 'clock-out'
                };

                // Add the record to the database
                _context.Presences.Add(attendanceRecord);
                return true;
            }
            catch (Exception ex)
            {
                // Log the exception (optional)
                Console.WriteLine($"Failed to record attendance: {ex.Message}");
                return false;
            }
        }

        public Task<bool> ValidateWebAuthnCredential(Credential credential)
        {
            throw new NotImplementedException();
        }
        private string DetermineEventType(string userId, DateTime timestamp)
        {
            // You can add logic here to determine if it's a clock-in or clock-out event.
            // This might involve checking the user's last recorded attendance.
            var lastRecord = _context.Presences
                .Where(a => a.Empcod == userId)
                .OrderByDescending(a => a.Predat)
                .FirstOrDefault();

            /*if (lastRecord == null || lastRecord. == "clock-out")
            {
                return "clock-in";
            }*/

            return "clock-out";
        }
    }
}
