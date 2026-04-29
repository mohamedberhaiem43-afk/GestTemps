namespace ABRPOINT.Server.Annotations.ContratAttributes
{
    public class CanUpdateContratAttribute : PermissionAttribute
    {
        public CanUpdateContratAttribute() : base("emp_ctr", "Modify") { }
    }
}
