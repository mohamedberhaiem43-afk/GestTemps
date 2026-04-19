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
            builder.Services.AddScoped<IHeuresSupplementaireHebdomadairesService, HeuresSupplementairesHebdomadairesService>();
            builder.Services.AddScoped<IDmpointService, DmpointService>();
            builder.Services.AddScoped<IModuleRepository, ModuleRepository>();
            builder.Services.AddScoped<IModuserRepository, ModuserRepository>();
            builder.Services.AddScoped<INoteDeFraisRepository, NoteDeFraisRepository>();
            builder.Services.AddScoped<IVaultRepository, VaultRepository>();
            builder.Services.AddScoped<IDemandeAutorisationRepository, DemandeAutorisationRepository>();
            builder.Services.AddScoped<IAiService, AiService>();
            builder.Services.AddScoped<EncryptionService>();
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

            builder.Services.AddLogging();

        }
    }
}
