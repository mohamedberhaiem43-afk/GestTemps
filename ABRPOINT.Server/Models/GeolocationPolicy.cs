using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace ABRPOINT.Server.Models;

/// <summary>
/// Politique de géolocalisation paramétrable par tenant — RGPD clause 13.3
/// points 2 (plages horaires) et 4 (limitation à la finalité déclarée).
/// Singleton par tenant.
///
/// Les paramètres sont lus à chaque pointage par <c>PresencesController</c> et
/// par <c>MissionsController</c> pour décider si la capture GPS doit être
/// effectuée ou ignorée. Le pointage en lui-même n'est jamais refusé hors
/// plage — seule la collecte des coordonnées est désactivée (cf. décision
/// produit 2026-05 : pas de prise d'otage opérationnelle).
/// </summary>
[Table("geolocation_policy")]
public class GeolocationPolicy
{
    [Key]
    [Column("id")]
    public int Id { get; set; } = 1;

    // ─── Sous-finalités (point 4 RGPD 13.3) ──────────────────────────────────
    /// <summary>Capture GPS lors du pointage entrée/sortie standard.</summary>
    [Column("enabled_for_clock_in")]
    public bool EnabledForClockIn { get; set; } = true;

    /// <summary>Capture GPS lors de la saisie/validation des missions.</summary>
    [Column("enabled_for_missions")]
    public bool EnabledForMissions { get; set; } = true;

    // ─── Plages horaires (point 2 RGPD 13.3) ─────────────────────────────────
    /// <summary>
    /// Heure de début de la fenêtre autorisée (format "HH:MM" 24h, heure locale serveur).
    /// Défaut "06:00" — au-delà de cette heure jusqu'à WindowEndTime, la géoloc s'applique.
    /// </summary>
    [Column("window_start_time")]
    [StringLength(5)]
    public string WindowStartTime { get; set; } = "06:00";

    /// <summary>Heure de fin de la fenêtre. Défaut "22:00".</summary>
    [Column("window_end_time")]
    [StringLength(5)]
    public string WindowEndTime { get; set; } = "22:00";

    /// <summary>
    /// Jours autorisés (1=Lundi … 7=Dimanche), concaténés sans séparateur.
    /// Défaut "1234567" = tous les jours. Exemple "12345" = semaine ouvrée seule.
    /// </summary>
    [Column("allowed_days")]
    [StringLength(7)]
    public string AllowedDays { get; set; } = "1234567";

    [Column("updated_at", TypeName = "timestamp without time zone")]
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    [Column("updated_by")]
    [StringLength(20)]
    public string? UpdatedBy { get; set; }

    /// <summary>
    /// Renvoie <c>true</c> si l'instant <paramref name="now"/> tombe dans la fenêtre
    /// autorisée pour la capture GPS. Tolère les fenêtres qui passent minuit
    /// (ex. 22:00 → 06:00) en testant les deux moitiés.
    /// </summary>
    public bool IsWithinWindow(DateTime now)
    {
        if (!TryParseTime(WindowStartTime, out var start)) return true;  // config corrompue → fallback permissif
        if (!TryParseTime(WindowEndTime, out var end)) return true;

        // Jour de la semaine ISO (1=Mon … 7=Sun)
        var iso = (int)now.DayOfWeek;
        iso = iso == 0 ? 7 : iso;
        if (!string.IsNullOrEmpty(AllowedDays) && !AllowedDays.Contains(iso.ToString(), StringComparison.Ordinal))
            return false;

        var t = now.TimeOfDay;
        // Fenêtre normale (start <= end)
        if (start <= end) return t >= start && t <= end;
        // Fenêtre traversant minuit (start > end) — ex. 22:00 → 06:00
        return t >= start || t <= end;
    }

    private static bool TryParseTime(string s, out TimeSpan result)
    {
        result = TimeSpan.Zero;
        if (string.IsNullOrWhiteSpace(s)) return false;
        var parts = s.Split(':');
        if (parts.Length != 2) return false;
        if (!int.TryParse(parts[0], out var h) || h is < 0 or > 23) return false;
        if (!int.TryParse(parts[1], out var m) || m is < 0 or > 59) return false;
        result = new TimeSpan(h, m, 0);
        return true;
    }
}
