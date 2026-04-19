using ABRPOINT.Server.Annotations;

namespace ABRPOINT.Server.Annotations.CongesAttributes.DemCongeAttributes
{
    public class CanAddDemCongeAttribute : PermissionAttribute
    {
        public CanAddDemCongeAttribute() : base("dem_conge", "Add") { }
    }
}
