namespace ABRPOINT.Server.Annotations.ContratAttributes
{
    public class CanDeleteContratAttribute : PermissionAttribute
    {
        public CanDeleteContratAttribute() : base("emp_ctr", "Delete") { }
    }
}
