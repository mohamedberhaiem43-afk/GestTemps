namespace ABRPOINT.Server.Annotations.AutSortieAttributes
{
    public class CanDeleteAutSortieAttribute : PermissionAttribute
    {
        public CanDeleteAutSortieAttribute() : base("emp_aut", "Delete") { }
    }
}
