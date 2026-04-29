namespace ABRPOINT.Server.Annotations.PosteAttributes
{
    public class CanUpdatePosteAttribute : PermissionAttribute
    {
        public CanUpdatePosteAttribute() : base("poste", "Modify") { }
    }
}
