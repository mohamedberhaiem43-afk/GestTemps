namespace ABRPOINT.Server.Annotations.EtatsAttributes
{
    public class CanGetEcheanceContratAttribute : PermissionAttribute
    {
        public CanGetEcheanceContratAttribute() : base("ech_ctr", "Consult") { }
    }
}
