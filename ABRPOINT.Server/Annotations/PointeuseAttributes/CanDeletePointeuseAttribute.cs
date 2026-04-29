namespace ABRPOINT.Server.Annotations.PointeuseAttributes
{
    public class CanDeletePointeuseAttribute : PermissionAttribute
    {
        public CanDeletePointeuseAttribute() : base("pointeuse", "Delete") { }
    }
}
