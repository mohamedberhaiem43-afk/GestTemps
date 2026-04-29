namespace ABRPOINT.Server.Annotations.AbsenceAttributes
{
    public class CanGetAbsenceAttribute : PermissionAttribute
    {
        public CanGetAbsenceAttribute() : base("absence", "Consult") { }
    }
}
