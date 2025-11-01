using ABRPOINT.Server.Interfaces;
using FastReport.Data;
using FastReport.Export.PdfSimple;
using FastReport;

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
            _sqlConnection = new MsSqlDataConnection { ConnectionString = connStr };
        }

        private Report CreateReport(string reportFilePath)
        {
            var report = new Report();
            report.Dictionary.Connections.Add(_sqlConnection);
            report.Load(reportFilePath);
            return report;
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

        public byte[] GenerateEtatPresenceReport(string soccod, DateTime? datedebut, DateTime? datefin, string empreg)
        {
            try
            {
                var report = CreateReport("Reports/EtatPresence.frx");
                report.SetParameterValue("soccod", soccod);
                report.SetParameterValue("datedebut", datedebut);
                report.SetParameterValue("datefin", datefin);
                report.SetParameterValue("empreg", empreg);
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
            catch (Exception)
            {
                throw;
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
    }
}
