namespace ABRPOINT.Server.Dtaos
{
    public class EtatDetailleRequest
    {
        public string Soccod { get; set; }
        public string Empcod { get; set; }
        public string Emplib { get; set; }
        public string DateDebut { get; set; }
        public string DateFin { get; set; }
        public List<EtatDetailleRow> Rows { get; set; }
    }
}
