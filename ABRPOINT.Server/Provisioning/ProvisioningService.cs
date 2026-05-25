using ABRPOINT.Server.Authorization;
using ABRPOINT.Server.Data;
using ABRPOINT.Server.Models;
using ABRPOINT.Server.Services;
using ABRPOINT.Server.Tenancy;
using Microsoft.EntityFrameworkCore;
using Npgsql;
using System.Text.RegularExpressions;

namespace ABRPOINT.Server.Provisioning;

/// <summary>
/// Implémentation par défaut : pilote PostgreSQL via les connexions
///   - MasterConnection (pour CREATE / DROP DATABASE — exige le rôle CREATEDB).
///   - TenantTemplate   (template avec {DbName} pour les migrations + seed).
///
/// Migré de SQL Server → PostgreSQL :
///   - SqlConnection → NpgsqlConnection
///   - CREATE DATABASE Postgres : refusée DANS une transaction. Npgsql ouvre
///     une transaction implicite par défaut → on désactive via la connexion
///     standard (ExecuteNonQueryAsync sans BEGIN explicite, ce qui marche).
///   - PostgreSQL n'a pas d'équivalent direct à "IF DB_ID IS NULL ... CREATE" en
///     une seule instruction → on regarde d'abord pg_database, puis CREATE.
///   - COLLATE French_CI_AS supprimée : PostgreSQL utilise des collations ICU
///     différentes (LC_COLLATE/LC_CTYPE par DB, ou collations COLLATE x USING).
///     Si le tenant a besoin de comparaisons insensibles à la casse sur libellés,
///     préférer LOWER() côté queries ou créer une collation ICU dédiée.
///   - ALTER DATABASE ... SINGLE_USER → DROP DATABASE WITH (FORCE) sous PG 13+,
///     ou kill manuel des connexions via pg_terminate_backend pour PG 11-12.
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
        // PostgreSQL : pour créer/dropper une base, il faut être connecté à UNE AUTRE base
        // (typiquement "postgres", la base système toujours présente). On clone la connection
        // string en pointant Database=postgres.
        var serverCs = SwitchDatabase(masterCs, "postgres");

        await using var conn = new NpgsqlConnection(serverCs);
        await conn.OpenAsync(ct);

        // 1) Check d'existence (équivalent de DB_ID() en T-SQL).
        await using (var check = conn.CreateCommand())
        {
            check.CommandText = "SELECT 1 FROM pg_database WHERE datname = @dbName LIMIT 1";
            check.Parameters.AddWithValue("@dbName", dbName);
            var found = await check.ExecuteScalarAsync(ct);
            if (found != null)
            {
                _log.LogInformation("Database already exists, skipping CREATE: {DbName}", dbName);
                return;
            }
        }

        // 2) CREATE DATABASE — l'identifiant ne peut PAS être paramétré, donc on l'interpole
        // après l'avoir passé par ValidateDbName + QuoteIdent (échappe les guillemets doubles).
        // Défense en profondeur identique à l'ancienne implémentation SQL Server.
        // nosemgrep: csharp.lang.security.sqli.csharp-sqli.csharp-sqli
        await using (var create = conn.CreateCommand())
        {
            create.CommandText = $"CREATE DATABASE {QuoteIdent(dbName)}";
            await create.ExecuteNonQueryAsync(ct);
        }
        _log.LogInformation("Database created: {DbName}", dbName);
    }

    public async Task RunMigrationsAsync(string dbName, CancellationToken ct = default)
    {
        ValidateDbName(dbName);
        var connStr = GetTenantConnection(dbName);
        var options = new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseNpgsql(connStr, npg => npg.EnableRetryOnFailure())
            .Options;

        await using var db = new ApplicationDbContext(options);
        await db.Database.MigrateAsync(ct);

        // Migrations "in place" non couvertes par EF (colonnes ajoutées au modèle après
        // 'InitialCreate' : socville, vilcod élargi, parmodemp, CET, etc.).
        await BaseDataSchemaMigrator.MigrateAsync(db, ct);

        _log.LogInformation("Migrations applied to {DbName}", dbName);
    }

    public async Task SeedInitialAsync(Tenant tenant, ProvisioningSeedRequest seed, CancellationToken ct = default)
    {
        ValidateDbName(tenant.DbName);
        var connStr = GetTenantConnection(tenant.DbName);
        var options = new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseNpgsql(connStr, npg => npg.EnableRetryOnFailure())
            .Options;

        await using var db = new ApplicationDbContext(options);

        // Convention : un tenant = une société (Soccod="01"), un site (Sitcod="01"), un admin (Uticod="AD").
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

        // 5. Utilisateur du tenant (BCrypt) — créé comme "Responsable RH" avec promotion
        //    automatique vers Administrator quand il prend la responsabilité d'au moins
        //    un collaborateur. Voir EmployesController.Put pour la logique de promotion.
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
                Utirole = PermissionCatalog.Roles.ResponsableRH,
                // Email non vérifié à la création. Le hash + expiry du code OTP sont
                // posés ici si le caller les a fournis (signup standard). Resterait null
                // si le tenant est créé par un script back-office sans vérification.
                UtiEmailVerified = "0",
                UtiEmailVerifCode = seed.EmailVerifCodeHash,
                UtiEmailVerifExpiry = seed.EmailVerifCodeExpiry,
                UtiEmailVerifAttempts = 0,
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

        // 7. Permissions modules legacy (Modusers).
        await GrantAllModulesToAdminAsync(db, AdminCode, ct);

        // 8. Rôles système RBAC.
        await SystemRoleSeeder.SeedAsync(db, ct);

        // 9. Tables mobiles (push_tokens, push_reminder_log).
        await MobileTablesInstaller.InstallAsync(db, ct);

        _log.LogInformation("Seed initial completed for tenant {Slug} (db={DbName})", tenant.Slug, tenant.DbName);
    }

    public async Task DropDatabaseAsync(string dbName, CancellationToken ct = default)
    {
        ValidateDbName(dbName);
        var masterCs = GetMasterConnection();
        var serverCs = SwitchDatabase(masterCs, "postgres");

        await using var conn = new NpgsqlConnection(serverCs);
        await conn.OpenAsync(ct);

        // PostgreSQL ≥ 13 : DROP DATABASE x WITH (FORCE) tue les connexions actives,
        // équivalent direct du ALTER DATABASE x SET SINGLE_USER WITH ROLLBACK IMMEDIATE
        // de SQL Server. Pour PG 11-12, il faudrait d'abord pg_terminate_backend sur
        // toutes les sessions liées à dbName, mais on cible PG 16 dans docker-compose
        // donc on prend la voie courte.
        //
        // L'identifiant ne peut PAS être paramétré → ValidateDbName + QuoteIdent.
        // nosemgrep: csharp.lang.security.sqli.csharp-sqli.csharp-sqli
        await using var cmd = conn.CreateCommand();
        cmd.CommandText = $"DROP DATABASE IF EXISTS {QuoteIdent(dbName)} WITH (FORCE)";
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

    /// <summary>
    /// Remplace Database=... dans une connection string Npgsql par newDatabase.
    /// Utilisé pour basculer du master tenant vers la base postgres système (où
    /// on a le droit de faire CREATE/DROP DATABASE).
    /// </summary>
    private static string SwitchDatabase(string connectionString, string newDatabase)
    {
        var b = new NpgsqlConnectionStringBuilder(connectionString) { Database = newDatabase };
        return b.ConnectionString;
    }

    // Whitelist stricte : lettres ASCII, chiffres, underscore, max 63 caractères (limite
    // NAMEDATALEN de PostgreSQL par défaut). Format compatible avec les conventions
    // internes (`tenant_<slug>_<8hex>`, `abrpoint_*`) tout en excluant les caractères
    // qui pourraient casser la quoting d'un identifiant ("'\;).
    //
    // Note : SQL Server tolérait 64 caractères ; PG en limite à 63. La regex passe
    // donc à 63 pour éviter les noms tronqués silencieusement par le moteur.
    private static readonly Regex DbNamePattern = new(@"^[A-Za-z0-9_]{1,63}$",
        RegexOptions.Compiled | RegexOptions.CultureInvariant);

    /// <summary>
    /// Valide le nom de base : strictement <c>^[A-Za-z0-9_]{1,63}$</c>.
    /// Évite l'injection SQL via le nom de DB (les identifiants ne sont pas paramétrables).
    /// </summary>
    private static void ValidateDbName(string dbName)
    {
        if (string.IsNullOrWhiteSpace(dbName))
            throw new ArgumentException("DbName vide", nameof(dbName));
        if (!DbNamePattern.IsMatch(dbName))
            throw new ArgumentException("DbName invalide (lettres/chiffres/underscore, max 63).", nameof(dbName));
    }

    /// <summary>
    /// Quote un identifiant PostgreSQL entre double-quotes, en doublant tout '"' interne.
    /// Combiné avec <see cref="ValidateDbName"/> (qui interdit déjà '"'), c'est une défense
    /// en profondeur : si la validation est un jour assouplie, l'échappement reste correct.
    /// </summary>
    private static string QuoteIdent(string identifier)
    {
        ValidateDbName(identifier);
        return "\"" + identifier.Replace("\"", "\"\"") + "\"";
    }

    private static string Truncate(string? s, int max)
    {
        if (string.IsNullOrEmpty(s)) return string.Empty;
        return s.Length <= max ? s : s[..max];
    }
}
