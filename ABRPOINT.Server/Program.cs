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
builder.Services.AddSingleton<ABRPOINT.Server.Services.IGeoZoneValidator, ABRPOINT.Server.Services.GeoZoneValidator>();

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

// Add CORS service
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowAll", policy =>
    {
        policy.AllowAnyOrigin()
            .AllowAnyHeader()
            .AllowAnyMethod();
    });

    options.AddPolicy("AllowReactApp", policy =>
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
    });
});

var app = builder.Build();

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


