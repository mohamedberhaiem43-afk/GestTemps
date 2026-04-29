namespace ABRPOINT.Server.Annotations.EtatPriodiqueAttributes
{
    public class CanAddEtatPeriodiqueAttribute : PermissionAttribute
    {
        public CanAddEtatPeriodiqueAttribute() : base("etat_period", "Add") { }
    }
}
