using ABRPOINT.Server.Data;
using Microsoft.EntityFrameworkCore;

namespace ABRPOINT.Server.Services;

/// <summary>
/// Valide qu'un pointage GPS est dans une zone autorisée.
///
/// Source des zones (ordre de priorité) :
///   1. Sites du tenant en base ayant sitlat/sitlon/sitrad renseignés (admin-définis).
///   2. Fallback : configuration appsettings "GeoZones:Zones" (compat ascendante / dev).
///
/// Mode résolu :
///   - Si la config "GeoZones:Mode" est définie, elle prime ("off"|"warn"|"reject").
///   - Sinon, dès qu'au moins un site du tenant a un geofence configuré, on bascule
///     en "reject" automatiquement — l'admin a explicitement défini des zones donc
///     c'est qu'il veut les faire respecter.
///   - Sinon "off".
///
/// Si lat/lon non fournis par le client mais qu'au moins un geofence existe pour le
/// tenant, le contrôleur (PresencesController) doit refuser le pointage avec un
/// message explicite demandant l'autorisation GPS.
/// </summary>
public interface IGeoZoneValidator
{
    /// <summary>
    /// Validation « tenant-wide » : accepte si le pointage est dans N'IMPORTE QUELLE
    /// zone de n'importe quel site du tenant. Conservé pour les flux pré-existants
    /// (badgeuse partagée, admin polyvalent, etc.).
    /// </summary>
    Task<GeoValidationResult> ValidateAsync(string? soccod, double lat, double lon);

    /// <summary>
    /// Validation STRICTE par site : exige que la position GPS soit dans la zone
    /// définie pour <paramref name="sitcod"/> spécifiquement. Si le site n'a pas
    /// de geofence configuré, renvoie « pas de zone à vérifier » (HadAnyZone=false)
    /// — l'admin a explicitement choisi de ne pas restreindre ce site.
    ///
    /// Utilisé par le pointage employé : un salarié rattaché au site A ne doit pas
    /// pouvoir pointer depuis le site B même si B a son propre geofence configuré.
    /// </summary>
    Task<GeoValidationResult> ValidateForSiteAsync(string? soccod, string? sitcod, double lat, double lon);

    Task<bool> HasGeofencesAsync(string? soccod);

    /// <summary>Vrai si le site précis a un geofence configuré (sitlat+sitlon+sitrad).</summary>
    Task<bool> HasGeofenceForSiteAsync(string? soccod, string? sitcod);

    string ConfiguredMode { get; }
}

public sealed record GeoValidationResult(
    bool InsideAnyZone,
    double? NearestDistanceMeters,
    string? NearestSitcod,
    bool HadAnyZone);

public sealed class GeoZoneValidator : IGeoZoneValidator
{
    private readonly ApplicationDbContext _db;
    private readonly IConfiguration _cfg;

    public GeoZoneValidator(ApplicationDbContext db, IConfiguration cfg)
    {
        _db = db;
        _cfg = cfg;
    }

    public string ConfiguredMode => (_cfg["GeoZones:Mode"] ?? string.Empty).ToLowerInvariant();

    public async Task<bool> HasGeofencesAsync(string? soccod)
    {
        if (string.IsNullOrEmpty(soccod)) return false;
        return await _db.Sites.AsNoTracking()
            .Where(s => s.Soccod == soccod
                        && s.Sitlat.HasValue
                        && s.Sitlon.HasValue
                        && s.Sitrad.HasValue
                        && s.Sitrad > 0)
            .AnyAsync();
    }

    public async Task<bool> HasGeofenceForSiteAsync(string? soccod, string? sitcod)
    {
        if (string.IsNullOrEmpty(soccod) || string.IsNullOrEmpty(sitcod)) return false;
        return await _db.Sites.AsNoTracking()
            .Where(s => s.Soccod == soccod
                        && s.Sitcod == sitcod
                        && s.Sitlat.HasValue
                        && s.Sitlon.HasValue
                        && s.Sitrad.HasValue
                        && s.Sitrad > 0)
            .AnyAsync();
    }

    public async Task<GeoValidationResult> ValidateForSiteAsync(string? soccod, string? sitcod, double lat, double lon)
    {
        if (string.IsNullOrEmpty(soccod) || string.IsNullOrEmpty(sitcod))
            return new GeoValidationResult(true, null, null, false);

        // On ne lit QUE la zone du site rattaché — la règle métier veut qu'un salarié
        // pointe depuis SON site, pas depuis n'importe quel site de la société. Si le
        // site n'a pas de geofence (champs null), HadAnyZone=false → le contrôleur
        // n'applique pas de refus.
        var row = await _db.Sites.AsNoTracking()
            .Where(s => s.Soccod == soccod
                        && s.Sitcod == sitcod
                        && s.Sitlat.HasValue
                        && s.Sitlon.HasValue
                        && s.Sitrad.HasValue
                        && s.Sitrad > 0)
            .Select(s => new { s.Sitcod, Lat = s.Sitlat!.Value, Lon = s.Sitlon!.Value, Rad = s.Sitrad!.Value })
            .FirstOrDefaultAsync();

        if (row == null)
            return new GeoValidationResult(true, null, null, false);

        var d = HaversineMeters(lat, lon, (double)row.Lat, (double)row.Lon);
        return new GeoValidationResult(d <= row.Rad, d, row.Sitcod, true);
    }

    public async Task<GeoValidationResult> ValidateAsync(string? soccod, double lat, double lon)
    {
        var allZones = new List<(string Sitcod, double Lat, double Lon, int Rad)>();

        if (!string.IsNullOrEmpty(soccod))
        {
            var dbRows = await _db.Sites.AsNoTracking()
                .Where(s => s.Soccod == soccod
                            && s.Sitlat.HasValue
                            && s.Sitlon.HasValue
                            && s.Sitrad.HasValue
                            && s.Sitrad > 0)
                .Select(s => new { s.Sitcod, Lat = s.Sitlat!.Value, Lon = s.Sitlon!.Value, Rad = s.Sitrad!.Value })
                .ToListAsync();
            foreach (var r in dbRows)
                allZones.Add((r.Sitcod, (double)r.Lat, (double)r.Lon, r.Rad));
        }

        var configZones = _cfg.GetSection("GeoZones:Zones").Get<List<GeoZoneEntry>>() ?? new();
        foreach (var z in configZones)
        {
            if (!string.IsNullOrEmpty(z.Soccod) && !string.Equals(z.Soccod, soccod, StringComparison.OrdinalIgnoreCase))
                continue;
            allZones.Add((z.Sitcod ?? "config", z.Lat, z.Lon, (int)z.RadiusMeters));
        }

        if (allZones.Count == 0)
            return new GeoValidationResult(true, null, null, false);

        double? nearest = null;
        string? nearestSit = null;
        bool inside = false;
        foreach (var z in allZones)
        {
            var d = HaversineMeters(lat, lon, z.Lat, z.Lon);
            if (nearest is null || d < nearest) { nearest = d; nearestSit = z.Sitcod; }
            if (d <= z.Rad) { inside = true; break; }
        }
        return new GeoValidationResult(inside, nearest, nearestSit, true);
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
