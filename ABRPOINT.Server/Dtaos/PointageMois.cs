using ABRPOINT.Server.CalculService.HeureSupp;

namespace ABRPOINT.Server.Dtaos
{
    public class PointageMois
    {
        public DateTime? DateDeb { get; set; }
        public DateTime? DateFin { get; set; }
        public string? EmpCode { get; set; }
        public string? EmpMat { get; set; }
        public string? EmpLib { get; set; }
        public string? EmpReg { get; set; }
        public string? EmpSite { get; set; }
        public List<HeuresSupplementairesResultat> heuresSupplementairesResultats { get; set; } = new List<HeuresSupplementairesResultat>();
    }
}
