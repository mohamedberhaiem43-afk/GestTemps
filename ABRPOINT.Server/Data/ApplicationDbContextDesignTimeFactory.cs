using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;

namespace ABRPOINT.Server.Data;

// Utilisée exclusivement par `dotnet ef` (migrations add, migrations script, dbcontext info).
// Le runtime construit ApplicationDbContext via AddScoped<>(sp => ...) dans Program.cs
// avec une connection string per-tenant — cette factory ne sert PAS au runtime.
//
// ⚠ NE PAS LANCER `dotnet ef database update` SANS PRÉCISER UNE BASE TENANT.
//
//   ApplicationDbContext porte le schéma TENANT (~131 tables : presence, employe, conge…),
//   PAS le schéma MASTER (Tenants, TenantEmailIndex…). Si vous pointez cette factory sur
//   `abrpoint_master`, `database update` y créera 131 tables qui n'ont rien à y faire et
//   shadow-bloquera l'EnsureCreated du MasterDbContext au prochain boot.
//
//   Workflow normal :
//     - `dotnet ef migrations add <Name>` → génère les fichiers de migration (pas de DB touchée)
//     - Au runtime, ProvisioningService.RunMigrationsAsync() applique la migration à chaque
//       nouvelle base tenant créée au signup (cf. Provisioning/ProvisioningService.cs)
//
//   Si vous tenez à valider une migration manuellement (rare), pointez explicitement sur
//   une base throwaway :
//     $env:EF_DESIGN_DB = "tenant_ef_designtime"
//     dotnet ef database update --connection "Host=localhost;Database=tenant_ef_designtime;..."
//
// Variables d'environnement (toutes optionnelles, défauts dev) :
//   EF_DESIGN_HOST       (défaut: localhost)
//   EF_DESIGN_PORT       (défaut: 5432)
//   EF_DESIGN_DB         (défaut: tenant_ef_designtime — base throwaway, JAMAIS abrpoint_master)
//   EF_DESIGN_USER       (défaut: abrpoint)
//   EF_DESIGN_PASSWORD   (fallback: POSTGRES_PASSWORD, puis valeur par défaut du compose)
//
// Pour générer une migration en local (cas d'usage principal) :
//   docker compose up -d abrpoint.database
//   $env:EF_DESIGN_PASSWORD = "<le mdp>"
//   cd ABRPOINT.Server
//   dotnet ef migrations add <Name>
public class ApplicationDbContextDesignTimeFactory : IDesignTimeDbContextFactory<ApplicationDbContext>
{
    public ApplicationDbContext CreateDbContext(string[] args)
    {
        var host     = Environment.GetEnvironmentVariable("EF_DESIGN_HOST")     ?? "localhost";
        var port     = Environment.GetEnvironmentVariable("EF_DESIGN_PORT")     ?? "5432";
        var database = Environment.GetEnvironmentVariable("EF_DESIGN_DB")       ?? "tenant_ef_designtime";
        var user     = Environment.GetEnvironmentVariable("EF_DESIGN_USER")     ?? "abrpoint";
        var password = Environment.GetEnvironmentVariable("EF_DESIGN_PASSWORD")
                       ?? Environment.GetEnvironmentVariable("POSTGRES_PASSWORD")
                       ?? "PX0m6jCr1S8CsBjJZDrQXj66vILUAOpvtYeqjr8aT4A=";

        var cs = $"Host={host};Port={port};Database={database};Username={user};Password={password}";

        var options = new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseNpgsql(cs)
            .Options;

        return new ApplicationDbContext(options);
    }
}
