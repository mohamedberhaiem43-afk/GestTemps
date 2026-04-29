namespace ABRPOINT.Server.Annotations.AllaitementAttributes
{
    public class CanDeleteAllaitementAttribute : PermissionAttribute
    {
        public CanDeleteAllaitementAttribute() : base("emp_allait", "Delete") { }
    }
}
