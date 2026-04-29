namespace ABRPOINT.Server.Annotations.FerierAttributes
{
    public class CanUpdateFerieAttribute : PermissionAttribute
    {
        public CanUpdateFerieAttribute() : base("frm_ferie", "Modify") { }
    }
}
