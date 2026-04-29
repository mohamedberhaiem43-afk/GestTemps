namespace ABRPOINT.Server.Annotations.CongesAttributes.CongeAttributes
{
    public class CanAddCongeAttribute : PermissionAttribute
    {
        public CanAddCongeAttribute() : base("frm_conge", "Add") { }
    }
}
