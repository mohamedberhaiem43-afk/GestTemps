namespace ABRPOINT.Server.Annotations.AllaitementAttributes
{
    public class CanGetAllaitementAttribute : PermissionAttribute
    {
        public CanGetAllaitementAttribute() : base("emp_allait", "Consult") { }
    }
}
