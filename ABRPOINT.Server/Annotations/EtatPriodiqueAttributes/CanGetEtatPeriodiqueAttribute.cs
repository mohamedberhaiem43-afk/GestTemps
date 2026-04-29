namespace ABRPOINT.Server.Annotations.EtatPriodiqueAttributes
{
    public class CanGetEtatPeriodiqueAttribute : PermissionAttribute
    {
        public CanGetEtatPeriodiqueAttribute() : base("etat_period", "Consult") { }
    }
}
