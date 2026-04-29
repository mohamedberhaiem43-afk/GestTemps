namespace ABRPOINT.Server.Annotations.EtatsAttributes
{
    public class CanGetEtatAbsenceAttribute : PermissionAttribute
    {
        public CanGetEtatAbsenceAttribute() : base("etat_abs", "Consult") { }
    }
}
