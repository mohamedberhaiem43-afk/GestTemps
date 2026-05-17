using ABRPOINT.Server.Helpers;
using ABRPOINT.Server.Tenancy;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.StaticFiles;

namespace ABRPOINT.Server.Controllers
{
    /// <summary>
    /// SEC — Sert les fichiers du dossier uploads UNIQUEMENT aux utilisateurs authentifiés.
    /// Remplace l'ancien `UseStaticFiles` posé sur /api/uploads, qui exposait publiquement
    /// bulletins de paie, contrats, coffre-fort, signatures, etc. dès que le GUID fuitait
    /// (logs, emails, captures d'écran, historique navigateur).
    ///
    /// Routage (2026-05) :
    ///   - <c>GET /api/uploads/{fileName}</c> : fichiers legacy à la racine (pré-migration
    ///     per-tenant). Conservé pour ne pas casser les URLs déjà persistées en DB.
    ///   - <c>GET /api/uploads/{slug}/{fileName}</c> : fichiers du sous-dossier tenant,
    ///     valide que <c>slug</c> correspond bien au tenant courant (cross-tenant blocked).
    /// Les nouveaux uploads (cf. <c>FileHelper.SaveFile(file, slug)</c>) écrivent
    /// systématiquement dans le sous-dossier ; les anciens restent servis tels quels.
    /// </summary>
    [ApiController]
    [Route("api/uploads")]
    [Authorize]
    public sealed class UploadsController : ControllerBase
    {
        private static readonly FileExtensionContentTypeProvider _contentTypes = new();
        private readonly ICurrentTenant _currentTenant;

        public UploadsController(ICurrentTenant currentTenant)
        {
            _currentTenant = currentTenant;
        }

        [HttpGet("{fileName}")]
        public IActionResult Get(string fileName)
        {
            if (!IsSafeFileName(fileName)) return BadRequest();
            return ServeFromRoot(FileHelper.GetUploadsPath(), fileName);
        }

        /// <summary>
        /// Sert un fichier du sous-dossier d'un tenant. Vérifie que le slug d'URL
        /// correspond au tenant résolu pour la requête courante (via JWT + middleware
        /// <c>TenantResolverMiddleware</c>) — sinon 403 même si l'utilisateur est
        /// authentifié sur un autre tenant. Empêche le cross-tenant snooping.
        /// </summary>
        [HttpGet("{slug}/{fileName}")]
        public IActionResult GetForTenant(string slug, string fileName)
        {
            if (!FileHelper.IsValidTenantSlug(slug)) return BadRequest();
            if (!IsSafeFileName(fileName)) return BadRequest();

            var currentSlug = _currentTenant.Current?.Slug;
            if (string.IsNullOrEmpty(currentSlug)
                || !string.Equals(currentSlug, slug, StringComparison.OrdinalIgnoreCase))
            {
                // Tenant courant différent du slug demandé → on refuse même si le fichier
                // existe. 404 plutôt que 403 : ne pas révéler l'existence inter-tenants.
                return NotFound();
            }

            return ServeFromRoot(FileHelper.GetTenantUploadsPath(slug), fileName);
        }

        private static bool IsSafeFileName(string fileName)
        {
            // Anti path-traversal : on refuse tout ce qui n'est pas un nom de fichier
            // pur (pas de séparateurs, pas de ".."), même si Path.GetFileName neutralise
            // déjà la plupart des cas, on durcit pour défense en profondeur.
            return !string.IsNullOrWhiteSpace(fileName)
                && !fileName.Contains('/') && !fileName.Contains('\\')
                && !fileName.Contains("..")
                && string.Equals(fileName, Path.GetFileName(fileName), StringComparison.Ordinal);
        }

        private IActionResult ServeFromRoot(string root, string fileName)
        {
            var fullPath = Path.GetFullPath(Path.Combine(root, fileName));

            // Garantit que le chemin résolu reste sous le dossier autorisé (défense en
            // profondeur en cas de fileName exotique passant les checks précédents).
            var rootFull = Path.GetFullPath(root);
            if (!fullPath.StartsWith(rootFull + Path.DirectorySeparatorChar, StringComparison.OrdinalIgnoreCase)
                && !string.Equals(fullPath, rootFull, StringComparison.OrdinalIgnoreCase))
            {
                return BadRequest();
            }

            if (!System.IO.File.Exists(fullPath))
            {
                return NotFound();
            }

            if (!_contentTypes.TryGetContentType(fileName, out var contentType))
            {
                contentType = "application/octet-stream";
            }

            // Streaming direct depuis disque — pas de MemoryStream, pas de buffering.
            var stream = new FileStream(fullPath, FileMode.Open, FileAccess.Read, FileShare.Read,
                bufferSize: 4096, options: FileOptions.Asynchronous | FileOptions.SequentialScan);
            return File(stream, contentType, enableRangeProcessing: true);
        }
    }
}
