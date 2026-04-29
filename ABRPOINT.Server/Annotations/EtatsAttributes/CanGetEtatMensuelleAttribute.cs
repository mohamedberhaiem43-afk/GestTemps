namespace ABRPOINT.Server.Annotations.EtatsAttributes
{
    public class CanGetEtatMensuelleAttribute : PermissionAttribute
    {
        public CanGetEtatMensuelleAttribute() : base("etat_mens", "Consult") { }
    }
}
