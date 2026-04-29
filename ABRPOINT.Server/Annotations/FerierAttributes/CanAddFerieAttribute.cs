namespace ABRPOINT.Server.Annotations.FerierAttributes
{
    public class CanAddFerieAttribute : PermissionAttribute
    {
        public CanAddFerieAttribute() : base("frm_ferie", "Add") { }
    }
}
