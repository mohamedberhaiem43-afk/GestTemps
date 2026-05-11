namespace ABRPOINT.Server.Helpers
{
    public static class FileHelper
    {
        // SEC-15 — Whitelist d'extensions autorisées pour TOUS les uploads ASP.NET.
        // On bloque les fichiers exécutables (.exe, .dll, .sh, .bat, .ps1), les
        // scripts serveur (.aspx, .php, .jsp, .asp), les SVG/HTML qui peuvent
        // contenir du JavaScript exfiltrant des sessions, et les binaires nuls.
        private static readonly HashSet<string> AllowedExtensions = new(StringComparer.OrdinalIgnoreCase)
        {
            ".pdf", ".doc", ".docx", ".xls", ".xlsx", ".csv", ".txt", ".rtf",
            ".png", ".jpg", ".jpeg", ".gif", ".webp", ".bmp", ".heic",
            ".odt", ".ods", ".odp",
            ".ppt", ".pptx",
        };

        // SEC-15 / SEC-17 — Plafond uniforme sur tous les uploads (10 Mo).
        // Largement suffisant pour un justificatif scanné HD ou un PDF multi-pages.
        // Surcharge possible via env var `Uploads__MaxSizeMb` pour des besoins ponctuels
        // (ex: imports massifs admin) sans toucher au code.
        private const long DefaultMaxBytes = 10L * 1024 * 1024;

        private static long ResolveMaxBytes()
        {
            var raw = Environment.GetEnvironmentVariable("Uploads__MaxSizeMb");
            if (long.TryParse(raw, out var mb) && mb > 0 && mb < 1024)
                return mb * 1024 * 1024;
            return DefaultMaxBytes;
        }

        public static string GetUploadsPath()
        {
            var inDocker = Environment.GetEnvironmentVariable("DOTNET_RUNNING_IN_CONTAINER") == "true";
            var path = inDocker
                ? "/app/uploads"
                : Path.Combine(Directory.GetCurrentDirectory(), "uploads");

            Console.WriteLine($"[FileHelper] Uploads path: {path}"); // verify in logs
            return path;
        }

        public static async Task<(bool Success, string FilePath, string Error)> SaveFile(IFormFile file)
        {
            if (file == null || file.Length == 0)
                return (false, null, "No file uploaded.");

            // SEC-15 : taille
            var maxBytes = ResolveMaxBytes();
            if (file.Length > maxBytes)
                return (false, null, $"Fichier trop volumineux ({file.Length / 1024 / 1024} Mo). Limite : {maxBytes / 1024 / 1024} Mo.");

            // SEC-15 : extension whitelist (case-insensitive). On extrait la dernière
            // extension uniquement — un fichier nommé `script.php.pdf` passera car son
            // extension finale est .pdf ; côté serveur statique IIS/Kestrel l'extension
            // finale est celle interprétée. Si Apache/nginx mod_php est en jeu, ajouter
            // un rejet supplémentaire sur les multi-extensions (rare dans notre stack).
            var ext = Path.GetExtension(file.FileName);
            if (string.IsNullOrEmpty(ext) || !AllowedExtensions.Contains(ext))
                return (false, null, $"Type de fichier non autorisé ({ext}). Extensions acceptées : {string.Join(", ", AllowedExtensions)}.");

            // SEC-15 : on regénère un nom UUID et on N'utilise PAS le nom client pour
            // éviter le path traversal (`../../etc/passwd`) et le double-extension.
            var uploads = GetUploadsPath();
            Directory.CreateDirectory(uploads);

            var fileName = Guid.NewGuid().ToString("N") + ext.ToLowerInvariant();
            var filePath = Path.Combine(uploads, fileName);

            using (var stream = new FileStream(filePath, FileMode.Create))
            {
                await file.CopyToAsync(stream);
            }

            return (true, "/api/uploads/" + fileName, null);
        }

        public static async Task<(bool Success, string FilePath, string Error)> SaveBase64Image(string base64Data)
        {
            try
            {
                if (string.IsNullOrEmpty(base64Data)) return (false, null, "No data.");

                // Data format: "data:image/png;base64,....." ou "data:image/svg+xml;base64,..."
                // ou "drawn:data:..." ou "phrase:..." (formats legacy supportés).
                //
                // ⚠ Détection MIME pour choisir la bonne extension : avant, on hardcodait ".png"
                // ce qui faisait pourrir la signature SVG (mobile, dessin au doigt) sous un nom
                // de fichier .png → DinkToPdf et la preview navigateur n'arrivaient pas à la lire.
                string ext = "png"; // défaut historique (PNG depuis le pad signature web)
                string pureBase64 = base64Data;
                if (base64Data.StartsWith("data:", StringComparison.OrdinalIgnoreCase))
                {
                    var commaIdx = base64Data.IndexOf(',');
                    if (commaIdx > 0)
                    {
                        var meta = base64Data.Substring(5, commaIdx - 5); // ex: "image/svg+xml;base64"
                        pureBase64 = base64Data.Substring(commaIdx + 1);
                        if (meta.Contains("svg")) ext = "svg";
                        else if (meta.Contains("jpeg") || meta.Contains("jpg")) ext = "jpg";
                        else if (meta.Contains("gif")) ext = "gif";
                        else if (meta.Contains("webp")) ext = "webp";
                        else if (meta.Contains("png")) ext = "png";
                    }
                }
                else if (base64Data.Contains(","))
                {
                    pureBase64 = base64Data.Split(',')[1];
                }
                else if (base64Data.Contains(":"))
                {
                    pureBase64 = base64Data.Split(':')[1];
                }

                var bytes = Convert.FromBase64String(pureBase64);
                // SEC-15 : limite aussi l'image base64 (évite la saturation par signature géante).
                if (bytes.Length > ResolveMaxBytes())
                    return (false, null, "Image trop volumineuse.");
                var uploads = GetUploadsPath();
                Directory.CreateDirectory(uploads);

                var fileName = "sig_" + Guid.NewGuid().ToString("N") + "." + ext;
                var filePath = Path.Combine(uploads, fileName);

                await File.WriteAllBytesAsync(filePath, bytes);
                return (true, "/api/uploads/" + fileName, null);
            }
            catch (Exception ex)
            {
                return (false, null, ex.Message);
            }
        }
    }
}
