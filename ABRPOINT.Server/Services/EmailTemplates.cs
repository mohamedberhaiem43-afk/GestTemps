namespace ABRPOINT.Server.Services
{
    /// <summary>
    /// Construit l'enveloppe HTML branded « Concorde Workforce » dans laquelle on injecte
    /// le contenu spécifique de chaque email transactionnel (bienvenue, reset password,
    /// changement d'email, validation/refus de demande, etc.).
    ///
    /// Choix techniques :
    ///   • Markup &lt;table&gt; et CSS inline → rendu compatible Outlook desktop, Gmail, iOS Mail.
    ///     Les frameworks CSS modernes (flex/grid) ne fonctionnent pas dans Outlook 365.
    ///   • Logo référencé via <c>cid:concordeLogo</c> : <see cref="EmailService"/> attache le
    ///     fichier <c>Assets/Email/concorde-logo.png</c> en LinkedResource avec ce ContentId,
    ///     ce qui contourne le blocage des images externes par défaut dans la plupart des clients.
    ///   • Largeur fixe 600 px : standard email (au-delà, certains clients tronquent ou redimensionnent).
    /// </summary>
    public static class EmailTemplates
    {
        public const string LogoCid = "concordeLogo";
        public const string BrandName = "Concorde Workforce";
        public const string BrandTagline = "Gérez vos équipes. Maîtrisez votre temps.";
        private const string PrimaryColor = "#0040a1";
        private const string PrimaryColorDark = "#003080";

        /// <summary>
        /// Enveloppe le contenu HTML interne dans le shell branded.
        /// </summary>
        /// <param name="title">Titre court affiché en haut du corps (ex: « Bienvenue ! »).</param>
        /// <param name="preview">Texte de prévisualisation masqué — apparaît dans la liste des emails (Gmail, iOS).</param>
        /// <param name="innerHtml">Contenu spécifique : paragraphes, listes, boutons, etc.</param>
        public static string Wrap(string title, string preview, string innerHtml)
        {
            var safePreview = System.Net.WebUtility.HtmlEncode(preview ?? string.Empty);
            var safeTitle = System.Net.WebUtility.HtmlEncode(title ?? string.Empty);

            return $@"<!DOCTYPE html>
<html lang=""fr"">
<head>
<meta charset=""UTF-8"">
<meta name=""viewport"" content=""width=device-width, initial-scale=1.0"">
<title>{safeTitle}</title>
</head>
<body style=""margin:0;padding:0;background-color:#f1f5f9;font-family:'Helvetica Neue',Arial,sans-serif;color:#1e293b;"">

  <!-- Préheader (texte de prévisualisation invisible dans le mail) -->
  <div style=""display:none;font-size:1px;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;mso-hide:all;"">
    {safePreview}
  </div>

  <table role=""presentation"" width=""100%"" cellpadding=""0"" cellspacing=""0"" border=""0"" style=""background-color:#f1f5f9;padding:32px 12px;"">
    <tr>
      <td align=""center"">
        <table role=""presentation"" width=""600"" cellpadding=""0"" cellspacing=""0"" border=""0"" style=""max-width:600px;width:100%;background-color:#ffffff;border-radius:14px;box-shadow:0 6px 24px rgba(15,23,42,0.08);overflow:hidden;"">

          <!-- HEADER : bandeau dégradé + logo CID -->
          <tr>
            <td align=""center"" style=""background:linear-gradient(135deg,{PrimaryColor} 0%,#1a6eff 100%);padding:32px 24px 28px 24px;"">
              <img src=""cid:{LogoCid}"" alt=""{BrandName}"" width=""96"" height=""96"" style=""display:block;border:0;outline:none;text-decoration:none;width:96px;height:96px;border-radius:14px;background-color:#ffffff;padding:6px;"">
              <div style=""color:#ffffff;font-size:22px;font-weight:800;letter-spacing:0.4px;margin-top:14px;font-family:'Helvetica Neue',Arial,sans-serif;"">{BrandName}</div>
              <div style=""color:rgba(255,255,255,0.85);font-size:12px;margin-top:4px;letter-spacing:0.3px;"">{BrandTagline}</div>
            </td>
          </tr>

          <!-- TITRE -->
          <tr>
            <td style=""padding:32px 36px 8px 36px;"">
              <h1 style=""margin:0;font-size:22px;font-weight:800;color:#0d1f3c;line-height:1.3;font-family:'Helvetica Neue',Arial,sans-serif;"">{safeTitle}</h1>
            </td>
          </tr>

          <!-- CORPS : contenu spécifique -->
          <tr>
            <td style=""padding:8px 36px 28px 36px;font-size:15px;line-height:1.6;color:#334155;"">
              {innerHtml}
            </td>
          </tr>

          <!-- FOOTER -->
          <tr>
            <td style=""background-color:#f8fafc;padding:24px 36px;border-top:1px solid #e2e8f0;"">
              <p style=""margin:0;font-size:12px;color:#64748b;line-height:1.6;"">
                Vous recevez cet email parce qu'un compte est associé à cette adresse sur la plateforme {BrandName}.<br>
                Si vous n'êtes pas à l'origine de cette action, contactez votre administrateur ou répondez à ce message.
              </p>
              <p style=""margin:14px 0 0 0;font-size:11px;color:#94a3b8;letter-spacing:0.3px;"">
                © {System.DateTime.Now.Year} {BrandName} — Tous droits réservés.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>";
        }

        /// <summary>
        /// Helper : bouton CTA stylé (couleur primaire), largeur auto, compatible Outlook
        /// (utilise mso-padding pour les versions desktop).
        /// </summary>
        public static string Button(string label, string href)
        {
            var safeLabel = System.Net.WebUtility.HtmlEncode(label ?? string.Empty);
            var safeHref = System.Net.WebUtility.HtmlEncode(href ?? "#");
            return $@"<table role=""presentation"" cellpadding=""0"" cellspacing=""0"" border=""0"" style=""margin:20px 0;"">
  <tr>
    <td bgcolor=""{PrimaryColor}"" style=""border-radius:10px;"">
      <a href=""{safeHref}""
         style=""display:inline-block;padding:13px 28px;font-size:14px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:10px;font-family:'Helvetica Neue',Arial,sans-serif;letter-spacing:0.3px;"">
        {safeLabel}
      </a>
    </td>
  </tr>
</table>";
        }

        /// <summary>
        /// Helper : « carte d'info » avec liste clé/valeur (identifiants, détails de demande…).
        /// Chaque entrée du dictionnaire devient une ligne `<strong>clé</strong> : valeur`.
        /// </summary>
        public static string InfoCard(System.Collections.Generic.IDictionary<string, string> entries)
        {
            var rows = new System.Text.StringBuilder();
            foreach (var kv in entries)
            {
                rows.Append("<tr><td style=\"padding:8px 0;font-size:14px;color:#334155;\">")
                    .Append("<strong style=\"color:#0d1f3c;\">").Append(System.Net.WebUtility.HtmlEncode(kv.Key)).Append(" :</strong> ")
                    .Append(kv.Value /* déjà encodé par l'appelant */)
                    .Append("</td></tr>");
            }
            return $@"<table role=""presentation"" width=""100%"" cellpadding=""0"" cellspacing=""0"" border=""0""
       style=""background-color:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:14px 18px;margin:18px 0;"">
  {rows}
</table>";
        }

        /// <summary>
        /// Helper : bandeau coloré pour mettre en avant un statut (succès vert, alerte ambre, refus rouge).
        /// </summary>
        public static string StatusBanner(string text, StatusKind kind = StatusKind.Info)
        {
            var (bg, fg, border) = kind switch
            {
                StatusKind.Success => ("#ecfdf5", "#065f46", "#a7f3d0"),
                StatusKind.Warning => ("#fffbeb", "#92400e", "#fcd34d"),
                StatusKind.Error   => ("#fef2f2", "#991b1b", "#fecaca"),
                _                  => ("#eff6ff", "#1e40af", "#bfdbfe"),
            };
            var safeText = System.Net.WebUtility.HtmlEncode(text ?? string.Empty);
            return $@"<div style=""background-color:{bg};color:{fg};border:1px solid {border};border-radius:10px;padding:14px 18px;margin:18px 0;font-size:14px;font-weight:600;"">
  {safeText}
</div>";
        }

        public enum StatusKind { Info, Success, Warning, Error }

        /// <summary>
        /// Helper : carte « Application mobile » à inclure dans les emails de bienvenue.
        /// L'employé voit dès le 1er email qu'il peut pointer, demander congés et
        /// recevoir des notifs depuis son téléphone — pas seulement depuis le web.
        ///
        /// Deux colonnes (Android / iOS), chacune avec son QR code et son bouton de
        /// téléchargement DIRECT : le clic / scan déclenche le téléchargement sans passer
        /// par la page intermédiaire /download.
        ///   • Android → <paramref name="androidApkUrl"/> (endpoint /api/download/android qui
        ///     302-redirige vers l'APK ; télécharge directement le .apk).
        ///   • iOS → <paramref name="iosAppStoreUrl"/> (fiche App Store).
        /// Le QR est rendu en &lt;img&gt; via api.qrserver.com (même service que la page
        /// /download) : les clients mail bloquent les data: URIs (Gmail) mais chargent les
        /// images externes, et il encode exactement la même URL directe que le bouton.
        /// </summary>
        public static string MobileAppCard(string androidApkUrl, string iosAppStoreUrl)
        {
            var androidUrl = string.IsNullOrWhiteSpace(androidApkUrl) ? "#" : androidApkUrl;
            var iosUrl = string.IsNullOrWhiteSpace(iosAppStoreUrl) ? "#" : iosAppStoreUrl;

            var androidHref = System.Net.WebUtility.HtmlEncode(androidUrl);
            var iosHref = System.Net.WebUtility.HtmlEncode(iosUrl);
            var androidQr = QrImageUrl(androidUrl);
            var iosQr = QrImageUrl(iosUrl);

            return $@"<table role=""presentation"" width=""100%"" cellpadding=""0"" cellspacing=""0"" border=""0""
       style=""background:linear-gradient(135deg,#eef4ff 0%,#ffffff 100%);border:1px solid #c7d8ff;border-radius:12px;margin:22px 0;"">
  <tr>
    <td style=""padding:18px 20px 6px;"">
      <table role=""presentation"" width=""100%"" cellpadding=""0"" cellspacing=""0"" border=""0"">
        <tr>
          <td valign=""top"" width=""44"" style=""padding-right:14px;"">
            <div style=""width:42px;height:42px;border-radius:10px;background:{PrimaryColor};color:#ffffff;font-size:22px;font-weight:800;text-align:center;line-height:42px;font-family:'Helvetica Neue',Arial,sans-serif;"">📱</div>
          </td>
          <td valign=""top"" style=""font-family:'Helvetica Neue',Arial,sans-serif;"">
            <div style=""font-size:14px;font-weight:800;color:#0d1f3c;margin-bottom:2px;"">Application mobile Concorde Workly</div>
            <div style=""font-size:13px;color:#475569;line-height:1.5;"">
              Pointage, congés, notifications — tout dans votre poche.<br>
              Scannez le QR code ou cliquez pour <strong>télécharger directement</strong>.
            </div>
          </td>
        </tr>
      </table>
    </td>
  </tr>
  <tr>
    <td style=""padding:6px 12px 18px;"">
      <table role=""presentation"" width=""100%"" cellpadding=""0"" cellspacing=""0"" border=""0"">
        <tr>
          <td valign=""top"" width=""50%"" align=""center"" style=""padding:8px;font-family:'Helvetica Neue',Arial,sans-serif;"">
            <div style=""font-size:13px;font-weight:800;color:#0d1f3c;margin-bottom:8px;"">🤖 Android</div>
            <a href=""{androidHref}"" style=""text-decoration:none;"">
              <img src=""{androidQr}"" alt=""QR code — télécharger l'APK Android"" width=""132"" height=""132"" style=""display:block;margin:0 auto 10px;border:1px solid #c7d8ff;border-radius:10px;background:#ffffff;"" />
            </a>
            <a href=""{androidHref}""
               style=""display:inline-block;padding:9px 16px;font-size:12px;font-weight:700;color:#ffffff;background-color:{PrimaryColor};text-decoration:none;border-radius:8px;letter-spacing:0.2px;"">
              ⬇ Télécharger l'APK
            </a>
          </td>
          <td valign=""top"" width=""50%"" align=""center"" style=""padding:8px;font-family:'Helvetica Neue',Arial,sans-serif;"">
            <div style=""font-size:13px;font-weight:800;color:#0d1f3c;margin-bottom:8px;"">🍎 iPhone / iPad</div>
            <a href=""{iosHref}"" style=""text-decoration:none;"">
              <img src=""{iosQr}"" alt=""QR code — télécharger sur l'App Store"" width=""132"" height=""132"" style=""display:block;margin:0 auto 10px;border:1px solid #c7d8ff;border-radius:10px;background:#ffffff;"" />
            </a>
            <a href=""{iosHref}""
               style=""display:inline-block;padding:9px 16px;font-size:12px;font-weight:700;color:#ffffff;background-color:{PrimaryColor};text-decoration:none;border-radius:8px;letter-spacing:0.2px;"">
              ⬇ App Store
            </a>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>";
        }

        /// <summary>
        /// URL d'image QR code (service public api.qrserver.com, déjà utilisé par la page
        /// /download). Le paramètre <paramref name="data"/> est percent-encodé puis l'URL
        /// complète HTML-encodée (le « &amp; » entre params devient « &amp;amp; » dans
        /// l'attribut src). On évite les data: URIs, bloqués par Gmail dans les emails.
        /// </summary>
        private static string QrImageUrl(string data)
        {
            var url = $"https://api.qrserver.com/v1/create-qr-code/?size=180x180&margin=10&data={Uri.EscapeDataString(data ?? string.Empty)}";
            return System.Net.WebUtility.HtmlEncode(url);
        }
    }
}
