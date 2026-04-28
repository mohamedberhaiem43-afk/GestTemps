namespace ABRPOINT.Server.Services;

/// <summary>
/// Valide qu'un pointage GPS est dans une zone autorisée. Configuré via appsettings.json.
/// Format dans config :
///   "GeoZones": {
///     "Mode": "off" | "warn" | "reject",
///     "Zones": [
///       { "Soccod": "01", "Sitcod": "01", "Lat": 48.8566, "Lon": 2.3522, "RadiusMeters": 200 },
///       { "Soccod": "01", "Lat": 43.6043, "Lon": 1.4437, "RadiusMeters": 150 }
///     ]
///   }
///
/// "off"    : aucune validation (par défaut).
/// "warn"   : log un warning si hors zone, mais accepte le pointage.
/// "reject" : refuse le pointage avec un 422.
///
/// Si lat/lon non fournis par le client mobile, on traite comme "warn" même en mode reject
/// (compat avec utilisateurs qui n'ont pas autorisé le GPS).
/// </summary>
public interface IGeoZoneValidator
{
    GeoValidationResult Validate(string? soccod, double lat, double lon);
    string Mode { get; }
}

public sealed record GeoValidationResult(bool InsideAnyZone, double? NearestDistanceMeters, string? NearestSitcod);

public sealed class GeoZoneValidator : IGeoZoneValidator
{
    public string Mode { get; }
    private readonly List<GeoZoneEntry> _zones;

    public GeoZoneValidator(IConfiguration cfg)
    {
        Mode = (cfg["GeoZones:Mode"] ?? "off").ToLowerInvariant();
        _zones = cfg.GetSection("GeoZones:Zones").Get<List<GeoZoneEntry>>() ?? new();
    }

    public GeoValidationResult Validate(string? soccod, double lat, double lon)
    {
        if (_zones.Count == 0) return new GeoValidationResult(true, null, null);

        var candidates = string.IsNullOrEmpty(soccod)
            ? _zones
            : _zones.Where(z => string.IsNullOrEmpty(z.Soccod) || string.Equals(z.Soccod, soccod, StringComparison.OrdinalIgnoreCase)).ToList();

        if (candidates.Count == 0) return new GeoValidationResult(true, null, null);

        double? nearest = null;
        string? nearestSit = null;
        bool inside = false;
        foreach (var z in candidates)
        {
            var d = HaversineMeters(lat, lon, z.Lat, z.Lon);
            if (nearest is null || d < nearest) { nearest = d; nearestSit = z.Sitcod; }
            if (d <= z.RadiusMeters) { inside = true; break; }
        }
        return new GeoValidationResult(inside, nearest, nearestSit);
    }

    private static double HaversineMeters(double lat1, double lon1, double lat2, double lon2)
    {
        const double R = 6371000.0;
        var dLat = ToRad(lat2 - lat1);
        var dLon = ToRad(lon2 - lon1);
        var a = Math.Sin(dLat / 2) * Math.Sin(dLat / 2)
              + Math.Cos(ToRad(lat1)) * Math.Cos(ToRad(lat2))
              * Math.Sin(dLon / 2) * Math.Sin(dLon / 2);
        var c = 2 * Math.Atan2(Math.Sqrt(a), Math.Sqrt(1 - a));
        return R * c;
    }

    private static double ToRad(double deg) => deg * Math.PI / 180.0;

    private sealed class GeoZoneEntry
    {
        public string? Soccod { get; set; }
        public string? Sitcod { get; set; }
        public double Lat { get; set; }
        public double Lon { get; set; }
        public double RadiusMeters { get; set; } = 200;
    }
}
