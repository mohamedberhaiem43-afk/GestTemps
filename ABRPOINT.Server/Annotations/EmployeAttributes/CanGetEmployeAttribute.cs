using ABRPOINT.Server.Annotations;

namespace ABRPOINT.Server.Annotations.EmployeAttributes
{
    public class CanGetEmployeAttribute : PermissionAttribute
    {
        public CanGetEmployeAttribute() : base("employe", "Consult") { }
    }
}
