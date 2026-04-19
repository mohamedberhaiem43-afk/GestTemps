using ABRPOINT.Server.Annotations;

namespace ABRPOINT.Server.Annotations.EtatPointageAttribute
{
    public class CanGetEtatPointageAttribute : PermissionAttribute
    {
        public CanGetEtatPointageAttribute() : base("etat_point", "Consult") { }
    }
}
