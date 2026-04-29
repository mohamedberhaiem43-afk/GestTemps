namespace ABRPOINT.Server.Annotations.PointeuseAttributes
{
    public class CanUpdatePointeuseAttribute : PermissionAttribute
    {
        public CanUpdatePointeuseAttribute() : base("pointeuse", "Modify") { }
    }
}
