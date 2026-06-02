using ABRPOINT.Server.Tenancy;
using Microsoft.EntityFrameworkCore;

namespace ABRPOINT.Server.Billing;

/// <summary>
/// Implémentation par défaut du garde-fou quota stockage. Lit l'utilisation
/// connue en master DB (mise à jour par <c>StorageUsageHostedService</c>) et
/// dérive le quota du <c>PlanCode</c> via <see cref="PlanCatalog.GetStorageQuotaMb"/>.
///
/// Convention : si le tenant n'existe pas en master, on échoue OPEN (snapshot
/// quota=0/used=0/wouldExceed=true) au lieu d'autoriser implicitement — un appel
/// sans tenant identifiable ne devrait pas pouvoir stocker quoi que ce soit côté
/// SaaS multi-tenant.
/// </summary>
public sealed class StorageQuotaGuard : IStorageQuotaGuard
{
    private readonly IDbContextFactory<MasterDbContext> _masterFactory;

    public StorageQuotaGuard(IDbContextFactory<MasterDbContext> masterFactory)
    {
        _masterFactory = masterFactory;
    }

    public async Task<StorageUsageSnapshot> GetSnapshotAsync(Guid tenantId, CancellationToken ct = default)
    {
        var (used, quota, checkedAt) = await LoadAsync(tenantId, ct);
        return Build(used, quota, checkedAt, wouldExceed: false);
    }

    public async Task<StorageUsageSnapshot> CheckAsync(Guid tenantId, long incomingBytes, CancellationToken ct = default)
    {
        var (used, quota, checkedAt) = await LoadAsync(tenantId, ct);
        // Conversion octets entrants → Mo (arrondi supérieur pour pénaliser tout débordement).
        var incomingMb = (incomingBytes + (1024L * 1024L - 1)) / (1024L * 1024L);
        var wouldExceed = used + incomingMb > quota;
        return Build(used, quota, checkedAt, wouldExceed);
    }

    private async Task<(long used, long quota, DateTime? checkedAt)> LoadAsync(Guid tenantId, CancellationToken ct)
    {
        await using var master = await _masterFactory.CreateDbContextAsync(ct);
        var row = await master.Tenants
            .Where(t => t.Id == tenantId)
            .Select(t => new { t.StorageUsedMb, t.StorageUsageCheckedAt, t.PlanCode, t.ExtraStorageBlocks })
            .FirstOrDefaultAsync(ct);
        if (row is null) return (0, 0, null);
        // Quota effectif = quota du pack + blocs de 100 Go achetés via le module stockage.
        var quota = PlanCatalog.GetStorageQuotaMb(row.PlanCode, row.ExtraStorageBlocks);
        return (row.StorageUsedMb, quota, row.StorageUsageCheckedAt);
    }

    private static StorageUsageSnapshot Build(long used, long quota, DateTime? checkedAt, bool wouldExceed)
    {
        var pct = quota > 0
            ? Math.Round((decimal)used / quota * 100m, 1)
            : 0m;
        return new StorageUsageSnapshot(used, quota, checkedAt, pct, wouldExceed);
    }
}
