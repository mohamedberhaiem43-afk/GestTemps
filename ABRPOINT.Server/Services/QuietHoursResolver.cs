using ABRPOINT.Helper;
using ABRPOINT.Server.Data;
using ABRPOINT.Server.Models;
using Microsoft.EntityFrameworkCore;

namespace ABRPOINT.Server.Services;

/// <summary>
/// Calcule l'état "silencieux" pour un utilisateur à un instant donné. Centralise les 2 modes :
///   - manual     : compare l'heure courante au créneau {QuietStart, QuietEnd} défini par l'utilisateur.
///   - auto_poste : silencieux quand on est *hors* des heures de travail du poste de l'employé pour
///                  le jour courant (matin start → soir end, pause incluse).
///
/// Retourne en bonus le moment où le silence prend fin (UI : "Silencieux jusqu'à 07:00").
/// </summary>
public sealed class QuietHoursResolver
{
    private readonly ApplicationDbContext _db;
    public QuietHoursResolver(ApplicationDbContext db) { _db = db; }

    public sealed record QuietState(bool IsSilent, string? Until, string Reason, string Mode);

    public async Task<QuietState> EvaluateAsync(string uticod, DateTime now, CancellationToken ct = default)
    {
        var settings = await _db.NotificationUserSettings.AsNoTracking()
            .FirstOrDefaultAsync(s => s.Uticod == uticod, ct);
        if (settings is null || !settings.QuietEnabled)
            return new QuietState(false, null, "Heures silencieuses désactivées.", "manual");

        var mode = settings.QuietMode?.Trim().ToLowerInvariant() ?? "manual";

        if (mode == "auto_poste")
        {
            // Trouve l'employé + son poste pour le jour courant. Si rien trouvé, on retombe sur le manuel.
            var poste = await ResolvePosteForUserAsync(uticod, now, ct);
            if (poste != null)
            {
                var (mStart, mEnd, eStart, eEnd) = GenericMethodes.GetStartsWorkDay(now.Date, poste);
                // Plage de travail = [morningStart, eveningEnd ou morningEnd]. La pause déjeuner reste
                // considérée comme "au travail" (l'employé peut être joignable).
                var workStart = ParseHHmmToMin(mStart);
                var workEnd = ParseHHmmToMin(eEnd) ?? ParseHHmmToMin(mEnd);
                if (workStart.HasValue && workEnd.HasValue)
                {
                    var nowMin = now.Hour * 60 + now.Minute;
                    var inWork = nowMin >= workStart.Value && nowMin < workEnd.Value;
                    if (!inWork)
                    {
                        var until = MinutesToHHmm(workStart.Value);
                        return new QuietState(true, until,
                            $"Hors heures de travail — silencieux jusqu'à {until}.", "auto_poste");
                    }
                    return new QuietState(false, null, "En heures de travail.", "auto_poste");
                }
            }
            // Pas de poste résolvable → on traite comme désactivé pour ne pas bloquer toutes les notifs.
            return new QuietState(false, null, "Aucun poste configuré pour le mode automatique.", "auto_poste");
        }

        // Mode manual : utilise QuietStart / QuietEnd directement.
        var nowMinM = now.Hour * 60 + now.Minute;
        var startMin = ParseHHmmToMin(settings.QuietStart);
        var endMin = ParseHHmmToMin(settings.QuietEnd);
        if (!startMin.HasValue || !endMin.HasValue || startMin.Value == endMin.Value)
            return new QuietState(false, null, "Plage manuelle invalide.", "manual");

        bool inside;
        if (startMin.Value < endMin.Value)
            inside = nowMinM >= startMin.Value && nowMinM < endMin.Value;
        else
            // Traverse minuit (ex: 22:00 → 07:00)
            inside = nowMinM >= startMin.Value || nowMinM < endMin.Value;

        if (inside)
        {
            var until = MinutesToHHmm(endMin.Value);
            return new QuietState(true, until, $"Heures silencieuses jusqu'à {until}.", "manual");
        }
        return new QuietState(false, null, "Hors plage silencieuse.", "manual");
    }

    private async Task<Poste?> ResolvePosteForUserAsync(string uticod, DateTime date, CancellationToken ct)
    {
        // L'utilisateur peut être un employé (Empcod = Uticod). On cherche son code poste actif.
        var emp = await _db.Employes.AsNoTracking()
            .Where(e => e.Empcod == uticod)
            .Select(e => new { e.Soccod, e.Poscod, e.Catcod })
            .FirstOrDefaultAsync(ct);
        if (emp is null || string.IsNullOrEmpty(emp.Poscod) || string.IsNullOrEmpty(emp.Soccod))
            return null;

        return await _db.Postes.AsNoTracking()
            .FirstOrDefaultAsync(p => p.Soccod == emp.Soccod && p.Codposte == emp.Poscod, ct);
    }

    private static int? ParseHHmmToMin(string? s)
    {
        if (string.IsNullOrEmpty(s)) return null;
        var parts = s.Split(':');
        if (parts.Length < 2) return null;
        if (!int.TryParse(parts[0], out var h) || !int.TryParse(parts[1], out var m)) return null;
        if (h < 0 || h > 23 || m < 0 || m > 59) return null;
        return h * 60 + m;
    }

    private static string MinutesToHHmm(int min)
    {
        var h = (min / 60) % 24;
        var m = min % 60;
        return $"{h:D2}:{m:D2}";
    }
}
