using ABRPOINT.Server.Annotations;

namespace ABRPOINT.Server.Annotations.EmployeAttributes
{
    public class CanAddEmployeAttribute : PermissionAttribute
    {
        public CanAddEmployeAttribute() : base("employe", "Add") { }
    }
}
