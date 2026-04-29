namespace ABRPOINT.Server.Annotations.AbsenceAttributes
{
    public class CanUpdateSanctionAttribute : PermissionAttribute
    {
        public CanUpdateSanctionAttribute() : base("emp_abs", "Modify") { }
    }
}
