using ABRPOINT.Server.Annotations;

namespace ABRPOINT.Server.Annotations.EmployeAttributes
{
    public class CanDeleteEmployeAttribute : PermissionAttribute
    {
        public CanDeleteEmployeAttribute() : base("employe", "Delete") { }
    }
}
