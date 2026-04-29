namespace ABRPOINT.Server.Annotations.CongesAttributes.CahierCongeAttributes
{
    public class CanGetCahierCongeAttribute : PermissionAttribute
    {
        public CanGetCahierCongeAttribute() : base("dec_conge", "Consult") { }
    }
}
