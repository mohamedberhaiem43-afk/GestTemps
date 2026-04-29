namespace ABRPOINT.Server.Annotations.AbsenceAttributes
{
    public class CanDeleteSanctionAttribute : PermissionAttribute
    {
        public CanDeleteSanctionAttribute() : base("emp_abs", "Delete") { }
    }
}
