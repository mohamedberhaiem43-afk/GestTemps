using ABRPOINT.Server.Interfaces;
using ABRPOINT.Server.Repository;

namespace ABRPOINT.Server.Services
{
    public static class InfrastructureRegistration
    {
        public static void AddInfrastructureRegistration(this WebApplicationBuilder builder)
        {
            builder.Services.AddScoped(typeof(IRepository<>), typeof(Repository<>));
        }
    }
}
