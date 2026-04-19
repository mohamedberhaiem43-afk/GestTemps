using ABRPOINT.Server.Annotations;

namespace ABRPOINT.Server.Annotations.EtatPointageAttribute
{
    public class CanAddEtatPointageAttribute : PermissionAttribute
    {
        public CanAddEtatPointageAttribute() : base("etat_point", "Add") { }
    }
}
