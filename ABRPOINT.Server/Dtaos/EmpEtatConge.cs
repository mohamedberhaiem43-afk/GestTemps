namespace ABRPOINT.Server.Dtaos
{
    public class EmpEtatConge
    {
        public double DroitMensuelle { get; set; }
        public int Anciennete { get; set; }
        public double SoldeAnterieur { get; set; }
        public double DroitConge { get; set; }
        public EmpEtatConge(double dm,int anc,double dc,double sa)
        {
            DroitMensuelle = dm;
            Anciennete = anc;
            DroitConge = dc;
            SoldeAnterieur = sa;
        }
    }
}
