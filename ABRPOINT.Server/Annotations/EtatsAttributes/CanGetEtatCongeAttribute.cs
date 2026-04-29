namespace ABRPOINT.Server.Annotations.EtatsAttributes
{
    public class CanGetEtatCongeAttribute : PermissionAttribute
    {
        public CanGetEtatCongeAttribute() : base("etat_conge", "Consult") { }
    }
}
