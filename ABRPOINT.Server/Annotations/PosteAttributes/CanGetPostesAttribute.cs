namespace ABRPOINT.Server.Annotations.PosteAttributes
{
    public class CanGetPostesAttribute : PermissionAttribute
    {
        public CanGetPostesAttribute() : base("poste", "Consult") { }
    }
}
