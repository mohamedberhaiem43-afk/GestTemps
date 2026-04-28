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
    var databaseInitializer = scope.ServiceProvider.GetRequiredService<DatabaseInitializer>();
    await databaseInitializer.InitializeAsync();
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

app.MapControllers();

app.MapFallbackToFile("/index.html");

app.Run();


