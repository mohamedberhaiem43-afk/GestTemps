using ABRPOINT.Server.Authorization;
using ABRPOINT.Server.Data;
using ABRPOINT.Server.Models;
using ABRPOINT.Server.Services;
using ABRPOINT.Server.Tenancy;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;

namespace ABRPOINT.Server.Provisioning;

/// <summary>
/// Implémentation par défaut : pilote SQL Server via les connexions
///   - MasterConnection (pour CREATE / DROP DATABASE — exige dbcreator).
///   - TenantTemplate   (template avec {DbName} pour les migrations + seed).
/// </summary>
public sealed class ProvisioningService : IProvisioningService
{
    private readonly IConfiguration _cfg;
    private readonly ILogger<ProvisioningService> _log;

    public ProvisioningService(IConfiguration cfg, ILogger<ProvisioningService> log)
    {
        _cfg = cfg;
        _log = log;
    }

    public async Task CreateDatabaseAsync(string dbName, CancellationToken ct = default)
    {
        ValidateDbName(dbName);
        var masterCs = GetMasterConnection();
        // Connexion vers master physique de SQL Server (pas ABRPOINT_master) pour CREATE DATABASE.
        var serverCs = SwitchInitialCatalog(masterCs, "master");

        await using var conn = new SqlConnection(serverCs);
        await conn.OpenAsync(ct);
        await using var cmd = conn.CreateCommand();
        // dbName est validé en regex avant — interpolation sûre car SQL Server n'autorise pas
        // de paramètres pour les identifiants.
        cmd.CommandText = $"IF DB_ID(N'{dbName}') IS NULL CREATE DATABASE [{dbName}] COLLATE French_CI_AS;";
        await cmd.ExecuteNonQueryAsync(ct);
        _log.LogInformation("Database created (or already existed): {DbName}", dbName);
    }

    public async Task RunMigrationsAsync(string dbName, CancellationToken ct = default)
    {
        ValidateDbName(dbName);
        var connStr = GetTenantConnection(dbName);
        var options = new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseSqlServer(connStr, sql => sql.EnableRetryOnFailure())
            .Options;

        await using var db = new ApplicationDbContext(options);
        await db.Database.MigrateAsync(ct);
        _log.LogInformation("Migrations applied to {DbName}", dbName);
    }

    public async Task SeedInitialAsync(Tenant tenant, ProvisioningSeedRequest seed, CancellationToken ct = default)
    {
        ValidateDbName(tenant.DbName);
        var connStr = GetTenantConnection(tenant.DbName);
        var options = new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseSqlServer(connStr, sql => sql.EnableRetryOnFailure())
            .Options;

        await using var db = new ApplicationDbContext(options);

        // Convention : un tenant = une société (Soccod="01"), un site (Sitcod="01"), un admin (Uticod="AD").
        // LegacySoccod du tenant master est synchronisé avec ce code.
        const string Soccod = "01";
        const string Sitcod = "01";
        const string AdminCode = "AD";

        // 1. Societe
        if (!await db.Societes.AnyAsync(s => s.Soccod == Soccod, ct))
        {
            db.Societes.Add(new Societe
            {
                Soccod = Soccod,
                Soclib = Truncate(seed.CompanyName, 30),
                Socpresence = "1",
                Sochsup = "1"
            });
        }

        // 2. Site siège
        if (!await db.Sites.AnyAsync(s => s.Soccod == Soccod && s.Sitcod == Sitcod, ct))
        {
            db.Sites.Add(new Site
            {
                Soccod = Soccod,
                Sitcod = Sitcod,
                Sitlib = "Siège"
            });
        }

        // 3. Service par défaut
        if (!await db.Services.AnyAsync(s => s.Soccod == Soccod && s.Sercod == "DIR", ct))
        {
            db.Services.Add(new Service
            {
                Soccod = Soccod,
                Sercod = "DIR",
                Serlib = "Direction"
            });
        }

        // 4. Catégorie par défaut (Cadres)
        if (!await db.Categories.AnyAsync(c => c.Soccod == Soccod && c.Catcod == "CAD", ct))
        {
            db.Categories.Add(new Categorie
            {
                Soccod = Soccod,
                Catcod = "01",
                Catlib = "Cadres"
            });
        }

        // 5. Utilisateur admin (BCrypt) — assigné au rôle système Administrator
        var existingUser = await db.Utilisateurs.FirstOrDefaultAsync(u => u.Uticod == AdminCode, ct);
        if (existingUser is null)
        {
            db.Utilisateurs.Add(new Utilisateur
            {
                Uticod = AdminCode,
                Utiprn = Truncate(seed.AdminFirstName, 20),
                Utinom = Truncate(seed.AdminLastName, 20),
                Utimail = Truncate(seed.AdminEmail, 100),
                Utimps = BCrypt.Net.BCrypt.HashPassword(seed.AdminPassword),
                Utiactif = "1",
                Utiadm = "1",
                Utirole = PermissionCatalog.Roles.Administrator,
            });
        }

        // 6. Socuser (lie l'admin au site)
        if (!await db.Socusers.AnyAsync(s => s.Soccod == Soccod && s.Sitcod == Sitcod && s.Uticod == AdminCode, ct))
        {
            db.Socusers.Add(new Socuser
            {
                Soccod = Soccod,
                Sitcod = Sitcod,
                Uticod = AdminCode
            });
        }

        await db.SaveChangesAsync(ct);

        // 7. Permissions modules legacy : on accorde tous les modules existants à l'admin.
        //    (Conservé pour compat avec le code legacy qui lit encore Modusers.)
        await GrantAllModulesToAdminAsync(db, AdminCode, ct);

        // 8. Rôles système RBAC : Administrator / Manager / Employee avec permissions par défaut.
        //    L'admin du signup est déjà associé au rôle Administrator via Utilisateur.Utirole.
        await SystemRoleSeeder.SeedAsync(db, ct);

        // 9. Tables mobiles (push_tokens, push_reminder_log) — créées si absentes.
        //    Permet aux nouveaux tenants de recevoir des notifications push immédiatement,
        //    sans intervention DBA.
        await MobileTablesInstaller.InstallAsync(db, ct);

        _log.LogInformation("Seed initial completed for tenant {Slug} (db={DbName})", tenant.Slug, tenant.DbName);
    }

    public async Task DropDatabaseAsync(string dbName, CancellationToken ct = default)
    {
        ValidateDbName(dbName);
        var masterCs = GetMasterConnection();
        var serverCs = SwitchInitialCatalog(masterCs, "master");

        await using var conn = new SqlConnection(serverCs);
        await conn.OpenAsync(ct);
        await using var cmd = conn.CreateCommand();
        // Forcer SINGLE_USER pour casser les connexions ouvertes avant DROP.
        cmd.CommandText = $@"
IF DB_ID(N'{dbName}') IS NOT NULL
BEGIN
    ALTER DATABASE [{dbName}] SET SINGLE_USER WITH ROLLBACK IMMEDIATE;
    DROP DATABASE [{dbName}];
END";
        await cmd.ExecuteNonQueryAsync(ct);
        _log.LogWarning("Database dropped: {DbName}", dbName);
    }

    private static async Task GrantAllModulesToAdminAsync(ApplicationDbContext db, string adminCode, CancellationToken ct)
    {
        var moduleCodes = await db.Modules.Where(m => m.Modcod != null).Select(m => m.Modcod!).ToListAsync(ct);
        var existing = await db.Modusers.Where(m => m.Uticod == adminCode).Select(m => m.Modcod!).ToListAsync(ct);
        var toAdd = moduleCodes.Except(existing, StringComparer.OrdinalIgnoreCase).ToList();
        foreach (var code in toAdd)
        {
            db.Modusers.Add(new Moduser
            {
                Uticod = adminCode,
                Modcod = code,
                Modsais = "1",
                Modupd = "1",
                Modsupp = "1",
                Modconsult = "1"
            });
        }
        if (toAdd.Count > 0) await db.SaveChangesAsync(ct);
    }

    private string GetMasterConnection() =>
        _cfg.GetConnectionString("MasterConnection")
        ?? throw new InvalidOperationException("ConnectionStrings:MasterConnection requis pour le provisioning.");

    private string GetTenantConnection(string dbName)
    {
        var template = _cfg.GetConnectionString("TenantTemplate")
            ?? throw new InvalidOperationException("ConnectionStrings:TenantTemplate manquant.");
        return template.Replace("{DbName}", dbName);
    }

    private static string SwitchInitialCatalog(string connectionString, string newCatalog)
    {
        var b = new SqlConnectionStringBuilder(connectionString) { InitialCatalog = newCatalog };
        return b.ConnectionString;
    }

    /// <summary>
    /// Valide le nom de base : strictement `tenant_<slug>_<8hex>` ou ABRPOINT_*.
    /// Évite l'injection SQL via le nom de DB (les identifiants ne sont pas paramétrables).
    /// </summary>
    private static void ValidateDbName(string dbName)
    {
        if (string.IsNullOrWhiteSpace(dbName))
            throw new ArgumentException("DbName vide", nameof(dbName));
        if (dbName.Length > 64)
            throw new ArgumentException("DbName trop long", nameof(dbName));
        foreach (var c in dbName)
        {
            if (!(char.IsLetterOrDigit(c) || c == '_'))
                throw new ArgumentException($"Caractère interdit dans DbName: '{c}'", nameof(dbName));
        }
    }

    private static string Truncate(string? s, int max)
    {
        if (string.IsNullOrEmpty(s)) return string.Empty;
        return s.Length <= max ? s : s[..max];
    }
}
