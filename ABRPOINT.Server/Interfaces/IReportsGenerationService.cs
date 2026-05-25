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
        // Overload 2026-05 — quand on régénère le PDF d'un document VAULT déjà signé,
        // on peut passer le chemin de signature directement plutôt que de relire le
        // « dernier doc signé » de l'employé (qui peut pointer sur un AUTRE document
        // signé après celui-ci). Plus déterministe + corrige le cas où la requête
        // SELECT signaturepath FROM documentvault renvoie un chemin /api/uploads/...
        // mal résolu côté disque (cf. bug 2026-05 Signature_Collaborateur en texte brut).
        byte[] GenerateFromHtml(string html, string soccod, string empcod, string? signaturePath);
        byte[] GenerateAllaitementReport(string soccod, string empcod, string concod);
        byte[] GenerateEtatGlobalReport(EtatGlobalRequest data);
        byte[] GenerateEtatDetailleReport(EtatDetailleRequest request);
        byte[] GetEtatAbsenceReport(EtatAbsenceReport etatAbsence);
    }
}
