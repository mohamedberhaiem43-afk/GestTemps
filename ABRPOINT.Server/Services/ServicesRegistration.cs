using ABRPOINT.Server.CalculService.CalcTotHeures;
using ABRPOINT.Server.CalculService.Conge;
using ABRPOINT.Server.CalculService.HeureAbsences;
using ABRPOINT.Server.CalculService.HeureNuit;
using ABRPOINT.Server.CalculService.HeureRetard;
using ABRPOINT.Server.CalculService.HeureSupp;
using ABRPOINT.Server.Interfaces;
using ABRPOINT.Server.Models;
using ABRPOINT.Server.Repository;

namespace ABRPOINT.Server.Services
{
    public static class ServicesRegistration
    {
        public static void AddServicesRegistration(this WebApplicationBuilder builder)
        {
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
            builder.Services.AddLogging();

        }
    }
}
