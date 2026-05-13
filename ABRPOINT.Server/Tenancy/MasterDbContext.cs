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
    public DbSet<StripeWebhookSeen> StripeWebhookSeen => Set<StripeWebhookSeen>();

    protected override void OnModelCreating(ModelBuilder b)
    {
        b.Entity<Tenant>(e =>
        {
            e.HasIndex(t => t.Slug).IsUnique();
            e.HasIndex(t => t.StripeCustomerId);
            // Index non-unique sur Siret : on s'appuie sur un index unique filtré côté
            // SQL Server (cf. Program.cs startup) pour autoriser plusieurs lignes Failed
            // / Cancelled-hors-rétention avec le même SIRET, tout en garantissant un seul
            // tenant actif par SIRET. EF Core ne sait pas modéliser de filtre conditionnel
            // ici proprement, on garde donc l'index simple côté modèle pour les lookups.
            e.HasIndex(t => t.Siret);
        });

        b.Entity<TenantEmailIndex>(e =>
        {
            e.HasIndex(x => x.Slug);
        });
    }
}
