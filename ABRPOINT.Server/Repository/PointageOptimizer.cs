using ABRPOINT.Helper;
using ABRPOINT.Server.Data;
using ABRPOINT.Server.Interfaces;
using Microsoft.EntityFrameworkCore;

namespace ABRPOINT.Server.Repository
{
    public class PointageOptimizer
    {
        private readonly ApplicationDbContext _context;
        private readonly IParametreRepository _parametreRepository;

        public PointageOptimizer(ApplicationDbContext context,IParametreRepository parametreRepository)
        {
            _context = context;
            _parametreRepository = parametreRepository;
        }

        public async Task OptimizePointage(string soccod,string empMat, DateTime dateOptim)
        {
            var wdatopt = new DateTime(2000, 1, 1);

            try
            {
                var parametre = await _context.Parametres.FirstOrDefaultAsync(p => p.Soccod == soccod);
                if (parametre != null && parametre.Optimise.HasValue)
                    wdatopt = parametre.Optimise.Value;

                    if (empMat == "*")
                    {
                        var employeesToUpdate = await _context.Employes
                            .Where(e => e.Empoptim == null && e.Soccod == soccod)
                            .ToListAsync();

                        foreach (var emp in employeesToUpdate)
                        {
                            emp.Empoptim = wdatopt;
                        }
                        await _context.SaveChangesAsync();
                    }

                // Charger les entités réelles depuis la base
                var presences = await (from presence in _context.Presences
                                       join emp in _context.Employes on presence.Empcod equals emp.Empcod
                                       where presence.Soccod == soccod &&
                                             (empMat != "*"
                                                  ? presence.Empcod == empMat && presence.Predat == dateOptim
                                                  : presence.Predat >= wdatopt || (emp.Empoptim == null && presence.Predat >= wdatopt))
                                       select presence).ToListAsync();

                var nuitparam = await _parametreRepository.GetParametresNuitAsync(soccod);

                // Décaler si première entrée vide
                foreach (var item in presences)
                {
                    var lpoint = await _context.Lpointjours
                        .FirstOrDefaultAsync(lp => lp.Soccod == soccod && lp.Empcod == item.Empcod && lp.Saljour == item.Predat);
                    if(lpoint != null)
                        continue;
                    if (string.IsNullOrEmpty(item.Preentmatup))
                    {
                        item.Preentmatup = item.Presortmatup;
                        item.Presortmatup = item.Preentamidiup;
                        item.Preentamidiup = item.Presortamidiup;
                        item.Presortamidiup = null;
                    }
                }

                // Gérer les shifts de nuit
                for (int i = 0; i < presences.Count; i++)
                {
                    var lpoint = await _context.Lpointjours
                        .FirstOrDefaultAsync(lp => lp.Soccod == soccod && lp.Empcod == presences[i].Empcod && lp.Saljour == presences[i].Predat);
                    if (lpoint != null)
                        continue;
                    var item = presences[i];

                    if ((GenericMethodes.ConvertTimeToDecimal(item.Preentmatup) >= GenericMethodes.ConvertTimeToDecimal(nuitparam.Nuitdeb)
                        && string.IsNullOrEmpty(item.Presortmatup)) ||
                        (GenericMethodes.ConvertTimeToDecimal(item.Preentamidiup) >= GenericMethodes.ConvertTimeToDecimal(nuitparam.Nuitdeb)
                        && string.IsNullOrEmpty(item.Presortamidiup)))
                    {
                        var nextDayItem = presences
                            .Skip(i + 1)
                            .FirstOrDefault(x => x.Empcod == item.Empcod && x.Predat > item.Predat);

                        if (nextDayItem != null && !string.IsNullOrEmpty(nextDayItem.Preentmatup))
                        {
                            // Modifier directement l'entité trackée
                            if (string.IsNullOrEmpty(item.Presortmatup))
                            {
                                item.Presortmatup = nextDayItem.Preentmatup;
                            }
                            else if (string.IsNullOrEmpty(item.Presortamidiup))
                            {
                                item.Presortamidiup = nextDayItem.Preentmatup;
                            }
                            // Vider l'entrée du jour suivant
                            nextDayItem.Preentmatup = null;
                        }
                    }
                }

                // UN SEUL SaveChanges à la fin
                await _context.SaveChangesAsync();


            }
            catch (Exception ex)
            {
                throw new Exception("Optimization failed: " + ex.Message, ex);
            }
        }

    }
}