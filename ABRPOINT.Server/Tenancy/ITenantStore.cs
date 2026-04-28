using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;

namespace ABRPOINT.Server.Tenancy;

/// <summary>
/// Lookup tenant par slug avec cache mémoire 60s pour éviter une requête master DB par requête HTTP.
/// </summary>
public interface ITenantStore
{
    Task<Tenant?> FindBySlugAsync(string slug, CancellationToken ct = default);
    void Invalidate(string slug);
}

public sealed class TenantStore : ITenantStore
{
    private readonly IDbContextFactory<MasterDbContext> _factory;
    private readonly IMemoryCache _cache;
    private static readonly TimeSpan TTL = TimeSpan.FromSeconds(60);

    public TenantStore(IDbContextFactory<MasterDbContext> factory, IMemoryCache cache)
    {
        _factory = factory;
        _cache = cache;
    }

    public async Task<Tenant?> FindBySlugAsync(string slug, CancellationToken ct = default)
    {
        slug = slug.ToLowerInvariant();
        if (_cache.TryGetValue<Tenant>(CacheKey(slug), out var cached))
            return cached;

        await using var db = await _factory.CreateDbContextAsync(ct);
        var tenant = await db.Tenants.AsNoTracking().FirstOrDefaultAsync(t => t.Slug == slug, ct);
        if (tenant is not null)
            _cache.Set(CacheKey(slug), tenant, TTL);
        return tenant;
    }

    public void Invalidate(string slug) => _cache.Remove(CacheKey(slug.ToLowerInvariant()));

    private static string CacheKey(string slug) => $"tenant:{slug}";
}
