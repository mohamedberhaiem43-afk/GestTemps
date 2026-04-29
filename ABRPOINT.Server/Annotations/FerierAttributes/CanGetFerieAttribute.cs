namespace ABRPOINT.Server.Annotations.FerierAttributes
{
    public class CanGetFerieAttribute : PermissionAttribute
    {
        public CanGetFerieAttribute() : base("frm_ferie", "Consult") { }
    }
}
