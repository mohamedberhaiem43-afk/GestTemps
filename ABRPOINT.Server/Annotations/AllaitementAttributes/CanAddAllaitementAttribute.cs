namespace ABRPOINT.Server.Annotations.AllaitementAttributes
{
    public class CanAddAllaitementAttribute : PermissionAttribute
    {
        public CanAddAllaitementAttribute() : base("emp_allait", "Add") { }
    }
}
