namespace ABRPOINT.Server.Annotations.EtatPriodiqueAttributes
{
    public class CanDeleteEtatPeriodiqueAttribute : PermissionAttribute
    {
        public CanDeleteEtatPeriodiqueAttribute() : base("etat_period", "Delete") { }
    }
}
