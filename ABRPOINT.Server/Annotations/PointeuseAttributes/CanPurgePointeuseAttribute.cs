namespace ABRPOINT.Server.Annotations.PointeuseAttributes
{
    public class CanPurgePointeuseAttribute : PermissionAttribute
    {
        public CanPurgePointeuseAttribute() : base("ppimp", "Delete") { }
    }
}
