namespace ABRPOINT.Server.Annotations.FerierAttributes
{
    public class CanDeleteFerierAttribute : PermissionAttribute
    {
        public CanDeleteFerierAttribute() : base("frm_ferie", "Delete") { }
    }
}
