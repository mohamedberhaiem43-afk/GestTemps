using ABRPOINT.Server.Helpers;
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
    /// Limitation connue (à corriger par migration ops) : tous les tenants partagent le
    /// même dossier physique. Un user authentifié sur le tenant A peut, en théorie, lire
    /// un fichier du tenant B s'il devine le GUID (espace 2^128 — pratiquement impossible
    /// sans fuite externe, mais théoriquement possible). Étape suivante :
    ///   1. `FileHelper.SaveFile(file, tenantSlug)` écrit dans `uploads/&lt;slug&gt;/&lt;guid&gt;.ext`.
    ///   2. URL devient `/api/uploads/&lt;slug&gt;/&lt;guid&gt;.ext`.
    ///   3. Cet endpoint accepte les deux formats et, sur le format /&lt;slug&gt;/&lt;file&gt;,
    ///      vérifie que `slug == User.FindFirst("tenant_slug").Value`.
    ///   4. Migration ops : déplacer les fichiers existants vers les sous-dossiers du
    ///      tenant qui les a créés (nécessite traçabilité par fichier — DocumentVault
    ///      stocke déjà `Soccod`, signatures stockées dans Empsigemp avec lien employé).
    /// </summary>
    [ApiController]
    [Route("api/uploads")]
    [Authorize]
    public sealed class UploadsController : ControllerBase
    {
        private static readonly FileExtensionContentTypeProvider _contentTypes = new();

        [HttpGet("{fileName}")]
        public IActionResult Get(string fileName)
        {
            // Anti path-traversal : on refuse tout ce qui n'est pas un nom de fichier
            // pur (pas de séparateurs, pas de ".."), même si Path.GetFileName neutralise
            // déjà la plupart des cas, on durcit pour défense en profondeur.
            if (string.IsNullOrWhiteSpace(fileName)
                || fileName.Contains('/') || fileName.Contains('\\')
                || fileName.Contains("..")
                || !string.Equals(fileName, Path.GetFileName(fileName), StringComparison.Ordinal))
            {
                return BadRequest();
            }

            var root = FileHelper.GetUploadsPath();
            var fullPath = Path.GetFullPath(Path.Combine(root, fileName));

            // Garantit que le chemin résolu reste sous le dossier uploads (défense en
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
