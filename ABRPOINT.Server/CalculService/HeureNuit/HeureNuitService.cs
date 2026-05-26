using ABRPOINT.Server.Data;
using ABRPOINT.Server.Dtaos;
using ABRPOINT.Server.Interfaces;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace ABRPOINT.Server.CalculService.HeureNuit
{
    public class HeureNuitService : IHeureNuitService
    {
        private readonly ApplicationDbContext _dbContext;
        private readonly IParametreRepository _parametreRepository;
        private readonly IEmployeRepository _employeRepository;
        private readonly ILogger<HeureNuitService> _logger;
        public HeureNuitService(IParametreRepository parametreRepository, IEmployeRepository employeRepository, ApplicationDbContext dbContext, ILogger<HeureNuitService> logger)
        {
            _dbContext = dbContext;
            _parametreRepository = parametreRepository;
            _employeRepository = employeRepository;
            _logger = logger;
        }
        public async Task<float?> CalculateHeureNuit(PresenceDto presence)
        {
            try
            {
                // Tag de corrélation : permet de relier les logs de cette méthode entre
                // eux quand plusieurs employés / dates sont calculés en parallèle (état
                // périodique sur toute une équipe). Sans ça, impossible de savoir quelle
                // ligne du log correspond à quelle journée d'un employé.
                var tag = $"HeureNuit[soccod={presence.Soccod} emp={presence.Empcod} date={presence.Predat:yyyy-MM-dd}]";

                ParametreNuitDto parametreNuit = await _parametreRepository.GetParametresNuitAsync(presence.Soccod);
                if (parametreNuit?.CompterNuit == "0")
                {
                    // Cas le plus fréquent quand l'admin "voit" la config nuit dans l'UI
                    // mais a oublié de sauvegarder : Parnuit reste "0" en base.
                    _logger.LogInformation("{Tag} → 0 (CompterNuit=0 — toggle 'Configuration Nuit' désactivé en BD)", tag);
                    return 0;
                }
                var (nuitDebut, nuitFin) = await _employeRepository.GetEmpNuitIntervalle(presence.Soccod, presence.Empcod);

                if (nuitDebut == null || nuitFin == null)
                {
                    // Trois causes possibles :
                    //  - Employe.Empnuit = "9" (ou autre valeur non gérée) → désactivé pour CE salarié
                    //  - Parametre row absente côté société
                    //  - Nuitdeb/Nuitfin non parsables (chaîne vide ou format invalide)
                    _logger.LogInformation("{Tag} → 0 (plage nuit indéfinie : nuitDebut={NuitDebut} nuitFin={NuitFin} — vérifier Employe.Empnuit et Parametre.Nuitdeb/Nuitfin)", tag, nuitDebut, nuitFin);
                    return 0;
                }
                _logger.LogDebug("{Tag} plage nuit = {NuitDebut} → {NuitFin}", tag, nuitDebut, nuitFin);

                // Convertir les heures de présence en TimeSpan?
                List<(string? start, string? end)> periodes = new()
                {
                    (presence.Preentmatup, presence.Presortmatup),
                    (presence.Preentamidiup, presence.Presortamidiup)
                };

                 // Si la présence est de jour, ne pas compter les heures de nuit.
                 // ⚠ Une sortie strictement < nuitDebut peut être :
                 //   a) une vraie sortie de jour (ex: 17:00 vs nuitDebut=20:00) → on saute
                 //   b) une sortie qui a franchi minuit (ex: ent=23:00, sort=01:00) → c'est
                 //      bien une sortie de nuit, il faut comptabiliser. Le check naïf
                 //      `sortieMidi < nuitDebut` traitait 01:00 < 20:00 comme cas (a) et
                 //      retournait 0 → H.Nuits absentes sur les pointages overnight.
                if (parametreNuit?.PasCompterNuitSiSortieJour == 1)
                {
                    static bool IsDayExit(string? entStr, string? sortStr, TimeSpan nuitDebut)
                    {
                        if (string.IsNullOrEmpty(sortStr) || !TimeSpan.TryParse(sortStr, out var sort))
                            return false;
                        // Si la sortie est antérieure à l'entrée, c'est qu'on franchit minuit
                        // → la sortie appartient au lendemain, ce n'est pas une sortie de jour.
                        if (!string.IsNullOrEmpty(entStr) && TimeSpan.TryParse(entStr, out var ent) && sort < ent)
                            return false;
                        return sort < nuitDebut;
                    }

                    if (IsDayExit(presence.Preentmatup, presence.Presortmatup, nuitDebut.Value))
                    {
                        _logger.LogInformation("{Tag} → 0 (PasCompterNuitSiSortieJour : sortie matin {Sortie} < nuitDebut {NuitDebut})", tag, presence.Presortmatup, nuitDebut.Value);
                        return 0;
                    }
                    if (IsDayExit(presence.Preentamidiup, presence.Presortamidiup, nuitDebut.Value))
                    {
                        _logger.LogInformation("{Tag} → 0 (PasCompterNuitSiSortieJour : sortie AM {Sortie} < nuitDebut {NuitDebut})", tag, presence.Presortamidiup, nuitDebut.Value);
                        return 0;
                    }
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

                if (parametreNuit?.RepasNuit == "1")
                {
                    double? prerepas = await _dbContext.Presences.Where(p => p.Empcod == presence.Empcod && p.Predat == presence.Predat).Select(p => p.Prerepas)
                    .FirstOrDefaultAsync();
                    if (prerepas == null) prerepas = 0;
                    totalHeuresNuit -= (float)prerepas / 60;
                }
                if (totalHeuresNuit < parametreNuit?.MinHeureNuit)
                {
                    _logger.LogInformation("{Tag} → 0 (totalHeuresNuit={Total}h < MinHeureNuit={Min}h : sous seuil minimum)", tag, totalHeuresNuit, parametreNuit?.MinHeureNuit);
                    return 0;
                }

                _logger.LogDebug("{Tag} → {Total}h", tag, totalHeuresNuit);
                return totalHeuresNuit;
            }
            catch (Exception)
            {
                throw;
            }
        }


        private double CalculateOverlap(TimeSpan presenceStart, TimeSpan presenceEnd, TimeSpan nuitStart, TimeSpan nuitEnd)
        {
            double total = 0;

            // normaliser la présence
            if (presenceEnd < presenceStart)
                presenceEnd += TimeSpan.FromDays(1);

            // normaliser la nuit
            if (nuitEnd <= nuitStart)
            {
                // Partie 1 : 22 → 24
                total += Overlap(presenceStart, presenceEnd, nuitStart, TimeSpan.FromHours(24));

                // Partie 2 : 24 → 30 (0 → 6 devient 24 → 30)
                total += Overlap(presenceStart, presenceEnd,
                                 TimeSpan.FromHours(24),
                                 nuitEnd + TimeSpan.FromDays(1));
            }
            else
            {
                total += Overlap(presenceStart, presenceEnd, nuitStart, nuitEnd);
            }

            return total;
        }

        private double Overlap(TimeSpan aStart, TimeSpan aEnd, TimeSpan bStart, TimeSpan bEnd)
        {
            var start = aStart > bStart ? aStart : bStart;
            var end = aEnd < bEnd ? aEnd : bEnd;

            return end > start ? (end - start).TotalHours : 0;
        }



        private TimeSpan Max(TimeSpan a, TimeSpan b) => a > b ? a : b;
        private TimeSpan Min(TimeSpan a, TimeSpan b) => a < b ? a : b;


    }
}

