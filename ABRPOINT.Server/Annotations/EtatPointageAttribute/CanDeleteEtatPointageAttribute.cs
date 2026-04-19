using ABRPOINT.Server.Annotations;

namespace ABRPOINT.Server.Annotations.EtatPointageAttribute
{
    public class CanDeleteEtatPointageAttribute : PermissionAttribute
    {
        public CanDeleteEtatPointageAttribute() : base("etat_point", "Delete") { }
    }
}
