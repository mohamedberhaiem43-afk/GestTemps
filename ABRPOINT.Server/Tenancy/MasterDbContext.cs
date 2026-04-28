using Microsoft.EntityFrameworkCore;

namespace ABRPOINT.Server.Tenancy;

/// <summary>
/// Control plane DbContext : référence des tenants, abonnements, modules.
/// Distinct de ApplicationDbContext (qui pointe vers la base d'un tenant donné).
/// </summary>
public class MasterDbContext : DbContext
{
    public MasterDbContext(DbContextOptions<MasterDbContext> options) : base(options) { }

    public DbSet<Tenant> Tenants => Set<Tenant>();
    public DbSet<TenantEmailIndex> TenantEmailIndex => Set<TenantEmailIndex>();

    protected override void OnModelCreating(ModelBuilder b)
    {
        b.Entity<Tenant>(e =>
        {
            e.HasIndex(t => t.Slug).IsUnique();
            e.HasIndex(t => t.StripeCustomerId);
        });

        b.Entity<TenantEmailIndex>(e =>
        {
            e.HasIndex(x => x.Slug);
        });
    }
}
