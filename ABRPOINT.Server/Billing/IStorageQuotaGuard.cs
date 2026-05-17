using ABRPOINT.Server.Tenancy;

namespace ABRPOINT.Server.Billing;

/// <summary>
/// Snapshot d'utilisation stockage pour un tenant. Sert à la fois au check
/// d'upload (CheckAsync) et à l'affichage UI (GET /api/billing/storage-usage).
/// </summary>
/// <param name="UsedMb">Stockage consommé, dernière mesure connue (Mo binaires).</param>
/// <param name="QuotaMb">Quota du plan en cours (Mo binaires).</param>
/// <param name="CheckedAt">Date du dernier passage du job de mesure ; null = jamais.</param>
/// <param name="PercentUsed">UsedMb / QuotaMb × 100, arrondi 1 décimale.</param>
/// <param name="WouldExceed">
/// True si l'opération demandée dépasserait le quota. Pour
/// <see cref="IStorageQuotaGuard.GetSnapshotAsync"/>, vaut false (pas d'opération demandée) ;
/// pour <see cref="IStorageQuotaGuard.CheckAsync"/>, reflète le résultat de l'appel.
/// </param>
public sealed record StorageUsageSnapshot(
    long UsedMb,
    long QuotaMb,
    DateTime? CheckedAt,
    decimal PercentUsed,
    bool WouldExceed);

/// <summary>
/// Garde-fou applicatif pour les quotas de stockage par tenant. Eventually-consistent :
/// la mesure de <c>UsedMb</c> est rafraîchie hourly par <c>StorageUsageHostedService</c>,
/// donc un burst d'uploads juste après une mesure peut brièvement dépasser le quota.
/// Un guard hard-realtime exigerait soit un compteur incrémenté à chaque upload (race
/// conditions à gérer), soit des tablespaces PG avec quotas filesystem.
/// </summary>
public interface IStorageQuotaGuard
{
    /// <summary>
    /// Retourne l'état courant du quota pour le tenant courant, sans appliquer
    /// d'opération. Pour affichage UI.
    /// </summary>
    Task<StorageUsageSnapshot> GetSnapshotAsync(Guid tenantId, CancellationToken ct = default);

    /// <summary>
    /// Vérifie qu'une opération d'upload de <paramref name="incomingBytes"/> octets
    /// peut avoir lieu sans dépasser le quota. <see cref="StorageUsageSnapshot.WouldExceed"/>
    /// est true si on dépasse. À appeler AVANT de persister le fichier — le caller
    /// retourne 402 / 413 / 507 selon sa convention si la garde refuse.
    /// </summary>
    Task<StorageUsageSnapshot> CheckAsync(Guid tenantId, long incomingBytes, CancellationToken ct = default);
}
