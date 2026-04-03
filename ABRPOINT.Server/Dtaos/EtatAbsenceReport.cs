namespace ABRPOINT.Server.Dtaos
{
    public class EtatAbsenceReport
    {
        public string? Soclib { get; set; }
        public string? Date { get; set; }
        public string? DateDebut { get; set; }
        public string? DateFin { get; set; }
        public List<EtatAbsenceData>? Data { get; set; }
    }
}
