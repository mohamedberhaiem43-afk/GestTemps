using ABRPOINT.Server.Dtaos;
using ABRPOINT.Server.Repository;
using Microsoft.SemanticKernel;

namespace ABRPOINT.Server.CalculService
{
    public class PointagePlugin
    {
        private readonly IPointageMoisService _service;

        public PointagePlugin(IPointageMoisService service)
        {
            _service = service;
        }

        [KernelFunction]
        public async Task<List<PointageMois>> GetPointageMois(
            string soccod,
            List<string> empcods,
            string mois,
            string annee,
            string semaine = "0")
        {
            return await _service.GetPointageMois(
                soccod, empcods, mois, annee, semaine);
        }
    }
}
