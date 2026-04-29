namespace ABRPOINT.Server.Annotations.PointeuseAttributes
{
    public class CanGetPointeuseAttribute : PermissionAttribute
    {
        public CanGetPointeuseAttribute() : base("pointeuse", "Consult") { }
    }
}
