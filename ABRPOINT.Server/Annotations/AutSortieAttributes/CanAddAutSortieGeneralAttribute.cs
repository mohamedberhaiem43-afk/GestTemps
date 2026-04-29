namespace ABRPOINT.Server.Annotations.AutSortieAttributes
{
    public class CanAddAutSortieGeneralAttribute : PermissionAttribute
    {
        public CanAddAutSortieGeneralAttribute() : base("tout_auto", "Add") { }
    }
}
