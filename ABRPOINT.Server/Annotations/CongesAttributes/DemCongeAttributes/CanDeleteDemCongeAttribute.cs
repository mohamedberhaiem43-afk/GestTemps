using ABRPOINT.Server.Annotations;

namespace ABRPOINT.Server.Annotations.CongesAttributes.DemCongeAttributes
{
    public class CanDeleteDemCongeAttribute : PermissionAttribute
    {
        public CanDeleteDemCongeAttribute() : base("dem_conge", "Delete") { }
    }
}
