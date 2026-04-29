namespace ABRPOINT.Server.Annotations.AllaitementAttributes
{
    public class CanUpdateAllaitementAttribute : PermissionAttribute
    {
        public CanUpdateAllaitementAttribute() : base("emp_allait", "Modify") { }
    }
}
