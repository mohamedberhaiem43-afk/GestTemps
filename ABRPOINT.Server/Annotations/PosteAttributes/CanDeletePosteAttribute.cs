namespace ABRPOINT.Server.Annotations.PosteAttributes
{
    public class CanDeletePosteAttribute : PermissionAttribute
    {
        public CanDeletePosteAttribute() : base("poste", "Delete") { }
    }
}
