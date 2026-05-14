using ABRPOINT.Server.CalculService;
using ABRPOINT.Server.CalculService.CalcTotHeures;
using ABRPOINT.Server.CalculService.Conge;
using ABRPOINT.Server.CalculService.DashboardService;
using ABRPOINT.Server.CalculService.HeureAbsences;
using ABRPOINT.Server.CalculService.HeureNuit;
using ABRPOINT.Server.CalculService.HeureRetard;
using ABRPOINT.Server.CalculService.HeureSupp;
using ABRPOINT.Server.Interfaces;
using ABRPOINT.Server.Models;
using ABRPOINT.Server.Repository;
using ABRPOINT.Server.Services.Rag;
using Microsoft.Extensions.Http.Resilience;
using Microsoft.SemanticKernel;

namespace ABRPOINT.Server.Services
{
    public static class ServicesRegistration
    {
        public static void AddServicesRegistration(this WebApplicationBuilder builder)
        {
            builder.Services.AddScoped<IPointageMoisService, PointageMoisService>();
            builder.Services.AddScoped<IDashboardService, DashboardService>();
            builder.Services.AddScoped<PointagePlugin>();
            builder.Services.AddScoped<PresencePlugin>();
            builder.Services.AddScoped<IOptimizedPresenceService, OptimizedPresenceService>();
            builder.Services.AddScoped<IPointageOptimizerService, PointageOptimizer>();
            builder.Services.AddScoped<IPointeuseHttpService, PointeuseHttpService>();
            builder.Services.AddScoped<IPointdroitRepository, PointdroitRepository>();
            builder.Services.AddScoped<IDirectionRepository, DirectionRepository>();
            builder.Services.AddScoped<IServiceRepository, ServiceRepository>();
            builder.Services.AddScoped<ISectionRepository, SectionRepository>();
            builder.Services.AddScoped<IVilleRepository, VilleRepository>();
            builder.Services.AddScoped<IPaysRepoistory, PaysRepository>();
            builder.Services.AddScoped<IQualifRepository, QualifRepositroy>();
            builder.Services.AddScoped<ISocieteRepository, SocieteRepository>();
            builder.Services.AddScoped<ISiteRepository, SiteRepository>();
            builder.Services.AddScoped<IFonctionRepository, FonctionRepository>();
            builder.Services.AddScoped<IEmployeRepository, EmployeRepository>();
            builder.Services.AddScoped<IAllaitementRepository, AllaitementRepository>();
            builder.Services.AddScoped<IContratRepository, ContratRepository>();
            builder.Services.AddScoped<IDemCongeRepository, DemCongeRepository>();
            builder.Services.AddScoped<ICongeRepository, CongeRepository>();
            builder.Services.AddScoped<IUtilisateurRepository, UtilisateurRepository>();
            builder.Services.AddScoped<IAbscenceRepository, AbsenceRepository>();
            builder.Services.AddScoped<IJourFerieRepository, JourFerieRepository>();
            builder.Services.AddScoped<ISoldeCongeRepository, SoldeCongeRepository>();
            builder.Services.AddScoped<ILcategorieRepository, LcategorieRepository>();
            builder.Services.AddScoped<IcompenserRepository, CompenserRepository>();
            builder.Services.AddScoped<IautoriserRepository, AutoriserRepository>();
            builder.Services.AddScoped<ISanctionRepository, SanctionRepository>();
            builder.Services.AddScoped<IPointeuseRepository, PointeuseRepository>();
            builder.Services.AddScoped<IlposteRepository, LposteRepository>();
            builder.Services.AddScoped<IPosteRepository, PosteRepository>();
            builder.Services.AddScoped<ICalendrierRepository, CalendrierRepository>();
            builder.Services.AddScoped<IAttendanceService, AttendaceRepository>();
            builder.Services.AddScoped<IPresenceRepository, PresenceRepository>();
            builder.Services.AddScoped<IAvanceRepository, AvanceRepository>();
            builder.Services.AddScoped<IParametreRepository, ParametreRepository>();
            builder.Services.AddScoped<IRubriqueService, RubriqueService>();
            builder.Services.AddScoped<IHeureNuitService, HeureNuitService>();
            builder.Services.AddScoped<IHeureSuppService, HeureSuppSerivce>();
            builder.Services.AddScoped<ICalcTotHeuresService, CalcTotHeuresService>();
            builder.Services.AddScoped<IHeureRetardService, HeureRetardService>();
            builder.Services.AddScoped<IHeureAbsencesService, HeureAbsencesService>();
            builder.Services.AddScoped<IparTrancheRepository, ParTrancheRepository>();
            builder.Services.AddScoped<IReportsGenerationService, ReportsGenerationService>();
            builder.Services.AddScoped<ICongeCalculationService, CongeCalculationService>();
            builder.Services.AddScoped<ABRPOINT.Server.CalculService.Rtt.IRttCalculationService, ABRPOINT.Server.CalculService.Rtt.RttCalculationService>();
            builder.Services.AddScoped<IHeuresSupplementaireHebdomadairesService, HeuresSupplementairesHebdomadairesService>();
            builder.Services.AddScoped<IDmpointService, DmpointService>();
            builder.Services.AddScoped<IModuleRepository, ModuleRepository>();
            builder.Services.AddScoped<IModuserRepository, ModuserRepository>();
            builder.Services.AddScoped<INoteDeFraisRepository, NoteDeFraisRepository>();
            builder.Services.AddScoped<IMissionRepository, MissionRepository>();
            builder.Services.AddScoped<IVaultRepository, VaultRepository>();
            builder.Services.AddScoped<IDemandeAutorisationRepository, DemandeAutorisationRepository>();
            // Resolver centralisé des droits site par utilisateur (table Socuser).
            // Utilisé par tous les controllers qui doivent filtrer par sitcod.
            builder.Services.AddScoped<ISiteAccessService, SiteAccessService>();
            builder.Services.AddScoped<IAiService, AiService>();
            builder.Services.AddScoped<EncryptionService>();
            // SEC — Protecteur dédié aux secrets TOTP (2FA). Clé dérivée HKDF de
            // Encryption:AesKey, indépendante du chiffrement PII général.
            builder.Services.AddSingleton<TwoFactorSecretProtector>();
            builder.Services.AddScoped<Kernel>(sp =>
            {
                var kernelBuilder = Kernel.CreateBuilder();

                // Créer d'abord le kernel pour pouvoir le passer au GeminiPlugin
                var tempKernel = kernelBuilder.Build();
                // Plugin Gemini utilisant OpenRouter API
                var httpClientFactory = sp.GetRequiredService<IHttpClientFactory>();
                var config = sp.GetRequiredService<IConfiguration>();
                var openRouterApiKey = config["OpenRouter:ApiKey"];
                var openRouterModel = config["OpenRouter:ChatModel"] ?? "google/gemini-2.0-flash-001";

                kernelBuilder.Plugins.AddFromObject(
                    new GeminiPlugin(httpClientFactory, openRouterApiKey, openRouterModel, tempKernel),
                    "Gemini"
                );

                // Plugin Pointage
                var pointagePlugin = sp.GetRequiredService<PointagePlugin>();
                kernelBuilder.Plugins.AddFromObject(pointagePlugin, "Pointage");
                var presencePlugin = sp.GetRequiredService<PresencePlugin>();
                kernelBuilder.Plugins.AddFromObject(presencePlugin, "Presence");
                return kernelBuilder.Build();
            });

            builder.Services.AddScoped<IEmailService, EmailService>();
            // Detection de nouveau device au login + alerte email. Scoped car dépend
            // d'ApplicationDbContext (tenant courant).
            builder.Services.AddScoped<IKnownDeviceService, KnownDeviceService>();
            // Tokens HMAC stateless pour le lien "Ce n'était pas moi" dans les alertes
            // nouvelle-connexion. Singleton car aucune dépendance scoped, et garde un
            // accès partagé au IMemoryCache de single-use anti-replay.
            builder.Services.AddSingleton<ISuspiciousLoginTokenService, SuspiciousLoginTokenService>();
            builder.Services.AddLogging();

            // Validator entreprise multi-pays (anti-fraude inscription). Le service utilise
            // IHttpClientFactory pour disposer de plusieurs HttpClient nommés — un par API
            // externe. Tous les appels sont fail-open : si l'API tombe, on tombe sur la
            // validation locale + l'unicité DB qui restent les garde-fous solides.
            builder.Services.AddHttpClient(SiretValidator.SireneClientName, http =>
            {
                // 🇫🇷 recherche-entreprises.api.gouv.fr — API gouvernementale gratuite, sans auth.
                http.BaseAddress = new Uri("https://recherche-entreprises.api.gouv.fr/");
                http.Timeout = TimeSpan.FromSeconds(5);
                http.DefaultRequestHeaders.UserAgent.ParseAdd("ConcordeWorkforce-Signup/1.0");
            });
            builder.Services.AddHttpClient(SiretValidator.CbeClientName, http =>
            {
                // 🇧🇪 cbeapi.be — API payante (clé via Cbe:ApiKey config). Bearer auth.
                // Le bearer est ajouté par requête (pas DefaultRequestHeaders) pour permettre
                // le hot-reload de la clé via IConfiguration sans recréer l'HttpClient.
                http.BaseAddress = new Uri("https://cbeapi.be/");
                http.Timeout = TimeSpan.FromSeconds(5);
                http.DefaultRequestHeaders.UserAgent.ParseAdd("ConcordeWorkforce-Signup/1.0");
            });
            builder.Services.AddHttpClient(SiretValidator.ViesClientName, http =>
            {
                // 🇧🇪🇪🇺 VIES — service officiel EU de vérification VAT, gratuit, sans clé.
                // Pour la Belgique, le numéro BCE EST le numéro TVA (10 chiffres, commence
                // par 0). VIES renvoie nom + adresse de l'entreprise, exactement comme
                // Sirene pour la France. Utilisé en fallback si Cbe:ApiKey n'est pas
                // configuré → parité fonctionnelle FR/BE sans dépendre du service payant.
                http.BaseAddress = new Uri("https://ec.europa.eu/taxation_customs/vies/rest-api/");
                http.Timeout = TimeSpan.FromSeconds(6);
                http.DefaultRequestHeaders.UserAgent.ParseAdd("ConcordeWorkforce-Signup/1.0");
            });
            builder.Services.AddScoped<ISiretValidator, SiretValidator>();

            // HIBP Pwned Passwords (k-anonymity) : refuse les mots de passe déjà connus
            // dans des fuites publiques. Gratuit, sans auth. Timeout court + fail-open
            // pour ne pas bloquer le signup légitime si l'API tombe.
            builder.Services.AddHttpClient<IPasswordBreachChecker, PasswordBreachChecker>(http =>
            {
                http.BaseAddress = new Uri("https://api.pwnedpasswords.com/");
                http.Timeout = TimeSpan.FromSeconds(3);
                http.DefaultRequestHeaders.UserAgent.ParseAdd("ConcordeWorkforce-Signup/1.0");
            });

            // RAG : façade HTTP vers le sidecar Python rag-svc.
            // Auth par header partagé X-Sidecar-Key + résilience Polly v8 (retry + circuit breaker).
            builder.Services.Configure<RagOptions>(builder.Configuration.GetSection("Rag"));
            builder.Services
                .AddHttpClient<IRagSidecarService, RagSidecarService>((sp, http) =>
                {
                    var opts = sp.GetRequiredService<Microsoft.Extensions.Options.IOptions<RagOptions>>().Value;
                    var baseUrl = opts.Sidecar.BaseUrl.TrimEnd('/') + "/";
                    http.BaseAddress = new Uri(baseUrl);
                    http.Timeout = TimeSpan.FromSeconds(Math.Max(10, opts.Sidecar.TimeoutSeconds));
                    if (!string.IsNullOrEmpty(opts.Sidecar.ApiKey))
                    {
                        http.DefaultRequestHeaders.Add("X-Sidecar-Key", opts.Sidecar.ApiKey);
                    }
                })
                .AddStandardResilienceHandler(o =>
                {
                    // Le timeout total doit accommoder l'ingestion d'un PDF lourd ; le retry interne
                    // ne réessaie pas une ingestion réussie côté Python (idempotence assurée par
                    // upsert Qdrant sur la clé document_id+chunk_idx).
                    // Polly v8 exige : SamplingDuration >= 2 × AttemptTimeout, et
                    // TotalRequestTimeout >= AttemptTimeout. On laisse une marge confortable
                    // pour absorber l'ingestion d'un PDF lourd (chunking + embeddings côté Python).
                    o.AttemptTimeout.Timeout = TimeSpan.FromSeconds(60);
                    o.TotalRequestTimeout.Timeout = TimeSpan.FromSeconds(180);
                    o.CircuitBreaker.SamplingDuration = TimeSpan.FromSeconds(180);
                    // Sidecar sur le LAN Docker : un "Connection refused" veut dire que
                    // rag-svc n'est pas démarré. Inutile d'enchaîner 3 retries — on limite
                    // à 1 pour couper le bruit en logs et accélérer l'échec.
                    o.Retry.MaxRetryAttempts = 1;
                });

            builder.Services.AddScoped<IDocumentVaultService, DocumentVaultService>();
            builder.Services.AddScoped<IDocumentIngestionService, DocumentIngestionService>();
            builder.Services.AddScoped<ILetterGenerationService, LetterGenerationService>();

            // ClaudeRagService a son propre HttpClient (timeout long pour la génération).
            // Polly standard ajoute retry + circuit breaker. La clé Anthropic est dans RagOptions
            // et ajoutée via header x-api-key au moment de l'appel (pas en DefaultRequestHeaders
            // pour éviter de fuiter dans des logs HttpClient verbose).
            builder.Services
                .AddHttpClient<IClaudeRagService, ClaudeRagService>((sp, http) =>
                {
                    http.Timeout = TimeSpan.FromSeconds(120);
                })
                .AddStandardResilienceHandler(o =>
                {
                    // Polly v8 exige : SamplingDuration >= 2 × AttemptTimeout, et
                    // TotalRequestTimeout >= AttemptTimeout. On laisse une marge confortable
                    // pour absorber l'ingestion d'un PDF lourd (chunking + embeddings côté Python).
                    o.AttemptTimeout.Timeout = TimeSpan.FromSeconds(60);
                    o.TotalRequestTimeout.Timeout = TimeSpan.FromSeconds(180);
                    o.CircuitBreaker.SamplingDuration = TimeSpan.FromSeconds(180);
                });
        }
    }
}
