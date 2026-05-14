using Microsoft.AspNetCore.Mvc;

namespace ABRPOINT.Server.Controllers;

/// <summary>
/// Endpoint public servant l'APK Android (et bientôt l'IPA iOS) de l'application
/// mobile Concorde Workly. La page web /download appelle ces URLs, et le domaine
/// concordeworkly.com est redirigé chez OVH vers /download.
///
/// Pourquoi un controller plutôt que de servir l'APK en static files :
///  1) Headers explicites : Content-Disposition (forçage du download), Content-Type
///     correct (application/vnd.android.package-archive) — Chrome/Edge refusent
///     parfois les APK servis avec un mauvais MIME.
///  2) Versioning : on peut renommer le fichier sur disque sans casser les liens
///     publics. Le client appelle /api/download/android, le serveur résout le
///     fichier actuel.
///  3) Analytics & rate-limit : on peut logger les downloads et appliquer des
///     limites si besoin (anti-scraping).
///
/// Stockage : wwwroot/downloads/concorde-workly.apk
/// À chaque release EAS, remplacer ce fichier sur le serveur (ou monter un
/// volume Docker dédié → cf. docker-compose.yml).
/// </summary>
[ApiController]
[Route("api/download")]
public class DownloadController : ControllerBase
{
    private readonly IWebHostEnvironment _env;
    private readonly ILogger<DownloadController> _log;

    private const string ApkFileName = "concorde-workly.apk";
    private const string ApkRelativePath = "downloads";

    public DownloadController(IWebHostEnvironment env, ILogger<DownloadController> log)
    {
        _env = env;
        _log = log;
    }

    /// <summary>
    /// Télécharge l'APK Android. Public (pas d'auth) — c'est l'app mobile que les
    /// utilisateurs viennent justement installer pour pouvoir s'authentifier.
    /// </summary>
    [HttpGet("android")]
    public IActionResult DownloadAndroidApk()
    {
        var apkPath = Path.Combine(_env.WebRootPath ?? "wwwroot", ApkRelativePath, ApkFileName);
        if (!System.IO.File.Exists(apkPath))
        {
            _log.LogWarning("APK demandé mais introuvable à {Path}", apkPath);
            // 404 propre plutôt que 500 — le déploiement n'a pas encore publié de build.
            return NotFound(new
            {
                success = false,
                message = "L'APK n'est pas encore publié. Réessayez plus tard ou contactez le support."
            });
        }

        _log.LogInformation("APK servi : {Path} ({Bytes} octets)", apkPath, new FileInfo(apkPath).Length);

        // application/vnd.android.package-archive est le MIME officiel pour les APK.
        // Sans cet en-tête, certains navigateurs (Chrome mobile) refusent le download
        // ou l'affichent comme texte.
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
        });
    }
}
