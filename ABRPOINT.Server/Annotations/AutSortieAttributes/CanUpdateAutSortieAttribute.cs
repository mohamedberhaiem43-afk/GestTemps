namespace ABRPOINT.Server.Annotations.AutSortieAttributes
{
    public class CanUpdateAutSortieAttribute : PermissionAttribute
    {
        public CanUpdateAutSortieAttribute() : base("emp_aut", "Modify") { }
    }
}
