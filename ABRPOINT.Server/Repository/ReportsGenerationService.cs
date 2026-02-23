using ABRPOINT.Server.Dtaos;
using ABRPOINT.Server.Interfaces;
using FastReport;
using FastReport.Data;
using FastReport.Export.PdfSimple;
using System.Data;

namespace ABRPOINT.Server.Repository
{
    public class ReportsGenerationService : IReportsGenerationService
    {
        private readonly MsSqlDataConnection _sqlConnection;
        public ReportsGenerationService(IConfiguration config)
        {
            // 👇 Register MsSqlDataConnection before any report loading
            FastReport.Utils.RegisteredObjects.AddConnection(typeof(MsSqlDataConnection));
            var connStr = config.GetConnectionString("DefaultConnection");
            var dbHost = Environment.GetEnvironmentVariable("DB_HOST") ?? "localhost";
            var dbName = Environment.GetEnvironmentVariable("DB_NAME");
            var dbPassword = Environment.GetEnvironmentVariable("DB_PASSWORD");
            var dbUser = Environment.GetEnvironmentVariable("DB_USER") ?? "sa";


            var connectionString = $"Server={dbHost};Database={dbName};User Id={dbUser};Password={dbPassword};TrustServerCertificate=True;";
            _sqlConnection = new MsSqlDataConnection { ConnectionString = connectionString };
        }
        private Report CreateReport(string reportFilePath)
        {
            try
            {
                var report = new Report();
                report.Load(reportFilePath);

                // Remplacer la connexion sur toutes les connexions déclarées dans le .frx
                foreach (DataConnectionBase conn in report.Dictionary.Connections)
                {
                    if (conn is MsSqlDataConnection sqlConn)
                    {
                        sqlConn.ConnectionString = _sqlConnection.ConnectionString;
                        sqlConn.Enabled = true;
                    }
                }

                return report;
            }
            catch (Exception)
            {
                throw;
            }
        }
        public byte[] GenerateCahierCongeReport(string soccod, DateTime? datedebut,DateTime? datefin,List<string>empcods)
        {
            try
            {
                var report = CreateReport("Reports/CahierConge.frx");
                report.SetParameterValue("soccod", soccod);
                report.SetParameterValue("datedebut", datedebut);
                report.SetParameterValue("datefin", datefin);
                // Convert list of empcods to comma-separated string
                string empcodCsv = string.Join(",", empcods.Select(e => e.Trim()));
                report.SetParameterValue("empcod", empcodCsv);
                report.Prepare();

                using (var ms = new MemoryStream())
                {
                    report.Export(new PDFSimpleExport(), ms);
                    return ms.ToArray();
                }
            }
            catch (Exception ex)
            {
                // Optionally log here
                throw new Exception("Error generating report in repository", ex);
            }
        }


        public byte[] GenerateCongeReport(string concod)
        {
            try
            {
                var report = CreateReport("Reports/Rapport_Conge.frx");
                report.SetParameterValue("Concod", concod);
                report.Prepare();

                using (var ms = new MemoryStream())
                {
                    report.Export(new PDFSimpleExport(), ms);
                    return ms.ToArray();
                }
            }
            catch (Exception ex)
            {
                // Optionally log here
                throw new Exception("Error generating report in repository", ex);
            }
        }

        public byte[] GenerateDroitCongeReport(string soccod, DateTime? datedebut, DateTime? datefin, List<string> empcods)
        {
            var report = CreateReport("Reports/DroitConge.frx");

            report.SetParameterValue("soccod", soccod);
            report.SetParameterValue("datedebut", datedebut);
            report.SetParameterValue("datefin", datefin);

            // Convert list of empcods to comma-separated string
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
                // Set parameters first
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
            catch (Exception ex)
            {
                throw new Exception($"Error generating report: {ex.Message}", ex);
            }
        }

        public byte[] GenerateEtatPresenceReport(string soccod, DateTime? datedebut, DateTime? datefin, string empreg,List<string> empcods)
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
            catch (Exception ex)
            {
                throw new Exception("Error generating report in repository", ex);
            }
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
            catch (Exception ex)
            {
                throw new Exception("Error generating report in repository", ex);
            }
        }

        public byte[] GenerateAutorisationSortieReport(string soccod, string concod)
        {
            try
            {
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
            catch (Exception)
            {
                throw;
            }
        }
        public byte[] GenerateAbsenceReport(string soccod, string empcod,string concod)
        {
            try
            {
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
            catch (Exception ex)
            {
                throw ex;
            }
        }

        public byte[] GenerateVisiteMedicalReport(string soccod, string empcod)
        {
            try
            {
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
            catch (Exception)
            {
                throw;
            }
        }

        public byte[] GenerateContratReport(string soccod, string empcod)
        {
            try
            {
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
            catch (Exception)
            {
                throw;
            }
        }
        public byte[] GenerateEtatGlobalReport(EtatGlobalRequest data)
        {
            var report = CreateReport("Reports/EtatGlobalPresence.frx");
            report.SetParameterValue("soclib", data.soclib);
            report.SetParameterValue("datedebut", data.datedebut);
            report.SetParameterValue("datefin", data.datefin);
            report.RegisterData(data.data, "EtatGlobalData");

            var ds = report.GetDataSource("EtatGlobalData");
            if (ds == null)
                throw new Exception("EtatGlobalData introuvable");

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

                // Définir les paramètres
                report.SetParameterValue("ParamEmpcod", request.Empcod ?? "");
                report.SetParameterValue("ParamEmplib", request.Emplib ?? "");
                report.SetParameterValue("ParamDebut", request.DateDebut ?? "");
                report.SetParameterValue("ParamFin", request.DateFin ?? "");

                // Enregistrer les données (comme pour EtatGlobal)
                if (request.Rows != null && request.Rows.Any())
                {
                    report.RegisterData(request.Rows, "EtatDetaille");
                }
                else
                {
                    // Enregistrer une liste vide
                    report.RegisterData(new List<object>(), "EtatDetaille");
                }

                // Activer la DataSource
                var ds = report.GetDataSource("EtatDetaille");
                if (ds == null)
                    throw new Exception("EtatDetaille DataSource introuvable dans le rapport");

                ds.Enabled = true;

                // Préparer et exporter
                report.Prepare();

                using var ms = new MemoryStream();
                report.Export(new PDFSimpleExport(), ms);
                return ms.ToArray();
            }
            catch (Exception ex)
            {
                throw new Exception($"Erreur génération EtatDetailleReport: {ex.Message}", ex);
            }
        }

        public byte[] GetEtatAbsenceReport(EtatAbsenceReport etatAbsence)
        {
            var report = CreateReport("Reports/EtatAbsence.frx");

            // Paramètres
            report.SetParameterValue("Date", etatAbsence.Date ?? "");
            report.SetParameterValue("Soclib", etatAbsence.Soclib ?? "");
            report.SetParameterValue("ParamDebut", etatAbsence.DateFin ?? "");
            report.SetParameterValue("ParamFin", etatAbsence.DateFin ?? "");

            // IMPORTANT : liste typée
            var data = etatAbsence.Data ?? new List<EtatAbsenceData>();

            // ⚠️ Le nom doit correspondre EXACTEMENT au DataSource du .frx
            report.RegisterData(data, "EtatAbsence");

            var ds = report.GetDataSource("EtatAbsence");
            ds.Enabled = true;

            // Facultatif mais recommandé
            ds.Alias = "EtatAbsence";

            report.Prepare();

            using var ms = new MemoryStream();
            report.Export(new PDFSimpleExport(), ms);
            return ms.ToArray();
        }
    
    }
}
