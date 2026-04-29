namespace ABRPOINT.Server.Annotations.CongesAttributes.CongeAttributes
{
    public class CanGetCongeAttribute : PermissionAttribute
    {
        public CanGetCongeAttribute() : base("frm_conge", "Consult") { }
    }
}
