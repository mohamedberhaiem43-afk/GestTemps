using ABRPOINT.Server.Data;

namespace ABRPOINT.Server.Interfaces
{
    public interface IAvanceRepository
    {
        Task<List<AvanceDto>> GetAvances(string soccod,string mois,string annee,string niveau);
        Task UpdateAvance(string soccod, string mois, string annee, string empcod, string niveau, float montant);
    }
}
