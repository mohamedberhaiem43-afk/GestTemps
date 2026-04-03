using ABRPOINT.Server.Dtaos;
using ABRPOINT.Server.Interfaces;
using Microsoft.SemanticKernel;
using System.ComponentModel;

namespace ABRPOINT.Server.CalculService
{
    public class PresencePlugin
    {
        private readonly IPresenceRepository _presenceRepository;

        public PresencePlugin(IPresenceRepository presenceRepository)
        {
            _presenceRepository = presenceRepository;
        }

        [KernelFunction("GetEtatPeriodique")]
        [Description("Récupère l'état périodique détaillé des présences d'un ou plusieurs employés sur une période donnée. Utilise cette fonction quand l'utilisateur demande les présences, l'état détaillé, les journées de travail, les retards ou absences d'un employé.")]
        [return: Description("Liste des présences détaillées avec entrées/sorties, heures travaillées, retards, absences")]
        public async Task<IEnumerable<PresenceDto>> GetEtatPeriodique(
                   [Description("Code de la société, toujours '01' par défaut")] string soccod,
                   [Description("Code(s) de l'employé. Peut être un seul code ou 'ALL' pour tous les employés. Exemple: '123456' ou 'ALL'")] string empcods,
                   [Description("Date de début au format YYYY-MM-DD. Exemple: '2025-01-01'. Si l'utilisateur dit 'janvier 2025', utiliser '2025-01-01'")] string dateDebut,
                   [Description("Date de fin au format YYYY-MM-DD. Exemple: '2025-01-31'. Si l'utilisateur dit 'janvier 2025', utiliser '2025-01-31'")] string dateFin

               )
        {
            try
            {
                var debut = DateTime.Parse(dateDebut);
                var fin = DateTime.Parse(dateFin);

                // Si plusieurs employés, récupérer tous
                var empcodList = empcods.Split(',', StringSplitOptions.RemoveEmptyEntries)
                    .Select(e => e.Trim())
                    .ToList();

                var allResults = new List<PresenceDto>();

                foreach (var empcod in empcodList)
                {
                    var result = await _presenceRepository.GetEmpEtatPeriodiqueAsync(soccod,empcod,debut,fin);
                    allResults.AddRange(result);
                }
                return allResults;
            }
            catch (Exception ex)
            {
                return Enumerable.Empty<PresenceDto>();
            }
        }
    }
}
