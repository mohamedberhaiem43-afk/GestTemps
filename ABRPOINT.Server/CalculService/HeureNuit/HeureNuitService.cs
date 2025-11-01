using ABRPOINT.Server.Data;
using ABRPOINT.Server.Dtaos;
using ABRPOINT.Server.Interfaces;
using Microsoft.EntityFrameworkCore;

namespace ABRPOINT.Server.CalculService.HeureNuit
{
    public class HeureNuitService : IHeureNuitService
    {
        private readonly ApplicationDbContext _dbContext;
        private readonly IParametreRepository _parametreRepository;
        private readonly IEmployeRepository _employeRepository;
        public HeureNuitService(IParametreRepository parametreRepository,IEmployeRepository employeRepository, ApplicationDbContext dbContext)
        {
            _dbContext = dbContext;
            _parametreRepository = parametreRepository;
            _employeRepository = employeRepository;
        }
        public async Task<float?> CalculateHeureNuit(PresenceDto presence)
        {
            try
            {
                ParametreNuitDto parametreNuit = await _parametreRepository.GetParametresNuitAsync(presence.Soccod);
                if (parametreNuit.CompterNuit == "0")
                    return 0;
                var (nuitDebut, nuitFin) = await _employeRepository.GetEmpNuitIntervalle(presence.Soccod, presence.Empcod);

                if (nuitDebut == null || nuitFin == null)
                    return 0;

                // Convertir les heures de présence en TimeSpan?
                List<(string? start, string? end)> periodes = new()
                {
                    (presence.Preentmatup, presence.Presortmatup),
                    (presence.Preentamidiup, presence.Presortamidiup)
                };

                 // Si la présence est de jour, ne pas compter les heures de nuit
                if (parametreNuit.PasCompterNuitSiSortieJour == 1)
                {
                    if (presence.Presortmatup != null && TimeSpan.TryParse(presence.Presortmatup, out var sortieMatin) && sortieMatin < nuitDebut)
                        return 0;
                    if (presence.Presortamidiup != null && TimeSpan.TryParse(presence.Presortamidiup, out var sortieMidi) && sortieMidi < nuitDebut)
                        return 0;
                }


                // Initialiser le total des heures de nuit
                float? totalHeuresNuit = 0;


                foreach (var (startStr, endStr) in periodes)
                {
                    if (TimeSpan.TryParse(startStr, out var start) && TimeSpan.TryParse(endStr, out var end))
                    {
                        // Gérer le cas où la sortie est le lendemain
                        if (end < start)
                            end = end.Add(TimeSpan.FromDays(1));

                        // Calcul du chevauchement avec la période de nuit
                        totalHeuresNuit += (float)CalculateOverlap(start, end, nuitDebut.Value, nuitFin.Value);
                    }
                }

                if (parametreNuit.RepasNuit == "1")
                {
                    int? prerepas = await _dbContext.Presences.Where(p => p.Empcod == presence.Empcod && p.Predat == presence.Predat).Select(p => p.Prerepas)
                    .FirstOrDefaultAsync();
                    if (prerepas == null) prerepas = 0;
                    totalHeuresNuit -= (float)prerepas / 60;
                }
                if (totalHeuresNuit < parametreNuit.MinHeureNuit)
                    return 0;

                return totalHeuresNuit;
            }
            catch (Exception)
            {
                throw;
            }
        }


        private double CalculateOverlap(TimeSpan presenceStart, TimeSpan presenceEnd, TimeSpan nuitStart, TimeSpan nuitEnd)
        {
            // Gérer les intervalles de nuit qui traversent minuit (ex. 22:00 → 06:00)
            if (nuitEnd < nuitStart)
            {
                return CalculateOverlap(presenceStart, presenceEnd, nuitStart, TimeSpan.FromHours(24)) +
                       CalculateOverlap(presenceStart, presenceEnd, TimeSpan.Zero, nuitEnd);
            }

            var overlapStart = Max(presenceStart, nuitStart);
            var overlapEnd = Min(presenceEnd, nuitEnd);

            var duration = overlapEnd - overlapStart;

            return duration.TotalHours > 0 ? duration.TotalHours : 0;
        }


        private TimeSpan Max(TimeSpan a, TimeSpan b) => a > b ? a : b;
        private TimeSpan Min(TimeSpan a, TimeSpan b) => a < b ? a : b;


    }
}

