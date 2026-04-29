namespace ABRPOINT.Server.Annotations.CongesAttributes.CongeAttributes
{
    public class CanDeleteCongeAttribute : PermissionAttribute
    {
        public CanDeleteCongeAttribute() : base("frm_conge", "Delete") { }
    }
}
