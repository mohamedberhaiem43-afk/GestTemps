namespace ABRPOINT.Server.Annotations.EtatsAttributes
{
    public class CanGetEtatRetardAttribute : PermissionAttribute
    {
        public CanGetEtatRetardAttribute() : base("etat_ret", "Consult") { }
    }
}
