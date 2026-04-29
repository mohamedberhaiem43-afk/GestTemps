namespace ABRPOINT.Server.Annotations.CongesAttributes.CongeAttributes
{
    public class CanAddCongeGeneralAttribute : PermissionAttribute
    {
        public CanAddCongeGeneralAttribute() : base("tout_conge", "Add") { }
    }
}
