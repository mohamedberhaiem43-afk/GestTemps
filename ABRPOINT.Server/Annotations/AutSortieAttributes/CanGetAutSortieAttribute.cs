namespace ABRPOINT.Server.Annotations.AutSortieAttributes
{
    public class CanGetAutSortieAttribute : PermissionAttribute
    {
        public CanGetAutSortieAttribute() : base("emp_aut", "Consult") { }
    }
}
