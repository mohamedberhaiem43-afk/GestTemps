using ABRPOINT.Server.Annotations;

namespace ABRPOINT.Server.Annotations.CongesAttributes.DemCongeAttributes
{
    public class CanUpdateDemCongeAttribute : PermissionAttribute
    {
        public CanUpdateDemCongeAttribute() : base("dem_conge", "Modify") { }
    }
}
