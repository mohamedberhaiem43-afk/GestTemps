using Microsoft.AspNetCore.Mvc;

namespace ABRPOINT.Server.Controllers;

/// <summary>
/// Endpoint public servant l'APK Android de l'application mobile Concorde Workly.
/// La page web /download appelle ces URLs, et le domaine concordeworkly.com est
/// redirigé chez OVH vers /download.
///
/// Deux modes de distribution selon la config :
///
///   1) URL externe (recommandé prod) — Download:ApkUrl pointe sur l'artefact
///      EAS Expo / S3 / autre CDN (par ex.
///      https://expo.dev/artifacts/eas/&lt;buildId&gt;.apk). Pas de fichier sur
///      le serveur, mises à jour = changement d'URL en config + redéploiement.
///      L'endpoint /api/download/android fait un 302 vers cette URL.
///
///   2) Fichier local (fallback dev / autonome) — si Download:ApkUrl est vide,
///      on cherche wwwroot/downloads/concorde-workly.apk et on le sert
///      directement. Pratique pour les démos hors-ligne ou les environnements
///      sans accès EAS.
///
/// Config (appsettings.json ou env var Download__ApkUrl) :
///   "Download": {
///     "ApkUrl": "https://expo.dev/artifacts/eas/abc123.apk",
///     "ApkSizeMb": 38.5,             // optionnel (UI display)
///     "ApkVersion": "1.0.0",         // optionnel (UI display)
///     "ApkPublishedAt": "2026-05-15" // optionnel (UI display)
///   }
/// </summary>
[ApiController]
[Route("api/download")]
public class DownloadController : ControllerBase
{
    private readonly IWebHostEnvironment _env;
    private readonly IConfiguration _cfg;
    private readonly ILogger<DownloadController> _log;

    private const string ApkFileName = "concorde-workly.apk";
    private const string ApkRelativePath = "downloads";

    public DownloadController(IWebHostEnvironment env, IConfiguration cfg, ILogger<DownloadController> log)
    {
        _env = env;
        _cfg = cfg;
        _log = log;
    }

    /// <summary>
    /// Télécharge l'APK Android. Public (pas d'auth) — c'est l'app mobile que les
    /// utilisateurs viennent justement installer pour pouvoir s'authentifier.
    /// </summary>
    [HttpGet("android")]
    public IActionResult DownloadAndroidApk()
    {
        var externalUrl = _cfg["Download:ApkUrl"]?.Trim();
        if (!string.IsNullOrWhiteSpace(externalUrl) && Uri.IsWellFormedUriString(externalUrl, UriKind.Absolute))
        {
            // 302 plutôt que 301 — l'URL EAS peut changer entre 2 builds, on ne
            // veut pas que les navigateurs/CDN intermédiaires la cachent comme
            // « permanente ». Préserve aussi le download anchor du navigateur.
            _log.LogInformation("APK redirigé vers URL externe {Url}", externalUrl);
            return Redirect(externalUrl);
        }

        // Fallback : fichier local servi depuis wwwroot/downloads/.
        var apkPath = Path.Combine(_env.WebRootPath ?? "wwwroot", ApkRelativePath, ApkFileName);
        if (!System.IO.File.Exists(apkPath))
        {
            _log.LogWarning("APK ni configuré (Download:ApkUrl) ni présent sur disque ({Path}).", apkPath);
            return NotFound(new
            {
                success = false,
                message = "L'APK n'est pas encore publié. Réessayez plus tard ou contactez le support."
            });
        }

        _log.LogInformation("APK servi en local : {Path} ({Bytes} octets)", apkPath, new FileInfo(apkPath).Length);
        return PhysicalFile(
            apkPath,
            "application/vnd.android.package-archive",
            ApkFileName,
            enableRangeProcessing: true);
    }

    /// <summary>
    /// Métadonnées du build courant — utilisé par la page /download pour afficher
    /// la version, la taille et la date de publication.
    /// </summary>
    [HttpGet("android/info")]
    public IActionResult GetAndroidApkInfo()
    {
        var externalUrl = _cfg["Download:ApkUrl"]?.Trim();
        if (!string.IsNullOrWhiteSpace(externalUrl) && Uri.IsWellFormedUriString(externalUrl, UriKind.Absolute))
        {
            // Mode URL externe : on renvoie les métadonnées depuis la config car
            // on ne peut pas connaître la taille/version d'un artefact distant sans
            // requêter EAS (rate-limit + dépendance externe sur un endpoint public).
            // Le frontend affiche ces valeurs telles quelles.
            return Ok(new
            {
                available = true,
                fileName = ApkFileName,
                sizeMb = double.TryParse(_cfg["Download:ApkSizeMb"], out var mb) ? mb : (double?)null,
                version = _cfg["Download:ApkVersion"],
                publishedAt = _cfg["Download:ApkPublishedAt"],
                // Le frontend fait href=downloadUrl. Pointer ici sur /api/download/android
                // garantit que le 302 (et donc l'analytics serveur) reste actif. Si on
                // pointait directement sur l'URL EAS, on perdrait le compteur de downloads.
                downloadUrl = "/api/download/android",
                source = "external",
            });
        }

        // Mode fichier local.
        var apkPath = Path.Combine(_env.WebRootPath ?? "wwwroot", ApkRelativePath, ApkFileName);
        if (!System.IO.File.Exists(apkPath))
        {
            return Ok(new
            {
                available = false,
                fileName = ApkFileName,
                message = "APK pas encore publié."
            });
        }

        var fi = new FileInfo(apkPath);
        return Ok(new
        {
            available = true,
            fileName = ApkFileName,
            sizeBytes = fi.Length,
            sizeMb = Math.Round(fi.Length / 1024.0 / 1024.0, 1),
            publishedAt = fi.LastWriteTimeUtc,
            downloadUrl = "/api/download/android",
            source = "local",
        });
    }
}
