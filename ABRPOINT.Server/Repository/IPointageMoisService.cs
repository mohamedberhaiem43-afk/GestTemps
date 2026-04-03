using ABRPOINT.Server.Dtaos;

namespace ABRPOINT.Server.Repository
{
    public interface IPointageMoisService
    {
        Task<List<PointageMois>> GetPointageMois(string soccod,List<string> empcods,string mois,string annee,string semaine);
    }
}
