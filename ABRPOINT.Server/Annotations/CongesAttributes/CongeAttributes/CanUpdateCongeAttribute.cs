namespace ABRPOINT.Server.Annotations.CongesAttributes.CongeAttributes
{
    public class CanUpdateCongeAttribute : PermissionAttribute
    {
        public CanUpdateCongeAttribute() : base("frm_conge", "Modify") { }
    }
}
