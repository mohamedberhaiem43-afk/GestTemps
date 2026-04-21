using ABRPOINT.Mappings;
using ABRPOINT.Server.Data;
using ABRPOINT.Server.Helpers;
using ABRPOINT.Server.Services;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.FileProviders;
using Microsoft.IdentityModel.Tokens;
using System.Text;
using System.Text.Json.Serialization;
using DinkToPdf;
using DinkToPdf.Contracts;


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

builder.Services.AddDbContext<ApplicationDbContext>(options =>
    options.UseSqlServer(
        connectionString,
        sqlOptions => sqlOptions.EnableRetryOnFailure()
    ));

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
app.UseAuthorization();

app.MapControllers();

app.MapFallbackToFile("/index.html");

app.Run();


