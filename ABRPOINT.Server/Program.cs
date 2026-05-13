using ABRPOINT.Mappings;
using ABRPOINT.Server.Billing;
using ABRPOINT.Server.Data;
using ABRPOINT.Server.Helpers;
using ABRPOINT.Server.Provisioning;
using ABRPOINT.Server.Services;
using ABRPOINT.Server.Tenancy;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.FileProviders;
using Microsoft.IdentityModel.Tokens;
using System.Text;
using System.Text.Json.Serialization;
using DinkToPdf;
using DinkToPdf.Contracts;

// ✅ Fix: Set timezone to Europe/Paris so DateTime.Now returns correct local time (important for Docker containers that default to UTC)
Environment.SetEnvironmentVariable("TZ", "Europe/Paris");

var builder = WebApplication.CreateBuilder(args);

// OWASP : ne pas divulguer la version du serveur dans le header "Server".
builder.WebHost.ConfigureKestrel(options => options.AddServerHeader = false);

// Register DinkToPdf (wkhtmltopdf) for HTML→PDF conversion
builder.Services.AddSingleton(typeof(IConverter), new SynchronizedConverter(new PdfTools()));

var dbHost = Environment.GetEnvironmentVariable("DB_HOST") ?? "localhost";
var dbName = Environment.GetEnvironmentVariable("DB_NAME");
var dbPassword = Environment.GetEnvironmentVariable("DB_PASSWORD");
var dbUser = Environment.GetEnvironmentVariable("DB_USER") ?? "sa";


var connectionString = !string.IsNullOrWhiteSpace(dbName) && !string.IsNullOrWhiteSpace(dbPassword)
    ? $"Server={dbHost};Database={dbName};User Id={dbUser};Password={dbPassword};TrustServerCertificate=True;"
    : builder.Configuration.GetConnectionString("DefaultConnection")
        ?? throw new InvalidOperationException("A database connection string could not be resolved.");

// ApplicationDbContext registration tenant-aware :
//   - Si un tenant est résolu pour la requête (ICurrentTenant.Current != null), on construit
//     un context bound à la base de ce tenant via le template TenantTemplate.
//   - Sinon (démarrage, signup, master endpoints, ou simplement dev sans tenant), on retombe
//     sur DefaultConnection (= base legacy ABRPOINT). Préserve la compat ascendante.
// Note : on perd le DbContext pooling parce que la connection est dynamique. Acceptable.
builder.Services.AddScoped<ApplicationDbContext>(sp =>
{
    var current = sp.GetService<ICurrentTenant>();
    var cfg = sp.GetRequiredService<IConfiguration>();

    string resolvedConnStr;
    if (current?.Current != null)
    {
        var template = cfg.GetConnectionString("TenantTemplate")
            ?? throw new InvalidOperationException("ConnectionStrings:TenantTemplate manquant alors qu'un tenant est en scope.");
        resolvedConnStr = template.Replace("{DbName}", current.Current.DbName);
    }
    else
    {
        resolvedConnStr = connectionString;
    }

    var options = new DbContextOptionsBuilder<ApplicationDbContext>()
        .UseSqlServer(resolvedConnStr, sql => sql.EnableRetryOnFailure())
        .Options;
    return new ApplicationDbContext(options);
});

// ─────────────────────────────────────────────────────────────────────────────
// SaaS multi-tenant : master DB + tenant resolver + factory.
// Additif et non-bloquant : si pas de master DB configurée, l'app fonctionne
// comme avant (mode legacy mono-tenant via DefaultConnection).
// ─────────────────────────────────────────────────────────────────────────────
// Cache mémoire générique : utilisé par TenantStore (slug→tenant) ET par
// RequirePermissionAttribute (snapshot permissions par utilisateur). Toujours actif.
builder.Services.AddMemoryCache();

var masterConnection = builder.Configuration.GetConnectionString("MasterConnection");
if (!string.IsNullOrWhiteSpace(masterConnection))
{
    builder.Services.AddDbContextFactory<MasterDbContext>(options =>
        options.UseSqlServer(masterConnection, sql => sql.EnableRetryOnFailure()));

    builder.Services.AddSingleton<ICurrentTenant, AsyncLocalCurrentTenant>();
    builder.Services.AddScoped<ITenantStore, TenantStore>();
    builder.Services.AddScoped<ITenantDbContextFactory, TenantDbContextFactory>();
    builder.Services.AddScoped<IProvisioningService, ProvisioningService>();
    builder.Services.AddScoped<IBillingService, StripeBillingService>();
    builder.Services.AddHostedService<TrialExpirationHostedService>();
    builder.Services.AddHostedService<ABRPOINT.Server.Billing.EmployeeBillingSyncService>();
}

builder.Services.Configure<DatabaseInitializationOptions>(
    builder.Configuration.GetSection(DatabaseInitializationOptions.SectionName));
builder.Services.AddScoped<DatabaseInitializer>();

builder.Services.AddControllers().AddJsonOptions(x =>
                x.JsonSerializerOptions.ReferenceHandler = ReferenceHandler.IgnoreCycles);

// Rate limiting RAG : 60 questions/heure par utilisateur (lu depuis le claim NameIdentifier).
// Empêche un utilisateur unique de saturer Claude — un éventuel client mobile partagé
// retombe sur l'IP. Configuré ici, attaché par [EnableRateLimiting("rag-ask")] sur l'endpoint.
builder.Services.AddRateLimiter(options =>
{
    options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
    options.AddPolicy("rag-ask", httpContext =>
    {
        var partitionKey = httpContext.User?.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value
            ?? httpContext.Connection.RemoteIpAddress?.ToString()
            ?? "anon";
        var perHour = builder.Configuration.GetValue<int?>("Rag:RateLimit:QuestionsPerUserPerHour") ?? 60;
        return System.Threading.RateLimiting.RateLimitPartition.GetFixedWindowLimiter(
            partitionKey,
            _ => new System.Threading.RateLimiting.FixedWindowRateLimiterOptions
            {
                PermitLimit = perHour,
                Window = TimeSpan.FromHours(1),
                QueueLimit = 0
            });
    });

    // S8 — Rate limiting "clock-in" sur mark-presence. 6 pointages / minute / (uticod|IP)
    // suffit largement à un humain (entrée + sortie matin/midi/soir) tout en bloquant les
    // attaques de replay ou les boucles d'automatisation. Window glissante : un usage normal
    // étalé sur la minute n'est jamais bloqué.
    options.AddPolicy("clock-in", httpContext =>
    {
        var partitionKey = httpContext.User?.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value
            ?? httpContext.Connection.RemoteIpAddress?.ToString()
            ?? "anon";
        return System.Threading.RateLimiting.RateLimitPartition.GetFixedWindowLimiter(
            partitionKey,
            _ => new System.Threading.RateLimiting.FixedWindowRateLimiterOptions
            {
                PermitLimit = 6,
                Window = TimeSpan.FromMinutes(1),
                QueueLimit = 0,
            });
    });

    // A7 — Brute-force protection sur les endpoints d'authentification.
    //   • "auth-login" : 5 tentatives / minute / IP (login web + mobile + 2FA).
    //     Suffisant pour un humain qui se trompe ; bloque le brute force et le credential stuffing.
    //   • "auth-recovery" : 3 tentatives / 15 min / (email|IP) sur forgot-password.
    //     Empêche la génération massive de codes reset et le scan d'emails valides.
    options.AddPolicy("auth-login", httpContext =>
    {
        var ip = httpContext.Connection.RemoteIpAddress?.ToString() ?? "anon";
        return System.Threading.RateLimiting.RateLimitPartition.GetFixedWindowLimiter(
            ip,
            _ => new System.Threading.RateLimiting.FixedWindowRateLimiterOptions
            {
                PermitLimit = 5,
                Window = TimeSpan.FromMinutes(1),
                QueueLimit = 0,
            });
    });
    options.AddPolicy("auth-recovery", httpContext =>
    {
        // Partitionne sur IP — l'email est dans le body et n'est pas accessible ici sans
        // doubler le bind. Un attaquant doit donc changer d'IP pour scanner — les attaques
        // distribuées passent ; le brute force depuis un seul poste est arrêté.
        var ip = httpContext.Connection.RemoteIpAddress?.ToString() ?? "anon";
        return System.Threading.RateLimiting.RateLimitPartition.GetFixedWindowLimiter(
            ip,
            _ => new System.Threading.RateLimiting.FixedWindowRateLimiterOptions
            {
                PermitLimit = 3,
                Window = TimeSpan.FromMinutes(15),
                QueueLimit = 0,
            });
    });

    // SEC-29 — Limite les uploads de fichiers à 30 / minute / utilisateur. Empêche
    // la saturation disque (10 Mo × 30 = 300 Mo/min/user max — gérable avec une
    // rotation/quota côté ops) tout en restant confortable pour un usage normal.
    options.AddPolicy("file-upload", httpContext =>
    {
        var partitionKey = httpContext.User?.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value
            ?? httpContext.Connection.RemoteIpAddress?.ToString()
            ?? "anon";
        return System.Threading.RateLimiting.RateLimitPartition.GetFixedWindowLimiter(
            partitionKey,
            _ => new System.Threading.RateLimiting.FixedWindowRateLimiterOptions
            {
                PermitLimit = 30,
                Window = TimeSpan.FromMinutes(1),
                QueueLimit = 0,
            });
    });

    // SEC-29 — Signup : 3 créations de tenant / heure / IP. Sans cette limite,
    // un bot peut créer des dizaines de tenants à la chaîne (provisionnement
    // DB par tenant = coût opérationnel important + saturation Stripe customer).
    options.AddPolicy("auth-signup", httpContext =>
    {
        var ip = httpContext.Connection.RemoteIpAddress?.ToString() ?? "anon";
        return System.Threading.RateLimiting.RateLimitPartition.GetFixedWindowLimiter(
            ip,
            _ => new System.Threading.RateLimiting.FixedWindowRateLimiterOptions
            {
                PermitLimit = 3,
                Window = TimeSpan.FromHours(1),
                QueueLimit = 0,
            });
    });

    // SEC-29 — Bulk imports : 10 / heure / utilisateur. Volontairement très restrictif
    // car chaque appel peut écrire plusieurs centaines de lignes en base.
    options.AddPolicy("bulk-import", httpContext =>
    {
        var partitionKey = httpContext.User?.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value
            ?? httpContext.Connection.RemoteIpAddress?.ToString()
            ?? "anon";
        return System.Threading.RateLimiting.RateLimitPartition.GetFixedWindowLimiter(
            partitionKey,
            _ => new System.Threading.RateLimiting.FixedWindowRateLimiterOptions
            {
                PermitLimit = 10,
                Window = TimeSpan.FromHours(1),
                QueueLimit = 0,
            });
    });
});

builder.Services.AddAutoMapper(typeof(MappingProfiles));
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();
builder.AddInfrastructureRegistration();
builder.AddServicesRegistration();

// Push notifications mobile (Expo) + service de rappel pointage (entrée/sortie oubliée).
builder.Services.AddHttpClient(nameof(ABRPOINT.Server.Services.ExpoPushService));
builder.Services.AddSingleton<ABRPOINT.Server.Services.IExpoPushService, ABRPOINT.Server.Services.ExpoPushService>();
builder.Services.AddScoped<ABRPOINT.Server.Services.IUserNotificationService, ABRPOINT.Server.Services.UserNotificationService>();
builder.Services.AddHostedService<ABRPOINT.Server.Services.PunctualityReminderHostedService>();
// Scoped : le validateur lit les sites du tenant courant via ApplicationDbContext (Scoped).
builder.Services.AddScoped<ABRPOINT.Server.Services.IGeoZoneValidator, ABRPOINT.Server.Services.GeoZoneValidator>();

// Import des villes françaises depuis l'API publique geo.api.gouv.fr.
builder.Services.AddHttpClient();
builder.Services.AddScoped<ABRPOINT.Server.Services.IFrenchCitiesImportService, ABRPOINT.Server.Services.FrenchCitiesImportService>();

builder.Services.AddHttpClient("PythonApi", client =>
{
    var config = builder.Configuration.GetSection("PythonApi");
    var baseUrl = config.GetValue<string>("BaseUrl");
    client.BaseAddress = new Uri(baseUrl!);
});
builder.Services.AddAuthentication(options =>
{
    options.DefaultAuthenticateScheme = JwtBearerDefaults.AuthenticationScheme;
    options.DefaultChallengeScheme = JwtBearerDefaults.AuthenticationScheme;
    options.DefaultScheme = JwtBearerDefaults.AuthenticationScheme;
}).AddJwtBearer(o =>
{
    o.TokenValidationParameters = new TokenValidationParameters
    {
        ValidIssuer = builder.Configuration["Jwt:Issuer"],
        ValidAudience = builder.Configuration["Jwt:Audience"],
        IssuerSigningKey = new SymmetricSecurityKey
        (Encoding.UTF8.GetBytes(builder.Configuration["Jwt:Key"])),
        ValidateIssuer = true,
        ValidateAudience = true,
        ValidateLifetime = true,
        ValidateIssuerSigningKey = true,
        ClockSkew = TimeSpan.Zero
    };

    o.Events = new JwtBearerEvents
    {
        OnMessageReceived = context =>
        {
            // First check Authorization header (for mobile app)
            var authHeader = context.Request.Headers["Authorization"].ToString();
            if (!string.IsNullOrEmpty(authHeader) && authHeader.StartsWith("Bearer "))
            {
                context.Token = authHeader.Substring("Bearer ".Length).Trim();
                return Task.CompletedTask;
            }

            // Then check cookies (for web app)
            var accessToken = context.Request.Cookies["accessToken"];
            if (!string.IsNullOrEmpty(accessToken))
            {
                context.Token = accessToken;
            }

            return Task.CompletedTask;
        }
    };
});

// S9 — CORS conditionnel par environnement.
//   • Dev : on whitelist toutes les origines locales utiles (Vite, Expo Go, Metro, simulateurs).
//   • Prod : on lit la liste depuis Cors:AllowedOrigins (configuration). Si rien n'est défini,
//     on tombe sur same-origin (pas d'accès cross-origin) plutôt que de propager le whitelist
//     de dev en production. Aucune origine localhost / exp:// ne doit fuiter dans la prod.
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowReactApp", policy =>
    {
        if (builder.Environment.IsDevelopment())
        {
            policy.WithOrigins(
                    "http://abrpoint.client:3000",
                    "https://localhost:5173",
                    "http://localhost:5173",
                    "https://localhost:5174",
                    "http://localhost:8081",
                    "http://localhost:8082",
                    "http://localhost:19000",
                    "http://localhost:19001",
                    "http://localhost:19002",
                    "http://localhost:19006",
                    "exp://localhost:8081"
                )
                .AllowAnyHeader()
                .AllowAnyMethod()
                .AllowCredentials();
        }
        else
        {
            var configured = builder.Configuration.GetSection("Cors:AllowedOrigins").Get<string[]>()
                             ?? Array.Empty<string>();
            if (configured.Length > 0)
            {
                policy.WithOrigins(configured)
                    .AllowAnyHeader()
                    .AllowAnyMethod()
                    .AllowCredentials();
            }
            else
            {
                // Aucune origine externe : seul le SPA hébergé sur le même host peut appeler l'API.
                policy.WithOrigins().AllowAnyHeader().AllowAnyMethod();
            }
        }
    });
});

var app = builder.Build();

// S2 — Audit secrets : refuse le boot prod si des clés sensibles sont sur leurs valeurs
// par défaut. En dev on log un avertissement.
{
    var secretsLogger = app.Services.GetRequiredService<ILoggerFactory>().CreateLogger("SecretsValidator");
    ABRPOINT.Server.Helpers.SecretsValidator.ValidateOrThrow(app.Configuration, app.Environment, secretsLogger);
}

// ─────────────────────────────────────────────────────────────────────────────
// Security headers (OWASP) : Content-Security-Policy + headers défensifs.
// 'unsafe-inline'/'unsafe-eval' restent nécessaires tant que MUI/emotion injecte
// du CSS inline et que certaines libs charts (recharts, fullcalendar) compilent
// du code à la volée. À durcir progressivement quand on aura ajouté des nonces.
// ─────────────────────────────────────────────────────────────────────────────
app.Use(async (context, next) =>
{
    context.Response.OnStarting(() =>
    {
        var h = context.Response.Headers;
        if (!h.ContainsKey("Content-Security-Policy"))
        {
            h["Content-Security-Policy"] = string.Join("; ", new[]
            {
                "default-src 'self'",
                "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
                "style-src 'self' 'unsafe-inline'",
                "font-src 'self' data:",
                "img-src 'self' data: blob: https:",
                "connect-src 'self' https: wss:",
                "frame-ancestors 'self'",
                "form-action 'self'",
                "base-uri 'self'",
                "object-src 'none'"
            });
        }
        if (!h.ContainsKey("X-Content-Type-Options")) h["X-Content-Type-Options"] = "nosniff";
        if (!h.ContainsKey("X-Frame-Options")) h["X-Frame-Options"] = "SAMEORIGIN";
        if (!h.ContainsKey("Referrer-Policy")) h["Referrer-Policy"] = "strict-origin-when-cross-origin";
        if (!h.ContainsKey("Permissions-Policy")) h["Permissions-Policy"] = "geolocation=(self), camera=(self), microphone=()";
        return Task.CompletedTask;
    });
    await next();
});

// ─────────────────────────────────────────────────────────────────────────────
// Healthchecks pour load balancer / orchestration container :
//   - /healthz : liveness — répond toujours 200 si le process est up. Utilisé
//     par Kubernetes/Compose healthcheck pour redémarrer un conteneur figé.
//   - /readyz  : readiness — 200 seulement si le serveur peut servir du trafic
//     (DB joignable). Permet à un load balancer d'éviter d'envoyer des reqs
//     vers une instance qui boote ou dont la DB est down.
// Endpoints publics (pas d'[Authorize]), non rate-limités.
// ─────────────────────────────────────────────────────────────────────────────
app.MapGet("/healthz", () => Results.Ok(new { status = "ok", time = DateTime.UtcNow }))
   .WithName("Healthz")
   .AllowAnonymous();

app.MapGet("/readyz", async (ApplicationDbContext db) =>
{
    try
    {
        // Ping minimaliste — pas de SELECT lourd, juste une connexion + roundtrip.
        await db.Database.ExecuteSqlRawAsync("SELECT 1");
        return Results.Ok(new { status = "ready", db = "ok", time = DateTime.UtcNow });
    }
    catch (Exception ex)
    {
        return Results.Json(new { status = "not_ready", db = "down", error = ex.GetType().Name }, statusCode: 503);
    }
}).WithName("Readyz").AllowAnonymous();

var uploadsPath = FileHelper.GetUploadsPath();
Directory.CreateDirectory(uploadsPath);

app.UseStaticFiles(); // default wwwroot

// Serve /app/uploads or local uploads folder as /uploads
app.UseStaticFiles(new StaticFileOptions
{
    FileProvider = new PhysicalFileProvider(uploadsPath),
    RequestPath = "/api/uploads"  // match the URL you're calling
});
using (var scope = app.Services.CreateScope())
{
    var startupLogger = scope.ServiceProvider.GetRequiredService<ILoggerFactory>().CreateLogger("Startup");

    // 1. Master DB (multi-tenant) : on l'auto-migre au boot pour qu'un signup puisse
    //    réussir dès le 1er déploiement, même sans setup DBA manuel.
    if (!string.IsNullOrWhiteSpace(masterConnection))
    {
        try
        {
            var masterFactory = scope.ServiceProvider.GetService<IDbContextFactory<MasterDbContext>>();
            if (masterFactory != null)
            {
                await using var masterDb = await masterFactory.CreateDbContextAsync();
                await masterDb.Database.EnsureCreatedAsync();
                // EnsureCreatedAsync ne crée pas les tables manquantes quand la base existe déjà :
                // pour les ajouts post-déploiement comme TenantEmailIndex on émet un CREATE idempotent.
                await masterDb.Database.ExecuteSqlRawAsync(@"
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'TenantEmailIndex')
BEGIN
    CREATE TABLE [TenantEmailIndex] (
        [Email] NVARCHAR(255) NOT NULL CONSTRAINT [PK_TenantEmailIndex] PRIMARY KEY,
        [Slug] NVARCHAR(30) NOT NULL,
        [CreatedAt] DATETIME2 NOT NULL CONSTRAINT [DF_TenantEmailIndex_CreatedAt] DEFAULT SYSUTCDATETIME()
    );
    CREATE INDEX [IX_TenantEmailIndex_Slug] ON [TenantEmailIndex]([Slug]);
END");

                // PlanCode ajouté post-déploiement : idempotent. Sans cet ALTER, les bases master
                // existantes ne connaîtraient pas la colonne et les SELECT EF échoueraient.
                await masterDb.Database.ExecuteSqlRawAsync(@"
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE Name = N'PlanCode' AND Object_ID = Object_ID(N'Tenants'))
BEGIN
    ALTER TABLE [Tenants] ADD [PlanCode] NVARCHAR(20) NULL;
END");
                // TrialReminderSentAt : flag horodaté servant d'anti-doublon pour le rappel
                // "fin d'essai imminente" (J-4). Idempotent — appliqué aux bases master existantes.
                await masterDb.Database.ExecuteSqlRawAsync(@"
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE Name = N'TrialReminderSentAt' AND Object_ID = Object_ID(N'Tenants'))
BEGIN
    ALTER TABLE [Tenants] ADD [TrialReminderSentAt] DATETIME2 NULL;
END");
                // Résiliation : 3 colonnes ajoutées en 2026-05 pour gérer le flow "annuler mon
                // abonnement" (immédiat ou en fin de période courante). Idempotents.
                await masterDb.Database.ExecuteSqlRawAsync(@"
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE Name = N'CancellationRequestedAt' AND Object_ID = Object_ID(N'Tenants'))
BEGIN
    ALTER TABLE [Tenants] ADD [CancellationRequestedAt] DATETIME2 NULL;
END
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE Name = N'CancelAtPeriodEnd' AND Object_ID = Object_ID(N'Tenants'))
BEGIN
    ALTER TABLE [Tenants] ADD [CancelAtPeriodEnd] BIT NOT NULL CONSTRAINT [DF_Tenants_CancelAtPeriodEnd] DEFAULT 0;
END
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE Name = N'CurrentPeriodEndsAt' AND Object_ID = Object_ID(N'Tenants'))
BEGIN
    ALTER TABLE [Tenants] ADD [CurrentPeriodEndsAt] DATETIME2 NULL;
END");
                // Migration 2026-05 : rename commercial Essentiel → Starter. Les tenants
                // signés avant ce changement ont PlanCode='Essentiel' en base ; on aligne
                // pour que PlanCatalog.GetPlan retourne directement Starter sans passer
                // par Normalize() à chaque requête.
                await masterDb.Database.ExecuteSqlRawAsync(
                    "UPDATE [Tenants] SET [PlanCode] = 'Starter' WHERE [PlanCode] = 'Essentiel';");
                // SIRET anti-fraude (2026-05) : colonne nullable + index filtré unique pour
                // empêcher qu'un même SIRET souscrive plusieurs essais gratuits. Les lignes
                // 'Failed' et 'Cancelled' sont exclues du filtre — une 'Failed' peut être
                // recyclée par le même SIRET (retry après crash provisioning), et une
                // 'Cancelled' au-delà de la rétention sera nettoyée par le flow signup.
                // Tous les ALTER/CREATE sont idempotents pour rester safe au redémarrage.
                await masterDb.Database.ExecuteSqlRawAsync(@"
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE Name = N'Siret' AND Object_ID = Object_ID(N'Tenants'))
BEGIN
    ALTER TABLE [Tenants] ADD [Siret] NVARCHAR(20) NULL;
END");
                // Multi-pays (2026-05) : élargit Siret 14→20 chars pour accommoder ICE (15 chiffres)
                // et ajoute CountryCode. Migration in-place idempotente pour les bases déjà déployées
                // avec Siret NVARCHAR(14). ALTER COLUMN safe car on agrandit (pas de truncation).
                await masterDb.Database.ExecuteSqlRawAsync(@"
IF EXISTS (SELECT 1 FROM sys.columns c JOIN sys.types t ON c.user_type_id = t.user_type_id
           WHERE c.Object_ID = Object_ID(N'Tenants') AND c.Name = N'Siret' AND c.max_length = 28)
BEGIN
    ALTER TABLE [Tenants] ALTER COLUMN [Siret] NVARCHAR(20) NULL;
END");
                await masterDb.Database.ExecuteSqlRawAsync(@"
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE Name = N'CountryCode' AND Object_ID = Object_ID(N'Tenants'))
BEGIN
    ALTER TABLE [Tenants] ADD [CountryCode] NVARCHAR(2) NULL;
END");
                await masterDb.Database.ExecuteSqlRawAsync(@"
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Tenants_Siret' AND object_id = OBJECT_ID('Tenants'))
BEGIN
    CREATE INDEX [IX_Tenants_Siret] ON [Tenants]([Siret]);
END");
                await masterDb.Database.ExecuteSqlRawAsync(@"
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'UX_Tenants_Siret_Active' AND object_id = OBJECT_ID('Tenants'))
BEGIN
    CREATE UNIQUE INDEX [UX_Tenants_Siret_Active] ON [Tenants]([Siret])
        WHERE [Siret] IS NOT NULL AND [Status] NOT IN ('Failed', 'Cancelled');
END");
                // Stripe webhook replay protection : table des événements déjà traités.
                // Stripe rejoue un webhook si le récepteur a renvoyé !=2xx ou timeout 30s.
                // Sans dédoublonnage, on risque de créer deux subscriptions, débloquer
                // deux fois un tenant, etc. On enregistre l'event_id en début de handler
                // et on early-return s'il existe déjà.
                await masterDb.Database.ExecuteSqlRawAsync(@"
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'StripeWebhookSeen')
BEGIN
    CREATE TABLE [StripeWebhookSeen] (
        [EventId]     NVARCHAR(80) NOT NULL CONSTRAINT [PK_StripeWebhookSeen] PRIMARY KEY,
        [EventType]   NVARCHAR(80) NULL,
        [ProcessedAt] DATETIME2    NOT NULL CONSTRAINT [DF_StripeWebhookSeen_ProcessedAt] DEFAULT SYSUTCDATETIME()
    );
    CREATE INDEX [IX_StripeWebhookSeen_ProcessedAt] ON [StripeWebhookSeen]([ProcessedAt]);
END");
                startupLogger.LogInformation("Master DB prête (EnsureCreated).");
            }
        }
        catch (Exception ex)
        {
            startupLogger.LogError(ex, "Échec de l'initialisation de la master DB. L'app démarre quand même mais les signups vont échouer.");
        }
    }

    // 2. Legacy DB (ABRPOINT) : ne plus crasher si elle n'existe pas. En mode SaaS, on ne
    //    devrait pas en avoir besoin — chaque tenant a sa propre base. On loggue et on continue.
    try
    {
        var databaseInitializer = scope.ServiceProvider.GetRequiredService<DatabaseInitializer>();
        await databaseInitializer.InitializeAsync();
    }
    catch (Exception ex)
    {
        startupLogger.LogWarning(ex,
            "Initialisation de la base legacy ignorée (probable absence de la base 'ABRPOINT'). " +
            "OK en mode SaaS multi-tenant : les bases tenants sont créées au signup.");
    }
}

app.UseDefaultFiles();

// Configure the HTTP request pipeline.
if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}
app.UseCors("AllowReactApp");
//app.UseHttpsRedirection();
app.UseAuthentication();

// Tenant resolver (entre Auth et Authorization pour pouvoir lire les claims JWT
// et les comparer au sous-domaine). Activé seulement si MasterConnection est défini.
if (!string.IsNullOrWhiteSpace(masterConnection))
{
    app.UseMiddleware<TenantResolverMiddleware>();
}

app.UseAuthorization();
app.UseRateLimiter();

app.MapControllers();

app.MapFallbackToFile("/index.html");

app.Run();


