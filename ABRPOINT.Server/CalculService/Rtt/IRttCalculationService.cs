namespace ABRPOINT.Server.CalculService.Rtt;

public interface IRttCalculationService
{
    /// <summary>Récupère le solde RTT courant d'un employé. Recalcule si nécessaire.</summary>
    Task<RttSoldeDto> GetRttSoldeAsync(string soccod, string empcod);

    /// <summary>Recalcule le droit annuel pour un employé selon sa méthode RTT
    /// configurée. Synchronise <c>solde.rtt_jours</c> avec la valeur calculée.</summary>
    Task<RttSoldeDto> RecalculateRttForEmployeeAsync(string soccod, string empcod, int year);

    /// <summary>Incrémente <c>solde.rtt_utilises</c> de <paramref name="jours"/>.
    /// Utilisé par le flux d'acceptation d'une demande de congé Abscng='R'.</summary>
    Task IncrementUsedAsync(string soccod, string empcod, int year, float jours);

    /// <summary>Clôture annuelle : pour tous les employés d'un tenant, recalcule
    /// les droits pour l'année <paramref name="targetYear"/> et remet <c>rtt_utilises</c>
    /// à 0. Les jours non consommés de l'année précédente sont perdus (loi française).</summary>
    Task<int> ResetEndOfYearAsync(string soccod, int targetYear);
}
