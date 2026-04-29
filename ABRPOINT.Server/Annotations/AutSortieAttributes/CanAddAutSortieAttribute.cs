namespace ABRPOINT.Server.Annotations.AutSortieAttributes
{
    public class CanAddAutSortieAttribute : PermissionAttribute
    {
        public CanAddAutSortieAttribute() : base("emp_aut", "Add") { }
    }
}
