using ABRPOINT.Server.Annotations;

namespace ABRPOINT.Server.Annotations.EmployeAttributes
{
    public class CanUpdatetEmployeAttribute : PermissionAttribute
    {
        public CanUpdatetEmployeAttribute() : base("employe", "Modify") { }
    }
}
