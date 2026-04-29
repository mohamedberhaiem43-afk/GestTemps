namespace ABRPOINT.Server.Annotations.AbsenceAttributes
{
    public class CanUpdateAbsenceAttribute : PermissionAttribute
    {
        public CanUpdateAbsenceAttribute() : base("absence", "Modify") { }
    }
}
