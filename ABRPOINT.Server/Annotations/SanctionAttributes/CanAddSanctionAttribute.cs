namespace ABRPOINT.Server.Annotations.AbsenceAttributes
{
    public class CanAddSanctionAttribute : PermissionAttribute
    {
        public CanAddSanctionAttribute() : base("emp_abs", "Add") { }
    }
}
