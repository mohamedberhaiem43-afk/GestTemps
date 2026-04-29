namespace ABRPOINT.Server.Annotations.ContratAttributes
{
    public class CanAddContratAttribute : PermissionAttribute
    {
        public CanAddContratAttribute() : base("emp_ctr", "Add") { }
    }
}
