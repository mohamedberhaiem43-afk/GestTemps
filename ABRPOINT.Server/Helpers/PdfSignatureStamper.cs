using PdfSharp.Drawing;
using PdfSharp.Pdf;
using PdfSharp.Pdf.IO;
using System.Globalization;
using System.Text.RegularExpressions;
// Alias explicite : sans ça, `PdfDocument` est ambigu entre PdfSharp.Pdf.PdfDocument
// (utilisé en édition Modify) et UglyToad.PdfPig.PdfDocument (utilisé en lecture).
using PigDoc = UglyToad.PdfPig.PdfDocument;

namespace ABRPOINT.Server.Helpers
{
    /// <summary>
    /// Fusionne une signature manuscrite (PNG base64) ou une mention "signé par"
    /// dans le PDF source. Le document signé est écrit sous un nouveau nom — on
    /// ne touche jamais à l'original (audit / preuve).
    ///
    /// Deux modes :
    ///   • <see cref="StampInline"/> : remplace un placeholder textuel
    ///     (ex. <c>[Signature_Collaborateur]</c>) PAR la signature, à la position
    ///     exacte du placeholder dans le PDF. Donne un rendu "vraie intégration"
    ///     (mode Option A — Visuelle).
    ///   • <see cref="Stamp"/> : ajoute une boîte 70×35mm en bas à droite de la
    ///     dernière page (mode fallback historique, utilisé quand aucun placeholder
    ///     n'est trouvé dans le PDF).
    ///
    /// <see cref="VaultController.SignDocument"/> appelle <see cref="StampInline"/>
    /// en priorité, puis retombe sur <see cref="Stamp"/> en cas d'échec.
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
        /// Mode "inline" : cherche le placeholder texte (par défaut
        /// <c>[Signature_Collaborateur]</c>) dans le PDF, masque le texte
        /// existant par un rectangle blanc, et dessine l'image de signature
        /// à sa place — la signature apparaît DIRECTEMENT dans le contrat
        /// au lieu d'une boîte décorative en bas. Retourne le chemin du
        /// PDF signé, ou <c>null</c> si :
        ///   • Le PDF ne contient pas le placeholder
        ///   • PdfPig ou PdfSharp échouent à lire/écrire le fichier
        ///   • La signature n'est pas une image raster (mention phrase typée)
        ///
        /// L'appelant DOIT prévoir un fallback (<see cref="Stamp"/> ou stockage
        /// séparé) quand <c>null</c> est retourné.
        /// </summary>
        public static string? StampInline(string sourcePdfPath, string? signatureBase64, StampOptions options, string placeholder = "[Signature_Collaborateur]")
        {
            if (!File.Exists(sourcePdfPath)) return null;
            if (!string.Equals(Path.GetExtension(sourcePdfPath), ".pdf", StringComparison.OrdinalIgnoreCase))
                return null;

            var imagePngBytes = ExtractPngBytes(signatureBase64);
            // Sans image raster, on ne peut pas remplacer inline (la mention typée n'a
            // pas de boîte dédiée → on laisse le caller retomber sur Stamp() classique).
            if (imagePngBytes == null) return null;

            // 1️⃣ PdfPig — repère les positions du placeholder dans le document.
            // PdfPig est read-only mais expose les coordonnées exactes des mots dans
            // le système d'origine bas-gauche du PDF (PDF natif). On collecte la liste
            // des occurrences pour les traiter en une seule passe d'édition ensuite.
            var positions = new List<(int pageIndex, double left, double top, double width, double height, double pageHeight)>();
            try
            {
                using var pig = PigDoc.Open(sourcePdfPath);
                for (int p = 0; p < pig.NumberOfPages; p++)
                {
                    var page = pig.GetPage(p + 1);
                    foreach (var word in page.GetWords())
                    {
                        // Le placeholder peut être un seul "mot" tokenisé par PdfPig
                        // (typiquement quand l'export HTML→PDF DinkToPdf l'a inséré
                        // tel quel). Si la tokenisation l'a fragmenté en plusieurs
                        // mots, on rate la détection — auquel cas StampInline retourne
                        // null et le caller fallback sur Stamp() classique.
                        if (!string.Equals(word.Text.Trim(), placeholder, StringComparison.Ordinal))
                            continue;
                        var bb = word.BoundingBox;
                        positions.Add((
                            pageIndex: p,
                            left: bb.Left,
                            top: bb.Top,       // top edge en coords PDF (origine bas-gauche)
                            width: bb.Width,
                            height: bb.Height,
                            pageHeight: page.Height
                        ));
                    }
                }
            }
            catch
            {
                // PDF corrompu / chiffré / format inconnu — on laisse fallback.
                return null;
            }

            if (positions.Count == 0) return null;

            // 2️⃣ PdfSharp — édition. On ouvre en mode Modify pour append du contenu
            // graphique sur les pages existantes. La conversion de système de coords
            // se fait page par page : PdfPig (origine bas-gauche, y croît vers haut)
            // → PdfSharp (origine haut-gauche, y croît vers bas).
            try
            {
                using var input = new FileStream(sourcePdfPath, FileMode.Open, FileAccess.Read);
                using var pdf = PdfReader.Open(input, PdfDocumentOpenMode.Modify);

                using var imgStream = new MemoryStream(imagePngBytes);
                using var img = XImage.FromStream(imgStream);
                double imgRatio = (double)img.PixelWidth / img.PixelHeight;

                foreach (var pos in positions)
                {
                    if (pos.pageIndex >= pdf.PageCount) continue;
                    var page = pdf.Pages[pos.pageIndex];
                    using var gfx = XGraphics.FromPdfPage(page, XGraphicsPdfPageOptions.Append);

                    // Conversion coords : PdfPig.Top = haut du mot depuis le bas de page.
                    // PdfSharp veut y depuis le haut de page → y_sharp = pageHeight - pdfPigTop.
                    double sharpY = pos.pageHeight - pos.top;
                    double sharpX = pos.left;

                    // On élargit légèrement la zone à blanchir pour absorber un
                    // éventuel décalage de bounding box (chasse italique, padding
                    // de l'extracteur). 2pt de marge suffisent en pratique.
                    const double padding = 2;
                    gfx.DrawRectangle(XBrushes.White,
                        sharpX - padding, sharpY - padding,
                        pos.width + 2 * padding, pos.height + 2 * padding);

                    // Boîte cible pour la signature : on garde la position du
                    // placeholder en LARGEUR, et on étend la HAUTEUR vers le bas
                    // (sharpY + height) pour que la signature soit visible —
                    // un placeholder de texte fait ~12pt de haut, trop petit pour
                    // une vraie signature manuscrite. On vise ~50pt (environ 17mm).
                    const double signatureHeight = 50;
                    double drawW = pos.width;
                    double drawH = drawW / imgRatio;
                    if (drawH > signatureHeight) { drawH = signatureHeight; drawW = drawH * imgRatio; }
                    // Centre horizontalement dans la zone du placeholder, ancre
                    // verticalement sur la baseline du texte d'origine.
                    double drawX = sharpX + (pos.width - drawW) / 2;
                    double drawY = sharpY - drawH + pos.height; // bord bas aligné avec baseline placeholder

                    gfx.DrawImage(img, drawX, drawY, drawW, drawH);

                    // Petite mention "Signé électroniquement" sous la signature pour
                    // matérialiser la nature numérique (cohérence avec l'autre cellule
                    // du tableau qui affiche "Signé numériquement").
                    var captionFont = new XFont("Helvetica", 6, XFontStyleEx.Italic);
                    var captionBrush = new XSolidBrush(XColor.FromArgb(80, 80, 80));
                    gfx.DrawString("Signé électroniquement le " + options.SignedAtUtc.ToString("dd/MM/yyyy", CultureInfo.InvariantCulture),
                        captionFont, captionBrush,
                        new XRect(sharpX, drawY + drawH + 1, pos.width, 10),
                        XStringFormats.TopCenter);
                }

                var dir = Path.GetDirectoryName(sourcePdfPath)!;
                var name = Path.GetFileNameWithoutExtension(sourcePdfPath);
                var signedPath = Path.Combine(dir, "signed_" + name + ".pdf");
                pdf.Save(signedPath);
                return signedPath;
            }
            catch
            {
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
