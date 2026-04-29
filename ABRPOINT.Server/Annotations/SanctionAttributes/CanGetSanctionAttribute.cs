namespace ABRPOINT.Server.Annotations.AbsenceAttributes
{
    public class CanGetSanctionAttribute : PermissionAttribute
    {
        public CanGetSanctionAttribute() : base("emp_abs", "Consult") { }
    }
}
