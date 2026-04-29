namespace ABRPOINT.Server.Annotations.AbsenceAttributes
{
    public class CanDeleteAbsenceAttribute : PermissionAttribute
    {
        public CanDeleteAbsenceAttribute() : base("absence", "Delete") { }
    }
}
