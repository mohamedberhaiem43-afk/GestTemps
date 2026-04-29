namespace ABRPOINT.Server.Annotations.EtatPriodiqueAttributes
{
    public class CanUpdateEtatPeriodiqueAttribute : PermissionAttribute
    {
        public CanUpdateEtatPeriodiqueAttribute() : base("etat_period", "Modify") { }
    }
}
