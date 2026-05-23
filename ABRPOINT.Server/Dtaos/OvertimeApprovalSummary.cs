namespace ABRPOINT.Server.Dtaos;

/// <summary>
/// Agrège l'état des demandes d'heures supplémentaires (table <c>autoriser</c>
/// avec marker <c>[HEURES SUP]</c>) pour un jour donné.
///
/// Utilisé par :
///   - <c>HeuresSupplementairesHebdomadairesService</c> : pour exposer
///     dans <c>HeuresSupplementairesResultat</c> les h.supp approuvées vs
///     refusées vs en attente d'une semaine, et basculer le total
///     <c>HreSupSemaine</c> sur les seules approuvées dès qu'au moins une
///     demande existe (cf. exigence produit 2026-05 :
///     « les h.supp ne comptent que si elles sont approuvées »).
///   - <c>PresenceRepository.GetEmpEtatPeriodiqueAsync</c> : pour signaler
///     visuellement dans l'état périodique une journée où l'employé a pointé
///     des h.supp qui ont été refusées par le manager.
/// </summary>
/// <param name="Status">Statut consolidé du jour pour l'UI :
/// "Approved" si au moins une demande approuvée (et aucune autre),
/// "Mixed" si plusieurs statuts coexistent (rare — affiche Rejected en priorité côté UI),
/// "Rejected" si au moins une demande refusée, "Pending" sinon, null si aucune demande.
/// </param>
public sealed record OvertimeApprovalSummary(
    string? Status,
    float ApprovedHours,
    float PendingHours,
    float RejectedHours,
    string? LatestComment)
{
    public static OvertimeApprovalSummary Empty { get; } = new(null, 0f, 0f, 0f, null);

    public bool HasRequests => ApprovedHours > 0 || PendingHours > 0 || RejectedHours > 0;
}
