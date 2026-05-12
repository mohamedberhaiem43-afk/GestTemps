using PdfSharp.Drawing;
using PdfSharp.Pdf;
using PdfSharp.Pdf.IO;
using System.Globalization;
using System.Text.RegularExpressions;

namespace ABRPOINT.Server.Helpers
{
    /// <summary>
    /// Fusionne une signature manuscrite (PNG base64) ou une mention "signé par"
    /// dans le PDF source. Le document signé est écrit sous un nouveau nom — on
    /// ne touche jamais à l'original (audit / preuve).
    ///
    /// Le tampon est ancré en bas à droite de la dernière page pour rester
    /// lisible quel que soit le contenu du PDF source.
    /// </summary>
    public static class PdfSignatureStamper
    {
        public sealed record StampOptions(
            string? SignerName,
            DateTime SignedAtUtc,
            string? CertificateId,
            string? Mention,
            string? Location);

        /// <summary>
        /// Tente d'appliquer la signature au PDF. Retourne le chemin du fichier signé
        /// ou null si le PDF n'a pas pu être ouvert/écrit (faille de format, PDF
        /// chiffré, etc.) — l'appelant retombe alors sur l'ancien comportement
        /// (signature stockée séparément).
        /// </summary>
        public static string? Stamp(string sourcePdfPath, string? signatureBase64, StampOptions options)
        {
            if (!File.Exists(sourcePdfPath)) return null;
            if (!string.Equals(Path.GetExtension(sourcePdfPath), ".pdf", StringComparison.OrdinalIgnoreCase))
                return null;

            try
            {
                using var input = new FileStream(sourcePdfPath, FileMode.Open, FileAccess.Read);
                // PdfSharp peut échouer sur des PDF récents (1.7+, formulaires XFA, encryption).
                // En mode Modify il essaie de réécrire la structure ; si l'import échoue on
                // remonte l'exception et l'appelant retombe sur le comportement legacy.
                using var pdf = PdfReader.Open(input, PdfDocumentOpenMode.Modify);
                if (pdf.PageCount == 0) return null;

                var lastPage = pdf.Pages[pdf.PageCount - 1];
                using var gfx = XGraphics.FromPdfPage(lastPage, XGraphicsPdfPageOptions.Append);

                // Boîte signature : 70 mm × 35 mm en bas à droite, marge 12 mm.
                const double mm = 72 / 25.4; // 1mm en points PDF (72 dpi)
                double boxW = 70 * mm;
                double boxH = 35 * mm;
                double margin = 12 * mm;
                double x = lastPage.Width.Point - boxW - margin;
                double y = lastPage.Height.Point - boxH - margin;

                // Cadre discret pour matérialiser la zone signée.
                var framePen = new XPen(XColor.FromArgb(180, 30, 60, 120), 0.75);
                gfx.DrawRectangle(framePen, x, y, boxW, boxH);

                // En-tête du cadre.
                var headerFont = new XFont("Helvetica", 7.5, XFontStyleEx.Bold);
                gfx.DrawString("SIGNATURE ÉLECTRONIQUE", headerFont,
                    new XSolidBrush(XColor.FromArgb(30, 60, 120)),
                    new XRect(x + 4, y + 2, boxW - 8, 10), XStringFormats.TopLeft);

                // Image (signature manuscrite) ou phrase typée.
                var imagePngBytes = ExtractPngBytes(signatureBase64);
                if (imagePngBytes != null)
                {
                    using var imgStream = new MemoryStream(imagePngBytes);
                    using var img = XImage.FromStream(imgStream);
                    // Zone signature dans le cadre (réserve 12pt pour le header + 28pt pour
                    // les méta-données en bas).
                    double sigBoxX = x + 4;
                    double sigBoxY = y + 12;
                    double sigBoxW = boxW - 8;
                    double sigBoxH = boxH - 12 - 30;
                    // Maintien du ratio image
                    double ratio = (double)img.PixelWidth / img.PixelHeight;
                    double drawW = sigBoxW;
                    double drawH = drawW / ratio;
                    if (drawH > sigBoxH) { drawH = sigBoxH; drawW = drawH * ratio; }
                    double drawX = sigBoxX + (sigBoxW - drawW) / 2;
                    double drawY = sigBoxY + (sigBoxH - drawH) / 2;
                    gfx.DrawImage(img, drawX, drawY, drawW, drawH);
                }
                else if (!string.IsNullOrWhiteSpace(options.Mention))
                {
                    var phraseFont = new XFont("Helvetica", 11, XFontStyleEx.Italic);
                    gfx.DrawString("« " + options.Mention.Trim() + " »", phraseFont,
                        XBrushes.Black,
                        new XRect(x + 6, y + 14, boxW - 12, boxH - 44),
                        XStringFormats.Center);
                }

                // Méta-données en pied du cadre (3 lignes).
                var metaFont = new XFont("Helvetica", 6.8, XFontStyleEx.Regular);
                var metaBrush = new XSolidBrush(XColor.FromArgb(60, 60, 60));
                double metaY = y + boxH - 28;
                if (!string.IsNullOrWhiteSpace(options.SignerName))
                    gfx.DrawString("Signataire : " + options.SignerName, metaFont, metaBrush,
                        new XRect(x + 4, metaY, boxW - 8, 9), XStringFormats.TopLeft);
                metaY += 9;
                gfx.DrawString("Date : " + options.SignedAtUtc.ToString("dd/MM/yyyy HH:mm 'UTC'", CultureInfo.InvariantCulture),
                    metaFont, metaBrush,
                    new XRect(x + 4, metaY, boxW - 8, 9), XStringFormats.TopLeft);
                metaY += 9;
                if (!string.IsNullOrWhiteSpace(options.CertificateId))
                    gfx.DrawString("Réf : " + options.CertificateId, metaFont, metaBrush,
                        new XRect(x + 4, metaY, boxW - 8, 9), XStringFormats.TopLeft);

                // On écrit sous "signed_<nom_original>.pdf" : l'original reste intact
                // (preuve d'audit) tant que l'appelant ne pointe pas dessus.
                var dir = Path.GetDirectoryName(sourcePdfPath)!;
                var name = Path.GetFileNameWithoutExtension(sourcePdfPath);
                var signedPath = Path.Combine(dir, "signed_" + name + ".pdf");
                pdf.Save(signedPath);
                return signedPath;
            }
            catch
            {
                // PDF non modifiable (XFA, encryption, format inconnu). On rend la main
                // à l'appelant pour qu'il conserve le fichier original + la signature
                // stockée séparément.
                return null;
            }
        }

        /// <summary>
        /// Extrait les bytes PNG/JPG d'une chaîne `data:image/png;base64,...` ou
        /// d'un préfixe `drawn:data:...`. Retourne null si le format n'est pas
        /// raster (SVG par exemple, non supporté par PdfSharp).
        /// </summary>
        private static byte[]? ExtractPngBytes(string? signatureData)
        {
            if (string.IsNullOrWhiteSpace(signatureData)) return null;

            // Préfixe legacy "drawn:" hérité du flux web/mobile.
            if (signatureData.StartsWith("drawn:", StringComparison.OrdinalIgnoreCase))
                signatureData = signatureData.Substring("drawn:".Length);

            // Une mention typée ("phrase:...") n'est pas une image.
            if (signatureData.StartsWith("phrase:", StringComparison.OrdinalIgnoreCase))
                return null;

            // PdfSharp n'embarque pas de moteur SVG → on saute si c'est du SVG.
            if (signatureData.Contains("svg+xml", StringComparison.OrdinalIgnoreCase))
                return null;

            var commaIdx = signatureData.IndexOf(',');
            var pure = commaIdx >= 0 ? signatureData.Substring(commaIdx + 1) : signatureData;

            try { return Convert.FromBase64String(pure); }
            catch { return null; }
        }
    }
}
