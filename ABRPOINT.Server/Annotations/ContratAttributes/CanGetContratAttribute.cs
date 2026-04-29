namespace ABRPOINT.Server.Annotations.ContratAttributes
{
    public class CanGetContratAttribute : PermissionAttribute
    {
        public CanGetContratAttribute() : base("emp_ctr", "Consult") { }
    }
}
