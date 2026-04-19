using ABRPOINT.Server.Dtaos;

namespace ABRPOINT.Server.Interfaces
{
    public interface IReportsGenerationService
    {
        byte[] GenerateCongeReport(string concod);
        byte[] GenerateCahierCongeReport(string soccod,DateTime? datedebut,DateTime? datefin,List<string>empcods, string justified = "", string absenceType = "");
        byte[] GenerateDroitCongeReport(string soccod, DateTime? datedebut,DateTime? datefin, List<string> empcods);
        byte[] GenerateEtatRetardReport(string soccod, DateTime? datedebut,DateTime? datefin, string empreg,List<string> empcods);
        byte[] GenerateEtatPresenceReport(string soccod, DateTime? datedebut,DateTime? datefin, string empreg,List<string> empcods);
        byte[] GenerateEcheanceContratReport(string soccod, DateTime echdeb, DateTime echfin);
        byte[] GenerateAutorisationSortieReport(string soccod, string concod);
        byte[] GenerateAbsenceReport(string soccod,string empcod, string concod);
        byte[] GenerateVisiteMedicalReport(string soccod, string empcod);
        byte[] GenerateContratReport(string soccod, string empcod);
        byte[] GenerateAttestationTravailReport(string soccod, string empcod);
        byte[] GenerateCertificatTravailReport(string soccod, string empcod);
        byte[] GenerateAttestationSalaireReport(string soccod, string empcod);
        byte[] GenerateFromHtml(string html, string soccod, string empcod);
        byte[] GenerateAllaitementReport(string soccod, string empcod, string concod);
        byte[] GenerateEtatGlobalReport(EtatGlobalRequest data);
        byte[] GenerateEtatDetailleReport(EtatDetailleRequest request);
        byte[] GetEtatAbsenceReport(EtatAbsenceReport etatAbsence);
    }
}
