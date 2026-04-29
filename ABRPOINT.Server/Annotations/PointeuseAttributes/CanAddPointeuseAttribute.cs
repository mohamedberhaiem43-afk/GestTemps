namespace ABRPOINT.Server.Annotations.FerierAttributes
{
    public class CanAddPointeuseAttribute : PermissionAttribute
    {
        public CanAddPointeuseAttribute() : base("pointeuse", "Add") { }
    }
}
