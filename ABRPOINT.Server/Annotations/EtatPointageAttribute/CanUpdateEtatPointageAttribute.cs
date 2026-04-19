using ABRPOINT.Server.Annotations;

namespace ABRPOINT.Server.Annotations.EtatPointageAttribute
{
    public class CanUpdateEtatPointageAttribute : PermissionAttribute
    {
        public CanUpdateEtatPointageAttribute() : base("etat_point", "Modify") { }
    }
}
