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

// Npgsql 6+ refuse par défaut DateTime(Kind=UTC) → `timestamp without time zone` et
// DateTime(Kind=Local/Unspecified) → `timestamptz`. La codebase historique (migrée
// depuis SQL Server) utilise massivement `timestamp` (sans fuseau) avec des
// DateTime.UtcNow Kind=UTC — convention "UTC stocké en naïf" comme dans le master
// DDL (`NOW() AT TIME ZONE 'UTC'`). Plutôt que de re-typer toutes les colonnes et
// stripper Kind à chaque appel, on réactive le comportement legacy globalement.
// Doc Npgsql : https://www.npgsql.org/doc/types/datetime.html — section "Timestamp
// behavior changes in 6.0". Ce switch DOIT être posé AVANT toute connexion Npgsql.
AppContext.SetSwitch("Npgsql.EnableLegacyTimestampBehavior", true);

var builder = WebApplication.CreateBuilder(args);

// OWASP : ne pas divulguer la version du serveur dans le header "Server".
builder.WebHost.ConfigureKestrel(options => options.AddServerHeader = false);

// Register DinkToPdf (wkhtmltopdf) for HTML→PDF conversion
builder.Services.AddSingleton(typeof(IConverter), new SynchronizedConverter(new PdfTools()));

var dbHost = Environment.GetEnvironmentVariable("DB_HOST") ?? "localhost";
var dbName = Environment.GetEnvironmentVariable("DB_NAME");
var dbPassword = Environment.GetEnvironmentVariable("DB_PASSWORD");
// Postgres : superuser par défaut "postgres". Anciennement "sa" pour SQL Server.
var dbUser = Environment.GetEnvironmentVariable("DB_USER") ?? "postgres";


// Format Npgsql : Host=...;Database=...;Username=...;Password=...
// Plus de TrustServerCertificate (option SQL Server-only). Pour TLS Postgres,
// utiliser "SSL Mode=Require;Trust Server Certificate=True" (espace, pas underscore).
var connectionString = !string.IsNullOrWhiteSpace(dbName) && !string.IsNullOrWhiteSpace(dbPassword)
    ? $"Host={dbHost};Database={dbName};Username={dbUser};Password={dbPassword}"
    : builder.Configuration.GetConnectionString("DefaultConnection")
        ?? throw new InvalidOperationException("A database connection string could not be resolved.");

// ApplicationDbContext registration tenant-aware :
//   - Si un tenant est résolu pour la requête (ICurrentTenant.Current != null), on construit
//     un context bound à la base de ce tenant via le template TenantTemplate.
//   - Sinon (démarrage, signup, master endpoints, ou simplement dev sans tenant), on retombe
//     sur DefaultConnection (= base legacy ABRPOINT). Préserve la compat ascendante.
//
// PERF — Pooling des DbContextOptions par connection string. Avant, chaque requête HTTP
// reconstruisait un `DbContextOptionsBuilder<>` complet (parse de la connection string,
// configuration UseNpgsql, callbacks de retry) — coût mesurable sur ~100 req/s ×
// 50 tenants. Maintenant on cache les `DbContextOptions` finis dans un ConcurrentDictionary
// indexé par connection string : lookup O(1), construction unique par tenant.
var _dbOptionsCache = new System.Collections.Concurrent.ConcurrentDictionary<string, DbContextOptions<ApplicationDbContext>>(StringComparer.Ordinal);
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

    var options = _dbOptionsCache.GetOrAdd(resolvedConnStr, cs =>
        new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseNpgsql(cs, npg => npg.EnableRetryOnFailure())
            .Options);
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
        options.UseNpgsql(masterConnection, npg => npg.EnableRetryOnFailure()));

    builder.Services.AddSingleton<ICurrentTenant, AsyncLocalCurrentTenant>();
    builder.Services.AddScoped<ITenantStore, TenantStore>();
    builder.Services.AddScoped<ITenantDbContextFactory, TenantDbContextFactory>();
    builder.Services.AddScoped<IProvisioningService, ProvisioningService>();
    builder.Services.AddScoped<IBillingService, StripeBillingService>();
    builder.Services.AddScoped<ABRPOINT.Server.Billing.IStorageQuotaGuard, ABRPOINT.Server.Billing.StorageQuotaGuard>();
    builder.Services.AddHostedService<TrialExpirationHostedService>();
    builder.Services.AddHostedService<ABRPOINT.Server.Billing.EmployeeBillingSyncService>();
    builder.Services.AddHostedService<ABRPOINT.Server.Billing.StorageUsageHostedService>();
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

    // SEC — Rate limit dédié à /billing/resume-checkout (endpoint anonyme qui prend
    // email+password et appelle BCrypt.Verify). Sans limite, c'était un canal de
    // brute-force qui contournait le compteur d'échec lié à /Utilisateurs/connect.
    // 5/minute/IP : aligné avec auth-login pour cohérence.
    options.AddPolicy("auth-resume", httpContext =>
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

    // SEC — Endpoint /api/contact/* : envoie un email via SMTP authentifié → abus
    // = blacklist OVH. 5/heure/IP adapté à un usage humain normal (un visiteur ne
    // soumet pas plus de 5 formulaires de contact à l'heure), mais coupe les bots.
    options.AddPolicy("public-form", httpContext =>
    {
        var ip = httpContext.Connection.RemoteIpAddress?.ToString() ?? "anon";
        return System.Threading.RateLimiting.RateLimitPartition.GetFixedWindowLimiter(
            ip,
            _ => new System.Threading.RateLimiting.FixedWindowRateLimiterOptions
            {
                PermitLimit = 5,
                Window = TimeSpan.FromHours(1),
                QueueLimit = 0,
            });
    });

    // SEC — Policy dédiée pour /api/auth/lookup-tenant. Profil d'abus différent
    // de /api/contact : la lookup ne déclenche AUCUNE action coûteuse (pas de mail,
    // pas d'écriture, juste un SELECT indexé) et l'anti-énumération réelle est
    // assurée par la réponse uniforme (le contrôleur renvoie toujours { slug?: … }
    // sans distinguer "trouvé" vs "pas trouvé" côté HTTP). La limite stricte 5/h/IP
    // de l'ancien partage cassait l'UX légitime : un utilisateur derrière un NAT
    // d'entreprise + 2-3 tentatives de login avec mauvais mot de passe + re-login
    // après déconnexion → 429 au bout de quelques minutes. 30/heure/IP couvre
    // largement l'usage humain (incluant les retours après déconnexion et le
    // partage de bureau / NAT) tout en restant un plafond anti-scraping.
    options.AddPolicy("tenant-lookup", httpContext =>
    {
        var ip = httpContext.Connection.RemoteIpAddress?.ToString() ?? "anon";
        return System.Threading.RateLimiting.RateLimitPartition.GetFixedWindowLimiter(
            ip,
            _ => new System.Threading.RateLimiting.FixedWindowRateLimiterOptions
            {
                PermitLimit = 30,
                Window = TimeSpan.FromHours(1),
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
//
// Plan de durcissement CSP nonce-based (à planifier en sprint dédié, ~1-2j) :
//   1. Middleware : générer un nonce CSPRNG par requête (RandomNumberGenerator.GetBytes(16)),
//      le stocker dans HttpContext.Items["csp-nonce"].
//   2. MapFallbackToFile : remplacer le simple sendFile par un endpoint custom qui lit
//      index.html, injecte le nonce dans tous les <script>/<link rel="stylesheet"> et le
//      header CSP correspondant.
//   3. Vite : configurer `build.rollupOptions.output.entryFileNames` + injecter le nonce
//      via un plugin (vite-plugin-csp) lors du build.
//   4. Emotion (MUI) : configurer `createCache({ nonce: <nonce> })` dans main.tsx en lisant
//      le nonce depuis un <meta name="csp-nonce"> injecté par le serveur.
//   5. Tester : recharts et @fullcalendar utilisent souvent eval/Function() à la volée. Si
//      du JS dynamique persiste, garder 'wasm-unsafe-eval' (ciblé) plutôt que 'unsafe-eval'.
//
// HSTS (Strict-Transport-Security) ajouté en PROD uniquement : déclarer un max-age
// non nul sur un dev local en HTTP bloquerait le navigateur sur HTTPS pour la durée
// du cache, empêchant le retour à HTTP. En dev on omet le header.
// ─────────────────────────────────────────────────────────────────────────────
var isProd = app.Environment.IsProduction();
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
                "frame-ancestors 'none'",
                "form-action 'self'",
                "base-uri 'self'",
                "object-src 'none'"
            });
        }
        if (!h.ContainsKey("X-Content-Type-Options")) h["X-Content-Type-Options"] = "nosniff";
        // frame-ancestors 'none' (CSP) couvre déjà X-Frame-Options sur les navigateurs
        // modernes, mais on garde DENY explicite pour les vieux clients/proxies.
        if (!h.ContainsKey("X-Frame-Options")) h["X-Frame-Options"] = "DENY";
        if (!h.ContainsKey("Referrer-Policy")) h["Referrer-Policy"] = "strict-origin-when-cross-origin";
        if (!h.ContainsKey("Permissions-Policy")) h["Permissions-Policy"] = "geolocation=(self), camera=(self), microphone=()";
        // SEC — HSTS uniquement en prod (cf. note plus haut). max-age 1 an + sub-domains
        // pour couvrir les sous-domaines tenants (<slug>.concorde.com).
        if (isProd && !h.ContainsKey("Strict-Transport-Security"))
            h["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains";
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

// SEC — /api/uploads n'est PLUS servi en static files. Tout passe par
// UploadsController qui exige [Authorize] et applique des checks anti
// path-traversal. Sans ce changement, n'importe qui connaissant le GUID
// d'un bulletin de paie/contrat pouvait le télécharger publiquement.
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
                //
                // Migré T-SQL → PostgreSQL : CREATE TABLE IF NOT EXISTS / ADD COLUMN IF NOT EXISTS /
                // CREATE INDEX IF NOT EXISTS sont natifs et idempotents — plus besoin de wrap dans
                // un IF NOT EXISTS (SELECT ... sys.*) BEGIN ... END.
                //
                // Notes nommage :
                //   - PG folde les identifiants non-quoted en lowercase. Pour conserver la casse
                //     PascalCase historique (TenantEmailIndex, Tenants), on entoure de "double quotes".
                //   - Les noms de contraintes (DF_*, PK_*) ne sont pas reproduits : PG nomme
                //     automatiquement les contraintes anonymes — c'est suffisant ici.
                await masterDb.Database.ExecuteSqlRawAsync(@"
CREATE TABLE IF NOT EXISTS ""TenantEmailIndex"" (
    ""Email""     VARCHAR(255) NOT NULL PRIMARY KEY,
    ""Slug""      VARCHAR(30)  NOT NULL,
    ""CreatedAt"" TIMESTAMP    NOT NULL DEFAULT (NOW() AT TIME ZONE 'UTC')
);
CREATE INDEX IF NOT EXISTS ""IX_TenantEmailIndex_Slug"" ON ""TenantEmailIndex""(""Slug"");");

                // PlanCode ajouté post-déploiement : idempotent.
                await masterDb.Database.ExecuteSqlRawAsync(
                    "ALTER TABLE \"Tenants\" ADD COLUMN IF NOT EXISTS \"PlanCode\" VARCHAR(20) NULL;");
                // TrialReminderSentAt : flag horodaté servant d'anti-doublon pour le rappel J-4.
                await masterDb.Database.ExecuteSqlRawAsync(
                    "ALTER TABLE \"Tenants\" ADD COLUMN IF NOT EXISTS \"TrialReminderSentAt\" TIMESTAMP NULL;");
                // Résiliation : 3 colonnes ajoutées en 2026-05 pour gérer le flow "annuler mon
                // abonnement" (immédiat ou en fin de période courante). Idempotents.
                await masterDb.Database.ExecuteSqlRawAsync(@"
ALTER TABLE ""Tenants"" ADD COLUMN IF NOT EXISTS ""CancellationRequestedAt"" TIMESTAMP NULL;
ALTER TABLE ""Tenants"" ADD COLUMN IF NOT EXISTS ""CancelAtPeriodEnd""       BOOLEAN   NOT NULL DEFAULT FALSE;
ALTER TABLE ""Tenants"" ADD COLUMN IF NOT EXISTS ""CurrentPeriodEndsAt""     TIMESTAMP NULL;");
                // Migration 2026-05 : rename commercial Essentiel → Starter.
                await masterDb.Database.ExecuteSqlRawAsync(
                    "UPDATE \"Tenants\" SET \"PlanCode\" = 'Starter' WHERE \"PlanCode\" = 'Essentiel';");
                // SIRET anti-fraude (2026-05) : colonne nullable + index filtré unique pour
                // empêcher qu'un même SIRET souscrive plusieurs essais gratuits.
                await masterDb.Database.ExecuteSqlRawAsync(
                    "ALTER TABLE \"Tenants\" ADD COLUMN IF NOT EXISTS \"Siret\" VARCHAR(20) NULL;");
                // Multi-pays (2026-05) : élargit Siret historique 14→20 chars. PG : ALTER COLUMN
                // TYPE est idempotent quand la cible est déjà la bonne taille → safe à rejouer.
                await masterDb.Database.ExecuteSqlRawAsync(
                    "ALTER TABLE \"Tenants\" ALTER COLUMN \"Siret\" TYPE VARCHAR(20);");
                await masterDb.Database.ExecuteSqlRawAsync(
                    "ALTER TABLE \"Tenants\" ADD COLUMN IF NOT EXISTS \"CountryCode\" VARCHAR(2) NULL;");
                await masterDb.Database.ExecuteSqlRawAsync(
                    "CREATE INDEX IF NOT EXISTS \"IX_Tenants_Siret\" ON \"Tenants\"(\"Siret\");");
                // Index filtré unique : PG accepte le NOT IN dans WHERE des partial indexes
                // (contrairement à SQL Server qui le refuse — d'où l'éclatement en deux <>
                // dans l'ancienne version). On peut donc revenir à un NOT IN plus lisible.
                await masterDb.Database.ExecuteSqlRawAsync(@"
CREATE UNIQUE INDEX IF NOT EXISTS ""UX_Tenants_Siret_Active"" ON ""Tenants""(""Siret"")
    WHERE ""Siret"" IS NOT NULL AND ""Status"" NOT IN ('Failed', 'Cancelled');");
                // Stripe webhook replay protection : table des événements déjà traités.
                await masterDb.Database.ExecuteSqlRawAsync(@"
CREATE TABLE IF NOT EXISTS ""StripeWebhookSeen"" (
    ""EventId""     VARCHAR(80) NOT NULL PRIMARY KEY,
    ""EventType""   VARCHAR(80) NULL,
    ""ProcessedAt"" TIMESTAMP   NOT NULL DEFAULT (NOW() AT TIME ZONE 'UTC')
);
CREATE INDEX IF NOT EXISTS ""IX_StripeWebhookSeen_ProcessedAt"" ON ""StripeWebhookSeen""(""ProcessedAt"");");
                // Quota stockage par tenant (2026-05). Deux colonnes nullables/0-default ⇒
                // safe à déployer sur une master DB existante. Le quota lui-même n'est PAS
                // stocké (dérivé de PlanCode via PlanCatalog.GetStorageQuotaMb), ce qui évite
                // toute désync quand on change le pack d'un tenant.
                await masterDb.Database.ExecuteSqlRawAsync(@"
ALTER TABLE ""Tenants"" ADD COLUMN IF NOT EXISTS ""StorageUsedMb""        BIGINT    NOT NULL DEFAULT 0;
ALTER TABLE ""Tenants"" ADD COLUMN IF NOT EXISTS ""StorageUsageCheckedAt"" TIMESTAMP NULL;");
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

// SEC — Handler global d'exception : intercepte tout ce qui remonte sans avoir été
// capturé par un controller, logue côté serveur avec le TraceIdentifier, et renvoie
// au client une réponse 500 générique + correlationId (pas de stack trace ni de
// `ex.Message` SQL/EF). Doit être placé tôt dans le pipeline pour couvrir un max
// de middlewares.
app.UseMiddleware<ABRPOINT.Server.Middleware.GlobalExceptionHandler>();

// Configure the HTTP request pipeline.
if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}
app.UseCors("AllowReactApp");
// SEC — Redirige HTTP → HTTPS uniquement en prod. En dev, Kestrel sert souvent
// en HTTP local (http://localhost:xxxx) et le redirect casserait le flow. Doit
// rester aligné avec HSTS (cf. headers ci-dessus) — les deux sont prod-only.
if (isProd)
{
    app.UseHttpsRedirection();
}
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


