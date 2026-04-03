namespace ABRPOINT.Server.Repository
{
    public interface IPointageOptimizerService
    {
        Task OptimizePointage(string soccod, string empMat, DateTime dateDeb, DateTime dateFin);
    }
}
