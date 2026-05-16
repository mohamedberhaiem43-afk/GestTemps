using System.Collections.Concurrent;
using ABRPOINT.Server.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;

namespace ABRPOINT.Server.Tenancy;

/// <summary>
/// Crée un ApplicationDbContext pointant vers la base du tenant courant.
/// Utiliser à la place de l'injection directe d'ApplicationDbContext dans les controllers SaaS.
/// </summary>
public interface ITenantDbContextFactory
{
    /// <summary>
    /// Renvoie un DbContext déjà connecté à la base du tenant courant.
    /// Le caller est responsable du Dispose (préférer `await using`).
    /// </summary>
    ApplicationDbContext Create();
}

public sealed class TenantDbContextFactory : ITenantDbContextFactory
{
    private readonly ICurrentTenant _current;
    private readonly IConfiguration _cfg;

    // PERF — Cache statique des DbContextOptions par connection string. Sans ça,
    // chaque Create() reconstruisait l'OptionsBuilder complet (parse de la connection
    // string, configuration UseNpgsql, callbacks de retry) — coût mesurable quand
    // KnownDeviceService ou les hosted services appellent Create() en boucle.
    private static readonly ConcurrentDictionary<string, DbContextOptions<ApplicationDbContext>> _optionsCache
        = new(StringComparer.Ordinal);

    public TenantDbContextFactory(ICurrentTenant current, IConfiguration cfg)
    {
        _current = current;
        _cfg = cfg;
    }

    public ApplicationDbContext Create()
    {
        var t = _current.Current
            ?? throw new InvalidOperationException(
                "Aucun tenant en scope. Le middleware TenantResolver n'a pas trouvé de tenant pour cette requête, " +
                "ou ce service est appelé en dehors d'une requête HTTP avec tenant.");

        var template = _cfg.GetConnectionString("TenantTemplate")
            ?? throw new InvalidOperationException("ConnectionStrings:TenantTemplate manquant dans appsettings.");

        // Le template contient un placeholder {DbName} qu'on substitue par le DbName du tenant.
        var connStr = template.Replace("{DbName}", t.DbName);

        var options = _optionsCache.GetOrAdd(connStr, cs =>
            new DbContextOptionsBuilder<ApplicationDbContext>()
                .UseNpgsql(cs, npg => npg.EnableRetryOnFailure())
                .Options);

        return new ApplicationDbContext(options);
    }
}
