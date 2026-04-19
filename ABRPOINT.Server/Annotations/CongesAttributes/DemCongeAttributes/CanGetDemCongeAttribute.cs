using ABRPOINT.Server.Annotations;

namespace ABRPOINT.Server.Annotations.CongesAttributes.DemCongeAttributes
{
    public class CanGetDemCongeAttribute : PermissionAttribute
    {
        public CanGetDemCongeAttribute() : base("dem_conge", "Consult") { }
    }
}
