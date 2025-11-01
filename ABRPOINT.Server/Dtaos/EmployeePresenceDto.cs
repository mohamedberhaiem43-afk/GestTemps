namespace ABRPOINT.Server.Dtaos
{
    public class EmployeePresenceDto
    {
        public string Empcod { get; set; }
        public string Emplib { get; set; }
        public float? NbJours { get; set; }
        public int TotalMinutes { get; set; }
        public decimal TotalRetards { get; set; }
    }
}
    