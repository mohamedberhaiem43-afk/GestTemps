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

        var options = new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseSqlServer(connStr, sql => sql.EnableRetryOnFailure())
            .Options;

        return new ApplicationDbContext(options);
    }
}
