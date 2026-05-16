using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;

namespace ABRPOINT.Server.Data;

// Utilisé exclusivement par `dotnet ef` (migrations add / database update / dbcontext info).
// Le runtime construit ApplicationDbContext via AddScoped<>(sp => ...) dans Program.cs
// avec une connection string per-tenant — cette factory ne sert PAS au runtime.
//
// Variables d'environnement attendues (toutes optionnelles, défauts dev) :
//   EF_DESIGN_HOST       (défaut: localhost)
//   EF_DESIGN_PORT       (défaut: 5432)
//   EF_DESIGN_DB         (défaut: abrpoint_master)
//   EF_DESIGN_USER       (défaut: abrpoint)
//   EF_DESIGN_PASSWORD   (fallback: POSTGRES_PASSWORD, puis valeur par défaut du compose)
//
// Pour générer/appliquer une migration en local :
//   docker compose up -d abrpoint.database
//   $env:EF_DESIGN_PASSWORD = "<le mdp>"
//   dotnet ef migrations add InitialCreate
public class ApplicationDbContextDesignTimeFactory : IDesignTimeDbContextFactory<ApplicationDbContext>
{
    public ApplicationDbContext CreateDbContext(string[] args)
    {
        var host     = Environment.GetEnvironmentVariable("EF_DESIGN_HOST")     ?? "localhost";
        var port     = Environment.GetEnvironmentVariable("EF_DESIGN_PORT")     ?? "5432";
        var database = Environment.GetEnvironmentVariable("EF_DESIGN_DB")       ?? "abrpoint_master";
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
