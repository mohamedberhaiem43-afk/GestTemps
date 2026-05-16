using ABRPOINT.Server.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using Npgsql;

namespace ABRPOINT.Server.Data;

public sealed class DatabaseInitializer
{
    private static readonly ModuleSeed[] DefaultModules =
    {
        new("absence", "Absences", "Absence management"),
        new("dec_conge", "Cahier conges", "Leave register"),
        new("dem_conge", "Demandes conge", "Leave requests"),
        new("ech_ctr", "Echeance contrat", "Contract expiry"),
        new("emp_abs", "Sanctions", "Sanction management"),
        new("emp_allait", "Allaitement", "Breastfeeding permissions"),
        new("emp_aut", "Aut sorties", "Exit authorizations"),
        new("emp_ctr", "Contrats", "Contract management"),
        new("employe", "Employes", "Employee management"),
        new("etat_abs", "Etat absences", "Absence reports"),
        new("etat_conge", "Etat conges", "Leave reports"),
        new("etat_mens", "Etat mensuel", "Monthly report"),
        new("etat_period", "Etat periodique", "Periodic report"),
        new("etat_point", "Etat pointage", "Attendance report"),
        new("etat_ret", "Etat retard", "Late arrivals report"),
        new("frm_conge", "Conges", "Leave management"),
        new("frm_dcong", "Droits conge", "Leave rights"),
        new("frm_ferie", "Jours feries", "Holiday management"),
        new("pointeuse", "Pointeuses", "Time clock management"),
        new("poste", "Postes", "Position management"),
        new("ppimp", "Purge pointeuse", "Time clock purge"),
        new("tout_auto", "Aut sorties gen", "Global exit authorizations"),
        new("tout_conge", "Conge general", "Global leave authorizations")
    };

    private readonly ApplicationDbContext _dbContext;
    private readonly DatabaseInitializationOptions _options;
    private readonly ILogger<DatabaseInitializer> _logger;

    public DatabaseInitializer(
        ApplicationDbContext dbContext,
        IOptions<DatabaseInitializationOptions> options,
        ILogger<DatabaseInitializer> logger)
    {
        _dbContext = dbContext;
        _options = options.Value;
        _logger = logger;
    }

    public async Task InitializeAsync(CancellationToken cancellationToken = default)
    {
        await ApplyMigrationsWithRetryAsync(cancellationToken);

        if (!_options.Enabled)
        {
            _logger.LogInformation("Database initialization seed is disabled.");
            return;
        }

        // En mode SaaS multi-tenant, la base legacy "abrpoint" est optionnelle : chaque tenant
        // a sa propre base créée au signup. On vérifie d'abord la connexion via un open SQL
        // brut (Timeout=3s, pas de retry strategy) — sinon CanConnectAsync passe par le
        // EnableRetryOnFailure() Npgsql et bloque ~30s au boot quand la base n'existe pas.
        var connStr = _dbContext.Database.GetConnectionString();
        if (!string.IsNullOrWhiteSpace(connStr))
        {
            try
            {
                var b = new NpgsqlConnectionStringBuilder(connStr) { Timeout = 3 };
                await using var probe = new NpgsqlConnection(b.ConnectionString);
                await probe.OpenAsync(cancellationToken);
            }
            catch (Exception ex)
            {
                _logger.LogInformation(
                    "Base legacy non accessible ({Err}) : seed ignoré. Normal en mode SaaS pur — chaque tenant a sa propre base.",
                    ex.Message.Split('\n')[0]);
                return;
            }
        }

        await SeedAsync(cancellationToken);
    }

    private async Task ApplyMigrationsWithRetryAsync(CancellationToken cancellationToken)
    {
        var maxAttempts = Math.Max(1, _options.RetryCount);
        var delay = TimeSpan.FromSeconds(Math.Max(1, _options.RetryDelaySeconds));

        for (var attempt = 1; attempt <= maxAttempts; attempt++)
        {
            try
            {
                //await _dbContext.Database.MigrateAsync(cancellationToken);
                return;
            }
            catch (Exception ex) when (attempt < maxAttempts && IsTransient(ex))
            {
                _logger.LogWarning(
                    ex,
                    "Database migration attempt {Attempt}/{MaxAttempts} failed. Retrying in {DelaySeconds}s.",
                    attempt,
                    maxAttempts,
                    delay.TotalSeconds);

                await Task.Delay(delay, cancellationToken);
            }
        }
    }

    private async Task SeedAsync(CancellationToken cancellationToken)
    {
        var settings = SeedSettings.FromOptions(_options);

        await EnsureSocieteAsync(settings, cancellationToken);
        await EnsureSiteAsync(settings, cancellationToken);
        await EnsureAdminUserAsync(settings, cancellationToken);
        await EnsureSocuserAsync(settings, cancellationToken);

        await _dbContext.SaveChangesAsync(cancellationToken);

        await EnsureModulesAsync(settings, cancellationToken);
        await EnsureAdminPermissionsAsync(settings, cancellationToken);
    }

    private async Task EnsureSocieteAsync(SeedSettings settings, CancellationToken cancellationToken)
    {
        var societe = await _dbContext.Societes
            .SingleOrDefaultAsync(s => s.Soccod == settings.SocieteCode, cancellationToken);

        if (societe != null)
        {
            societe.Soclib ??= settings.SocieteName;
            societe.Socpresence ??= "1";
            societe.Sochsup ??= "1";
            return;
        }

        await _dbContext.Societes.AddAsync(new Societe
        {
            Soccod = settings.SocieteCode,
            Soclib = settings.SocieteName,
            Socpresence = "1",
            Sochsup = "1"
        }, cancellationToken);
    }

    private async Task EnsureSiteAsync(SeedSettings settings, CancellationToken cancellationToken)
    {
        var site = await _dbContext.Sites
            .SingleOrDefaultAsync(
                s => s.Soccod == settings.SocieteCode && s.Sitcod == settings.SiteCode,
                cancellationToken);

        if (site != null)
        {
            site.Sitlib ??= settings.SiteName;
            return;
        }

        await _dbContext.Sites.AddAsync(new Site
        {
            Soccod = settings.SocieteCode,
            Sitcod = settings.SiteCode,
            Sitlib = settings.SiteName
        }, cancellationToken);
    }

    private async Task EnsureAdminUserAsync(SeedSettings settings, CancellationToken cancellationToken)
    {
        var utilisateur = await _dbContext.Utilisateurs
            .SingleOrDefaultAsync(u => u.Uticod == settings.AdminCode, cancellationToken);

        if (utilisateur == null)
        {
            await _dbContext.Utilisateurs.AddAsync(new Utilisateur
            {
                Uticod = settings.AdminCode,
                Utiprn = settings.AdminFirstName,
                Utinom = settings.AdminLastName,
                Utimail = settings.AdminEmail,
                Utimps = BCrypt.Net.BCrypt.HashPassword(settings.AdminPassword),
                Utiadm = "1",
                Utiactif = "1"
            }, cancellationToken);

            return;
        }

        utilisateur.Utiprn ??= settings.AdminFirstName;
        utilisateur.Utinom ??= settings.AdminLastName;
        utilisateur.Utimail ??= settings.AdminEmail;
        utilisateur.Utiadm = "1";
        utilisateur.Utiactif = "1";
    }

    private async Task EnsureSocuserAsync(SeedSettings settings, CancellationToken cancellationToken)
    {
        var socuserExists = await _dbContext.Socusers.AnyAsync(
            s => s.Soccod == settings.SocieteCode
                && s.Sitcod == settings.SiteCode
                && s.Uticod == settings.AdminCode,
            cancellationToken);

        if (socuserExists)
        {
            return;
        }

        await _dbContext.Socusers.AddAsync(new Socuser
        {
            Soccod = settings.SocieteCode,
            Sitcod = settings.SiteCode,
            Uticod = settings.AdminCode
        }, cancellationToken);
    }

    private async Task EnsureModulesAsync(SeedSettings settings, CancellationToken cancellationToken)
    {
        // Migré T-SQL → PostgreSQL : UPSERT natif via INSERT ... ON CONFLICT DO UPDATE
        // remplace le pattern UPDATE-then-IF-ROWCOUNT-0-INSERT. Implique que la colonne
        // PK (modcod) ait un index unique (c'est le cas via la définition de l'entité).
        // NULLIF(x, '') empêche d'écraser une valeur existante non vide par notre default.
        foreach (var module in DefaultModules)
        {
            await _dbContext.Database.ExecuteSqlInterpolatedAsync($@"
INSERT INTO module (modcod, modlib, appcod, modsais, modupd, modsupp, modconsult, description)
VALUES ({module.Code}, {module.Label}, {settings.ApplicationCode}, {'1'}, {'1'}, {'1'}, {'1'}, {module.Description})
ON CONFLICT (modcod) DO UPDATE SET
    modlib      = COALESCE(NULLIF(module.modlib, ''),      EXCLUDED.modlib),
    appcod      = COALESCE(NULLIF(module.appcod, ''),      EXCLUDED.appcod),
    modsais     = COALESCE(NULLIF(module.modsais, ''),     EXCLUDED.modsais),
    modupd      = COALESCE(NULLIF(module.modupd, ''),      EXCLUDED.modupd),
    modsupp     = COALESCE(NULLIF(module.modsupp, ''),     EXCLUDED.modsupp),
    modconsult  = COALESCE(NULLIF(module.modconsult, ''),  EXCLUDED.modconsult),
    description = COALESCE(NULLIF(module.description, ''), EXCLUDED.description)
;", cancellationToken);
        }
    }

    private async Task EnsureAdminPermissionsAsync(SeedSettings settings, CancellationToken cancellationToken)
    {
        var modules = await _dbContext.Modules
            .AsNoTracking()
            .Where(m => !string.IsNullOrWhiteSpace(m.Modcod))
            .Select(m => new
            {
                Code = m.Modcod!,
                AppCode = string.IsNullOrWhiteSpace(m.Appcod) ? settings.ApplicationCode : m.Appcod!,
                Description = m.Description
            })
            .ToListAsync(cancellationToken);

        var moduleMap = modules
            .GroupBy(m => m.Code)
            .Select(g => g.First())
            .ToDictionary(m => m.Code, StringComparer.OrdinalIgnoreCase);

        var existingPermissions = (await _dbContext.Modusers
            .Where(m => m.Uticod == settings.AdminCode && m.Modcod != null)
            .ToListAsync(cancellationToken))
            .ToDictionary(m => m.Modcod!, StringComparer.OrdinalIgnoreCase);

        foreach (var module in moduleMap.Values)
        {
            if (existingPermissions.TryGetValue(module.Code, out var moduser))
            {
                moduser.Appcod = string.IsNullOrWhiteSpace(moduser.Appcod) ? module.AppCode : moduser.Appcod;
                moduser.Modsais = "1";
                moduser.Modupd = "1";
                moduser.Modsupp = "1";
                moduser.Modconsult = "1";
                moduser.Description ??= module.Description;
                continue;
            }

            await _dbContext.Modusers.AddAsync(new Moduser
            {
                Uticod = settings.AdminCode,
                Modcod = module.Code,
                Appcod = module.AppCode,
                Modsais = "1",
                Modupd = "1",
                Modsupp = "1",
                Modconsult = "1",
                Description = module.Description
            }, cancellationToken);
        }

        //await _dbContext.SaveChangesAsync(cancellationToken);
    }

    private static bool IsTransient(Exception ex)
    {
        // Sous Npgsql, les erreurs SQL remontent via NpgsqlException (qui hérite de
        // DbException). On considère toute NpgsqlException comme transitoire ici, en
        // partant du principe que ce code n'est appelé qu'au boot pour la migration —
        // un retry coûte peu et permet de passer outre les états transitoires
        // (server starting, too_many_connections, etc.).
        return ex switch
        {
            NpgsqlException => true,
            TimeoutException => true,
            DbUpdateException dbUpdateException when dbUpdateException.InnerException is not null => IsTransient(dbUpdateException.InnerException),
            InvalidOperationException invalidOperationException when invalidOperationException.InnerException is not null => IsTransient(invalidOperationException.InnerException),
            _ when ex.InnerException is not null => IsTransient(ex.InnerException),
            _ => false
        };
    }

    private sealed record ModuleSeed(string Code, string Label, string Description);

    private sealed record SeedSettings(
        string SocieteCode,
        string SocieteName,
        string SiteCode,
        string SiteName,
        string AdminCode,
        string AdminFirstName,
        string AdminLastName,
        string AdminEmail,
        string AdminPassword,
        string ApplicationCode)
    {
        public static SeedSettings FromOptions(DatabaseInitializationOptions options)
        {
            return new SeedSettings(
                NormalizeCode(options.SocieteCode, 2, "01"),
                NormalizeText(options.SocieteName, 30, "Default Company"),
                NormalizeCode(options.SiteCode, 2, "01"),
                NormalizeText(options.SiteName, 30, "Main Site"),
                NormalizeCode(options.AdminCode, 2, "AD"),
                NormalizeText(options.AdminFirstName, 20, "Admin"),
                NormalizeText(options.AdminLastName, 20, "System"),
                NormalizeText(options.AdminEmail, 100, "admin@abrpoint.local"),
                string.IsNullOrWhiteSpace(options.AdminPassword) ? "123" : options.AdminPassword.Trim(),
                NormalizeCode(options.ApplicationCode, 3, "GRH"));
        }

        private static string NormalizeCode(string? value, int maxLength, string fallback)
        {
            var normalized = string.IsNullOrWhiteSpace(value) ? fallback : value.Trim().ToUpperInvariant();
            return normalized.Length <= maxLength ? normalized : normalized[..maxLength];
        }

        private static string NormalizeText(string? value, int maxLength, string fallback)
        {
            var normalized = string.IsNullOrWhiteSpace(value) ? fallback : value.Trim();
            return normalized.Length <= maxLength ? normalized : normalized[..maxLength];
        }
    }
}

