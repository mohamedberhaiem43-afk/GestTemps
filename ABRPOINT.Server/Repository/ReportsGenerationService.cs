using ABRPOINT.Server.Dtaos;
using ABRPOINT.Server.Interfaces;
using ABRPOINT.Server.Tenancy;
using FastReport;
using FastReport.Data;
using FastReport.Export.PdfSimple;
using System.Data;
using Dapper;
using Npgsql;
using System.Drawing;
using System.Text.RegularExpressions;
using DinkToPdf;
using DinkToPdf.Contracts;

namespace ABRPOINT.Server.Repository
{
    public class ReportsGenerationService : IReportsGenerationService
    {
        private readonly PostgresDataConnection _sqlConnection;
        private readonly string _vaultPath;
        private readonly IConverter _pdfConverter;

        public ReportsGenerationService(IConfiguration config, IWebHostEnvironment env, IConverter converter, ICurrentTenant currentTenant)
        {
            _pdfConverter = converter;
            _vaultPath = Path.Combine(env.ContentRootPath, "VaultTemplates");
            if (!Directory.Exists(_vaultPath)) Directory.CreateDirectory(_vaultPath);

            FastReport.Utils.RegisteredObjects.AddConnection(typeof(PostgresDataConnection));

            // Multi-tenant: utiliser la base du tenant courant via le template de connexion.
            // Fallback sur DefaultConnection (mono-tenant / migrations / dev sans slug).
            string connectionString;
            var tenant = currentTenant?.Current;
            var template = config.GetConnectionString("TenantTemplate");
            if (tenant != null && !string.IsNullOrWhiteSpace(template) && !string.IsNullOrWhiteSpace(tenant.DbName))
            {
                connectionString = template.Replace("{DbName}", tenant.DbName);
            }
            else
            {
                connectionString = config.GetConnectionString("FastReportConnection")
                    ?? config.GetConnectionString("DefaultConnection")
                    ?? throw new InvalidOperationException("Aucune chaÃ®ne de connexion configurÃ©e pour les rapports.");
            }
            _sqlConnection = new PostgresDataConnection { ConnectionString = connectionString };
        }

        private Report CreateReport(string reportFilePath)
        {
            var report = new Report();
            report.Load(reportFilePath);
            foreach (DataConnectionBase conn in report.Dictionary.Connections)
            {
                if (conn is PostgresDataConnection sqlConn)
                {
                    sqlConn.ConnectionString = _sqlConnection.ConnectionString;
                    sqlConn.Enabled = true;
                }
            }
            return report;
        }

        public byte[] GenerateCahierCongeReport(string soccod, DateTime? datedebut, DateTime? datefin, List<string> empcods, string justified = "", string absenceType = "")
        {
            try
            {
                var report = CreateReport("Reports/CahierConge.frx");
                report.SetParameterValue("soccod", soccod);
                report.SetParameterValue("datedebut", datedebut);
                report.SetParameterValue("datefin", datefin);
                string empcodCsv = string.Join(",", empcods.Select(e => e.Trim()));
                report.SetParameterValue("empcod", empcodCsv);
                report.SetParameterValue("justified", justified);
                report.SetParameterValue("absenceType", absenceType);
                report.Prepare();
                using (var ms = new MemoryStream())
                {
                    report.Export(new PDFSimpleExport(), ms);
                    return ms.ToArray();
                }
            }
            catch (Exception ex) { throw new Exception("Error generating report in repository", ex); }
        }

        public byte[] GenerateCongeReport(string concod)
        {
            try
            {
                using var connection = new NpgsqlConnection(_sqlConnection.ConnectionString);
                var leaveInfo = connection.QueryFirstOrDefault("SELECT soccod, empcod FROM conge WHERE concod = @concod", new { concod });
                bool isApproved = leaveInfo != null;
                if (leaveInfo == null)
                    leaveInfo = connection.QueryFirstOrDefault("SELECT soccod, empcod FROM demconge WHERE concod = @concod", new { concod });
                if (leaveInfo != null)
                {
                    string s = leaveInfo.soccod;
                    string e = leaveInfo.empcod;
                    string[] possibleTemplates = isApproved
                        ? new[] { "Titre de cong\u00e9.html", "Titre de conge.html", "TitreConge.html", "Conge.html" }
                        : new[] { "DemandeConge.html", "Demande de cong\u00e9.html", "Conge.html" };
                    foreach (var tplName in possibleTemplates)
                    {
                        var htmlPath = Path.Combine(_vaultPath, tplName);
                        if (System.IO.File.Exists(htmlPath))
                        {
                            var html = System.IO.File.ReadAllText(htmlPath);
                            return GenerateFromHtml(html, s, e);
                        }
                    }
                }
                var report = CreateReport("Reports/Rapport_Conge.frx");
                report.SetParameterValue("Concod", concod);
                report.Prepare();
                using (var ms = new MemoryStream())
                {
                    report.Export(new PDFSimpleExport(), ms);
                    return ms.ToArray();
                }
            }
            catch (Exception ex) { throw new Exception("Error generating report: " + ex.Message); }
        }

        public byte[] GenerateDroitCongeReport(string soccod, DateTime? datedebut, DateTime? datefin, List<string> empcods)
        {
            var report = CreateReport("Reports/DroitConge.frx");
            report.SetParameterValue("soccod", soccod);
            report.SetParameterValue("datedebut", datedebut);
            report.SetParameterValue("datefin", datefin);
            string empcodCsv = string.Join(",", empcods.Select(e => e.Trim()));
            report.SetParameterValue("empcod", empcodCsv);
            report.Prepare();
            using (var ms = new MemoryStream())
            {
                report.Export(new PDFSimpleExport(), ms);
                return ms.ToArray();
            }
        }

        public byte[] GenerateEtatRetardReport(string soccod, DateTime? datedebut, DateTime? datefin, string empreg, List<string> empcods)
        {
            try
            {
                var report = CreateReport("Reports/EtatRetard.frx");
                report.SetParameterValue("soccod", soccod);
                report.SetParameterValue("datedebut", datedebut);
                report.SetParameterValue("datefin", datefin);
                string empcodCsv = string.Join(",", empcods.Select(e => e.Trim()));
                report.SetParameterValue("empcod", empcodCsv);
                report.Prepare();
                using (var ms = new MemoryStream())
                {
                    report.Export(new PDFSimpleExport(), ms);
                    return ms.ToArray();
                }
            }
            catch (Exception ex) { throw new Exception($"Error generating report: {ex.Message}", ex); }
        }

        public byte[] GenerateEtatPresenceReport(string soccod, DateTime? datedebut, DateTime? datefin, string empreg, List<string> empcods)
        {
            try
            {
                var report = CreateReport("Reports/EtatPresence.frx");
                string empcodCsv = string.Join(",", empcods.Select(e => e.Trim()));
                report.SetParameterValue("soccod", soccod);
                report.SetParameterValue("datedebut", datedebut);
                report.SetParameterValue("datefin", datefin);
                report.SetParameterValue("empreg", empreg);
                report.SetParameterValue("empcods", empcodCsv);
                report.Prepare();
                using (var ms = new MemoryStream())
                {
                    report.Export(new PDFSimpleExport(), ms);
                    return ms.ToArray();
                }
            }
            catch (Exception ex) { throw new Exception("Error generating report in repository", ex); }
        }

        public byte[] GenerateEcheanceContratReport(string soccod, DateTime echdeb, DateTime echfin)
        {
            try
            {
                var report = CreateReport("Reports/EcheanceContrat.frx");
                report.SetParameterValue("soccod", soccod);
                report.SetParameterValue("datedebut", echdeb);
                report.SetParameterValue("datefin", echfin);
                report.Prepare();
                using (var ms = new MemoryStream())
                {
                    report.Export(new PDFSimpleExport(), ms);
                    return ms.ToArray();
                }
            }
            catch (Exception ex) { throw new Exception("Error generating report in repository", ex); }
        }

        public byte[] GenerateAutorisationSortieReport(string soccod, string concod)
        {
            try
            {
                using var connection = new NpgsqlConnection(_sqlConnection.ConnectionString);
                var authInfo = connection.QueryFirstOrDefault("SELECT empcod FROM autoriser WHERE concod = @concod and soccod = @soccod", new { concod, soccod });
                if (authInfo != null)
                {
                    string empcod = authInfo.empcod;
                    var htmlPath = Path.Combine(_vaultPath, "Autorisation.html");
                    if (System.IO.File.Exists(htmlPath))
                    {
                        var html = System.IO.File.ReadAllText(htmlPath);
                        return GenerateFromHtml(html, soccod, empcod);
                    }
                }
                var report = CreateReport("Reports/AutorisationSortie.frx");
                report.SetParameterValue("soccod", soccod);
                report.SetParameterValue("concod", concod);
                report.Prepare();
                using (var ms = new MemoryStream())
                {
                    report.Export(new PDFSimpleExport(), ms);
                    return ms.ToArray();
                }
            }
            catch (Exception ex) { throw new Exception("Error generating authorization report: " + ex.Message); }
        }

        public byte[] GenerateAbsenceReport(string soccod, string empcod, string concod)
        {
            try
            {
                var htmlPath = Path.Combine(_vaultPath, "Absence.html");
                if (System.IO.File.Exists(htmlPath))
                {
                    var html = System.IO.File.ReadAllText(htmlPath);
                    return GenerateFromHtml(html, soccod, empcod);
                }
                var report = CreateReport("Reports/Absence.frx");
                report.SetParameterValue("soccod", soccod);
                report.SetParameterValue("empcod", empcod);
                report.SetParameterValue("concod", concod);
                report.Prepare();
                using (var ms = new MemoryStream())
                {
                    report.Export(new PDFSimpleExport(), ms);
                    return ms.ToArray();
                }
            }
            catch (Exception ex) { throw ex; }
        }

        public byte[] GenerateVisiteMedicalReport(string soccod, string empcod)
        {
            try
            {
                var htmlPath = Path.Combine(_vaultPath, "VisiteMedicale.html");
                if (System.IO.File.Exists(htmlPath))
                {
                    var html = System.IO.File.ReadAllText(htmlPath);
                    return GenerateFromHtml(html, soccod, empcod);
                }
                var report = CreateReport("Reports/Visite_Medicale.frx");
                report.SetParameterValue("Soccod", soccod);
                report.SetParameterValue("Empcod", empcod);
                report.SetParameterValue("Day", DateTime.Now.Day);
                report.SetParameterValue("Month", DateTime.Now.Month);
                report.SetParameterValue("Year", DateTime.Now.Year);
                report.Prepare();
                using (var ms = new MemoryStream())
                {
                    report.Export(new PDFSimpleExport(), ms);
                    return ms.ToArray();
                }
            }
            catch (Exception) { throw; }
        }

        public byte[] GenerateContratReport(string soccod, string empcod)
        {
            try
            {
                var htmlPath = Path.Combine(_vaultPath, "Contrat.html");
                if (System.IO.File.Exists(htmlPath))
                {
                    var html = System.IO.File.ReadAllText(htmlPath);
                    return GenerateFromHtml(html, soccod, empcod);
                }
                var report = CreateReport("Reports/Contrat.frx");
                report.SetParameterValue("soccod", soccod);
                report.SetParameterValue("empcod", empcod);
                report.Prepare();
                using (var ms = new MemoryStream())
                {
                    report.Export(new PDFSimpleExport(), ms);
                    return ms.ToArray();
                }
            }
            catch (Exception) { throw; }
        }

        public byte[] GenerateAttestationTravailReport(string soccod, string empcod) => GenerateDynamicDoc(soccod, empcod, "AttestationDeTravail");
        public byte[] GenerateCertificatTravailReport(string soccod, string empcod) => GenerateDynamicDoc(soccod, empcod, "CertificatTravail");
        public byte[] GenerateAttestationSalaireReport(string soccod, string empcod) => GenerateDynamicDoc(soccod, empcod, "AttestationSalaire");

        private byte[] GenerateDynamicDoc(string soccod, string empcod, string docName)
        {
            try
            {
                var htmlPath = Path.Combine(_vaultPath, $"{docName}.html");
                if (System.IO.File.Exists(htmlPath))
                {
                    var html = System.IO.File.ReadAllText(htmlPath);
                    return GenerateFromHtml(html, soccod, empcod);
                }
                var frxPath = $"Reports/{docName}.frx";
                if (System.IO.File.Exists(frxPath))
                {
                    var report = CreateReport(frxPath);
                    report.SetParameterValue("soccod", soccod);
                    report.SetParameterValue("empcod", empcod);
                    report.Prepare();
                    using var ms = new MemoryStream();
                    report.Export(new PDFSimpleExport(), ms);
                    return ms.ToArray();
                }
                throw new Exception($"ModÃ¨le introuvable pour {docName} (HTML ou FRX)");
            }
            catch (Exception ex) { throw new Exception($"Erreur lors de la gÃ©nÃ©ration de {docName} : " + ex.Message, ex); }
        }

        public byte[] GenerateEtatGlobalReport(EtatGlobalRequest data)
        {
            var report = CreateReport("Reports/EtatGlobalPresence.frx");
            report.SetParameterValue("soclib", data.soclib);
            report.SetParameterValue("datedebut", data.datedebut);
            report.SetParameterValue("datefin", data.datefin);
            report.RegisterData(data.data, "EtatGlobalData");
            var ds = report.GetDataSource("EtatGlobalData");
            if (ds == null) throw new Exception("EtatGlobalData introuvable");
            ds.Enabled = true;
            report.Prepare();
            using var ms = new MemoryStream();
            report.Export(new PDFSimpleExport(), ms);
            return ms.ToArray();
        }

        public byte[] GenerateEtatDetailleReport(EtatDetailleRequest request)
        {
            try
            {
                var report = CreateReport("Reports/EtatDetaille.frx");
                report.SetParameterValue("ParamEmpcod", request.Empcod ?? "");
                report.SetParameterValue("ParamEmplib", request.Emplib ?? "");
                report.SetParameterValue("ParamDebut", request.DateDebut ?? "");
                report.SetParameterValue("ParamFin", request.DateFin ?? "");
                if (request.Rows != null && request.Rows.Any())
                    report.RegisterData(request.Rows, "EtatDetaille");
                else
                    report.RegisterData(new List<object>(), "EtatDetaille");
                var ds = report.GetDataSource("EtatDetaille");
                if (ds == null) throw new Exception("EtatDetaille DataSource introuvable dans le rapport");
                ds.Enabled = true;
                report.Prepare();
                using var ms = new MemoryStream();
                report.Export(new PDFSimpleExport(), ms);
                return ms.ToArray();
            }
            catch (Exception ex) { throw new Exception($"Erreur gÃ©nÃ©ration EtatDetailleReport: {ex.Message}", ex); }
        }

        public byte[] GetEtatAbsenceReport(EtatAbsenceReport etatAbsence)
        {
            var report = CreateReport("Reports/EtatAbsence.frx");
            report.SetParameterValue("Date", etatAbsence.Date ?? "");
            report.SetParameterValue("Soclib", etatAbsence.Soclib ?? "");
            report.SetParameterValue("ParamDebut", etatAbsence.DateFin ?? "");
            report.SetParameterValue("ParamFin", etatAbsence.DateFin ?? "");
            var data = etatAbsence.Data ?? new List<EtatAbsenceData>();
            report.RegisterData(data, "EtatAbsence");
            var ds = report.GetDataSource("EtatAbsence");
            ds.Enabled = true;
            ds.Alias = "EtatAbsence";
            report.Prepare();
            using var ms = new MemoryStream();
            report.Export(new PDFSimpleExport(), ms);
            return ms.ToArray();
        }

        public byte[] GenerateAllaitementReport(string soccod, string empcod, string concod)
        {
            try
            {
                var htmlPath = Path.Combine(_vaultPath, "Allaitement.html");
                if (System.IO.File.Exists(htmlPath))
                {
                    var html = System.IO.File.ReadAllText(htmlPath);
                    return GenerateFromHtml(html, soccod, empcod);
                }
                var report = CreateReport("Reports/Allaitement.frx");
                report.SetParameterValue("soccod", soccod);
                report.SetParameterValue("empcod", empcod);
                report.SetParameterValue("concod", concod);
                report.Prepare();
                using (var ms = new MemoryStream())
                {
                    report.Export(new PDFSimpleExport(), ms);
                    return ms.ToArray();
                }
            }
            catch (Exception ex) { throw new Exception("Error generating Allaitement report: " + ex.Message); }
        }

        // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
        //  GenerateFromHtml â€” Uses DinkToPdf (wkhtmltopdf) for proper
        //  HTML/CSS â†’ PDF rendering with tables, headers, footers, etc.
        // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
        public byte[] GenerateFromHtml(string html, string soccod, string empcod)
        {
            try
            {
                // 1. Fetch employee + company data
                //    âš  socimg ajoutÃ© (sinon ReplaceAllPlaceholders ne trouve pas le logo
                //    tÃ©lÃ©versÃ© via ParamÃ¨tres sociÃ©tÃ© â†’ [Logo_Entreprise] reste vide).
                using var connection = new NpgsqlConnection(_sqlConnection.ConnectionString);
                // ATTENTION : la table société est mappée "Societe" (PascalCase, double-quoté)
                // par ApplicationDbContext (ToTable("Societe")), mais "employe" reste en
                // minuscules. PostgreSQL fold tous les identifiants non quotés en minuscules :
                // sans les "..." autour de Societe, on touche 42P01 « relation societe does
                // not exist » → endpoint Templates/preview retournait 400 en prod.
                var emp = connection.QueryFirstOrDefault(@"
                    select e.*, s.soclib, s.socadr, s.soctel, s.socfax, s.socemail, s.socresp, s.socimg
                    from employe e
                    inner join ""Societe"" s on e.soccod = s.soccod
                    where e.empcod = @empcod and e.soccod = @soccod",
                    new { empcod, soccod });

                // 2. Replace all variable placeholders in the HTML
                string processedHtml = ReplaceAllPlaceholders(html, emp);

                // 3. Add Signature if exists
                if (!string.IsNullOrEmpty(empcod) && processedHtml.Contains("[Signature_Collaborateur]"))
                {
                    // For mockup, we could look up the latest signature for this employee in the vault
                    var lastSign = connection.QueryFirstOrDefault<string>(@"
                        SELECT signaturepath from documentvault
                        where empcod = @empcod and issigned = 1
                        order by signaturedate desc
                        LIMIT 1", new { empcod });
                    
                    if (!string.IsNullOrEmpty(lastSign))
                    {
                        var fullSigPath = Path.Combine(Directory.GetCurrentDirectory(), lastSign.TrimStart('/'));
                        if (System.IO.File.Exists(fullSigPath))
                        {
                            var sigBase64 = Convert.ToBase64String(System.IO.File.ReadAllBytes(fullSigPath));
                            processedHtml = processedHtml.Replace("[Signature_Collaborateur]", 
                                $@"<div style='text-align:right;'><img src='data:image/png;base64,{sigBase64}' style='height:80px;' /><br><small>SignÃ© Ã©lectroniquement</small></div>");
                        }
                    }
                }

                // 3. Detect Logo path for header
                string logoHtml = "";
                var logoPath = Path.Combine(Directory.GetCurrentDirectory(), "..", "abrpoint.client", "public", "Societe.jpg");
                if (System.IO.File.Exists(logoPath))
                {
                    var logoBase64 = Convert.ToBase64String(System.IO.File.ReadAllBytes(logoPath));
                    logoHtml = $@"<img src=""data:image/jpeg;base64,{logoBase64}"" style=""height:60px; float:left; margin-right:15px;"" />";
                }

                // 4. Wrap in full HTML document with proper CSS for print
                var fullHtml = $@"<!DOCTYPE html>
<html>
<head>
<meta charset='UTF-8'>
<style>
    @page {{
        size: A4;
        margin: 25mm 20mm 25mm 20mm;
    }}
    body {{
        font-family: Arial, Helvetica, sans-serif;
        font-size: 12px;
        line-height: 1.6;
        color: #1a1a1a;
        margin: 0;
        padding: 0;
    }}
    table {{
        width: 100%;
        border-collapse: collapse;
        margin: 12px 0;
    }}
    td, th {{
        border: 1px solid #ccc;
        padding: 8px 10px;
        text-align: left;
        vertical-align: top;
    }}
    th {{
        background-color: #f5f5f5;
        font-weight: bold;
    }}
    h1 {{ font-size: 18px; text-align: center; margin: 10px 0; }}
    h2 {{ font-size: 15px; margin: 10px 0; }}
    h3 {{ font-size: 13px; margin: 8px 0; }}
    p {{ margin: 4px 0; }}
    header {{
        display: block;
        margin-bottom: 20px;
        padding-bottom: 10px;
        border-bottom: 2px solid #333;
        overflow: hidden;
    }}
    footer {{
        display: block;
        margin-top: 20px;
        padding-top: 10px;
        border-top: 1px solid #ccc;
        font-size: 10px;
        color: #888;
        text-align: center;
    }}
    hr {{
        border: none;
        border-top: 1px solid #ccc;
        margin: 15px 0;
    }}
    /* Clean variable chip display */
    span[data-tag] {{
        font-weight: bold;
        background: none !important;
        border: none !important;
        padding: 0 !important;
        color: inherit !important;
    }}
</style>
</head>
<body>
    {processedHtml}
</body>
</html>";

                // 5. Convert to PDF using DinkToPdf (wkhtmltopdf)
                var doc = new HtmlToPdfDocument
                {
                    GlobalSettings = new GlobalSettings
                    {
                        ColorMode = ColorMode.Color,
                        Orientation = Orientation.Portrait,
                        PaperSize = PaperKind.A4,
                        Margins = new MarginSettings { Top = 20, Bottom = 20, Left = 15, Right = 15 },
                        DocumentTitle = "Document"
                    },
                    Objects =
                    {
                        new ObjectSettings
                        {
                            PagesCount = true,
                            HtmlContent = fullHtml,
                            WebSettings = { DefaultEncoding = "utf-8" },
                            HeaderSettings = new HeaderSettings
                            {
                                FontSize = 9,
                                Right = "Page [page] / [toPage]",
                                Line = false,
                                Spacing = 5
                            },
                            FooterSettings = new FooterSettings
                            {
                                FontSize = 8,
                                Center = "Document gÃ©nÃ©rÃ© le " + DateTime.Now.ToString("dd/MM/yyyy"),
                                Line = false,
                                Spacing = 5
                            }
                        }
                    }
                };

                return _pdfConverter.Convert(doc);
            }
            catch (Exception ex)
            {
                throw new Exception("Erreur lors de la gÃ©nÃ©ration du PDF : " + ex.Message, ex);
            }
        }

        private string ReplaceAllPlaceholders(string html, dynamic emp)
        {
            string processedHtml = html;

            // Signature placeholders
            processedHtml = processedHtml.Replace("{{Signature_Employe}}", "[Signature_Collaborateur]")
                                         .Replace("[Signature.Employe]", "[Signature_Collaborateur]");
            
            // Signature SociÃ©tÃ© : on ne hardcode plus de nom (placeholder
            // historique "Sarah Jenkins") â€” on laisse "ReprÃ©sentant lÃ©gal"
            // qui sera complÃ©tÃ© par la signature manuscrite rÃ©elle persistÃ©e
            // cÃ´tÃ© coffre-fort.
            const string signatureEntreprise =
                "<br><br><b>Pour la SociÃ©tÃ© :</b><br><div style='color:#0040a1; font-weight:bold;'>ReprÃ©sentant lÃ©gal</div><small>SignÃ© numÃ©riquement</small><br>";
            processedHtml = processedHtml.Replace("{{Signature_Entreprise}}", signatureEntreprise)
                                         .Replace("[Signature.Entreprise]", signatureEntreprise);

            // Database field replacements
            if (emp != null)
            {
                var dict = (IDictionary<string, object>)emp;
                foreach (var kvp in dict)
                {
                    var val = kvp.Value?.ToString() ?? "";
                    if (kvp.Value is DateTime dt)
                        val = dt.ToString("dd/MM/yyyy");
                    processedHtml = processedHtml.Replace($"[Table.{kvp.Key}]", val);
                }
            }
            
            // ... (rest of the code omitted for brevity but I'll include the necessary parts)
            var today = DateTime.Now.ToString("dd/MM/yyyy");
            processedHtml = processedHtml.Replace("[Date_Actuelle]", today)
                                         .Replace("[Date_du_jour]", today)
                                         .Replace("[Date]", today);

            var ville = emp != null ? (emp.socadr ?? "") : "";
            if (!string.IsNullOrEmpty(ville)) processedHtml = processedHtml.Replace("[Ville]", ville.Split(',')[0].Trim());

            processedHtml = processedHtml.Replace("[Nombre_de_jours]", "...")
                                         .Replace("[Date_debut_conge]", "...")
                                         .Replace("[Date_fin_conge]", "...")
                                         .Replace("[Periode_de_reference]", "...")
                                         .Replace("[Nombre_jours_delai_reponse]", "15");

            // Remplacement du placeholder Logo par le logo rÃ©el de la sociÃ©tÃ© tenant.
            //
            // PrioritÃ© de rÃ©solution :
            //   1. emp.socimg si renseignÃ© (chemin relatif type "/api/uploads/<uuid>.png"
            //      saisi via le formulaire Â« ParamÃ¨tres sociÃ©tÃ© Â» â†’ rÃ©solu sur le volume
            //      uploads/ du serveur, base64'isÃ© inline pour DinkToPdf).
            //   2. Aucun logo â†’ on retire silencieusement le placeholder pour ne pas
            //      laisser de "[Logo_Entreprise]" en clair dans le PDF.
            //
            // Avant ce correctif, le code pointait sur un chemin hardcodÃ©
            // `abrpoint.client/public/Societe.jpg` (relatif au cwd dev) â€” absent en
            // container Docker â‡’ aucun logo n'apparaissait jamais sur les templates,
            // peu importe ce que l'admin avait tÃ©lÃ©versÃ©.
            if (processedHtml.Contains("[Logo_Entreprise]"))
            {
                string? logoDataUri = null;
                try
                {
                    string? socimg = null;
                    if (emp != null)
                    {
                        var dict = (IDictionary<string, object>)emp;
                        if (dict.TryGetValue("socimg", out var v) && v != null)
                            socimg = v.ToString();
                    }
                    if (!string.IsNullOrWhiteSpace(socimg))
                    {
                        // Cas 1 : dÃ©jÃ  une data URI inline (rare mais possible si saisi Ã  la main)
                        if (socimg.StartsWith("data:", StringComparison.OrdinalIgnoreCase))
                        {
                            logoDataUri = socimg;
                        }
                        else
                        {
                            // Cas 2 : chemin relatif "/api/uploads/<uuid>.ext" â€” on retombe sur
                            // le dossier rÃ©el (FileHelper.GetUploadsPath() gÃ¨re Docker vs dev).
                            var fileName = socimg.Replace("/api/uploads/", "", StringComparison.OrdinalIgnoreCase)
                                                 .Replace("/uploads/", "", StringComparison.OrdinalIgnoreCase)
                                                 .TrimStart('/');
                            // Sanitize : on n'autorise que le nom de fichier (pas de path traversal).
                            fileName = Path.GetFileName(fileName);
                            if (!string.IsNullOrEmpty(fileName))
                            {
                                var diskPath = Path.Combine(Helpers.FileHelper.GetUploadsPath(), fileName);
                                if (System.IO.File.Exists(diskPath))
                                {
                                    var ext = Path.GetExtension(fileName).TrimStart('.').ToLowerInvariant();
                                    var mime = ext switch
                                    {
                                        "jpg" or "jpeg" => "image/jpeg",
                                        "png" => "image/png",
                                        "gif" => "image/gif",
                                        "webp" => "image/webp",
                                        "svg" => "image/svg+xml",
                                        _ => "application/octet-stream",
                                    };
                                    var bytes = System.IO.File.ReadAllBytes(diskPath);
                                    logoDataUri = $"data:{mime};base64,{Convert.ToBase64String(bytes)}";
                                }
                            }
                        }
                    }
                }
                catch
                {
                    // Lecture du logo best-effort â€” on retombe sur "pas de logo" en cas
                    // d'erreur disque pour ne pas faire Ã©chouer la gÃ©nÃ©ration PDF.
                    logoDataUri = null;
                }

                if (!string.IsNullOrEmpty(logoDataUri))
                {
                    processedHtml = processedHtml.Replace("[Logo_Entreprise]",
                        $@"<img src=""{logoDataUri}"" style=""height:60px; float:left; margin-right:15px;"" />");
                }
                else
                {
                    processedHtml = processedHtml.Replace("[Logo_Entreprise]", "");
                }
            }

            return processedHtml;
        }
    }
}