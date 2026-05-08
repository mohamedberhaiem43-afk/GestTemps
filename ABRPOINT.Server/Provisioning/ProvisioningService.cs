using ABRPOINT.Server.Authorization;
using ABRPOINT.Server.Data;
using ABRPOINT.Server.Models;
using ABRPOINT.Server.Services;
using ABRPOINT.Server.Tenancy;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;
using System.Text.RegularExpressions;

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
        // SQL Server n'autorise PAS de paramètre pour un identifiant (nom de base) — on doit
        // donc l'interpoler. Défense en profondeur : (1) ValidateDbName impose la regex
        // ^[A-Za-z0-9_]{1,64}$ ; (2) BracketIdent échappe les ']' (impossible vu la regex,
        // mais cap au cas où la validation évolue) ; (3) le test d'existence DB_ID(@dbName)
        // EST paramétrable (DB_ID accepte un argument), donc on le paramètre.
        // nosemgrep: csharp.lang.security.sqli.csharp-sqli.csharp-sqli
        cmd.CommandText = $"IF DB_ID(@dbName) IS NULL CREATE DATABASE {BracketIdent(dbName)} COLLATE French_CI_AS;";
        cmd.Parameters.Add(new SqlParameter("@dbName", System.Data.SqlDbType.NVarChar, 128) { Value = dbName });
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

        // Migrations "in place" non couvertes par EF (colonnes ajoutées au modèle après
        // 'InitialCreate' : socville, vilcod élargi, parmodemp, CET, etc.). Sans ça,
        // SeedInitialAsync échoue dès qu'il insère une Societe avec Socville.
        await BaseDataSchemaMigrator.MigrateAsync(db, ct);

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

        // 5. Utilisateur du tenant (BCrypt). Désormais créé par défaut comme
        //    "Responsable RH" et non plus directement Administrator : on attend
        //    qu'il prenne effectivement la responsabilité d'au moins un collaborateur
        //    (champ Empresp côté Employe) pour qu'il soit auto-promu Administrator
        //    via EmployesController.Put. Cette progression suit le parcours métier :
        //    "tu es RH → quand tu encadres quelqu'un, tu deviens admin".
        //
        //    Le flag legacy `Utiadm = "1"` est conservé : c'est le créateur du tenant,
        //    il doit pouvoir bootstrapper sa configuration (ajouter ses 1ers employés,
        //    paramétrer son entreprise) sans bloquer derrière un check legacy.
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
        // Mêmes garanties que CreateDatabaseAsync : ValidateDbName + BracketIdent + paramètre
        // pour DB_ID. ALTER DATABASE / DROP DATABASE n'acceptent PAS d'identifiant paramétrable.
        // Forcer SINGLE_USER pour casser les connexions ouvertes avant DROP.
        var bracketed = BracketIdent(dbName);
        // nosemgrep: csharp.lang.security.sqli.csharp-sqli.csharp-sqli
        cmd.CommandText = $@"
IF DB_ID(@dbName) IS NOT NULL
BEGIN
    ALTER DATABASE {bracketed} SET SINGLE_USER WITH ROLLBACK IMMEDIATE;
    DROP DATABASE {bracketed};
END";
        cmd.Parameters.Add(new SqlParameter("@dbName", System.Data.SqlDbType.NVarChar, 128) { Value = dbName });
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

    // Whitelist stricte : lettres ASCII, chiffres, underscore, max 64 caractères. Format compatible
    // avec les conventions internes (`tenant_<slug>_<8hex>`, `ABRPOINT_*`) tout en excluant les
    // caractères qui pourraient casser la quoting d'un identifiant SQL Server (espace, ']', '-', '"', ';'…).
    private static readonly Regex DbNamePattern = new(@"^[A-Za-z0-9_]{1,64}$",
        RegexOptions.Compiled | RegexOptions.CultureInvariant);

    /// <summary>
    /// Valide le nom de base : strictement <c>^[A-Za-z0-9_]{1,64}$</c>.
    /// Évite l'injection SQL via le nom de DB (les identifiants ne sont pas paramétrables).
    /// </summary>
    private static void ValidateDbName(string dbName)
    {
        if (string.IsNullOrWhiteSpace(dbName))
            throw new ArgumentException("DbName vide", nameof(dbName));
        if (!DbNamePattern.IsMatch(dbName))
            throw new ArgumentException("DbName invalide (lettres/chiffres/underscore, max 64).", nameof(dbName));
    }

    /// <summary>
    /// Quote un identifiant SQL Server entre crochets, en doublant tout ']' interne.
    /// Combiné avec <see cref="ValidateDbName"/> (qui interdit déjà ']'), c'est une défense
    /// en profondeur : si la validation est un jour assouplie, l'échappement reste correct.
    /// </summary>
    private static string BracketIdent(string identifier)
    {
        ValidateDbName(identifier);
        return "[" + identifier.Replace("]", "]]") + "]";
    }

    private static string Truncate(string? s, int max)
    {
        if (string.IsNullOrEmpty(s)) return string.Empty;
        return s.Length <= max ? s : s[..max];
    }
}
