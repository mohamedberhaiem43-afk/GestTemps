namespace ABRPOINT.Server.Annotations.AbsenceAttributes
{
    public class CanAddAbsenceAttribute : PermissionAttribute
    {
        public CanAddAbsenceAttribute() : base("absence", "Add") { }
    }
}
