namespace ABRPOINT.Server.Annotations.PosteAttributes
{
    public class CanAddPosteAttribute : PermissionAttribute
    {
        public CanAddPosteAttribute() : base("poste", "Add") { }
    }
}
