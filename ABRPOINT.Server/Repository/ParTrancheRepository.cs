using ABRPOINT.Server.Data;
using ABRPOINT.Server.Interfaces;
using ABRPOINT.Server.Models;
using Microsoft.EntityFrameworkCore;

namespace ABRPOINT.Server.Repository
{
    public class ParTrancheRepository : IparTrancheRepository
    {
        private readonly ApplicationDbContext _context;
        public ParTrancheRepository(ApplicationDbContext context)
        {
            _context = context;
        }
        public async Task<IList<Partranche>> GetPartranche(string soccod)
        {
			try
			{
                IList<Partranche>? parTranche = await _context.Partranches.Where(p => p.Soccod == soccod).ToListAsync();
                return parTranche;
            }
			catch (Exception)
			{
				throw;
			}
        }

        public async Task<bool> UpdateParTranche(List<Partranche> partrancheList)
        {
            try
            {
                if (partrancheList == null || !partrancheList.Any())
                    return false;

                // Récupérer le soccod (on suppose que toutes les tranches ont le même soccod)
                var soccod = partrancheList.First().Soccod;

                // Récupérer toutes les tranches existantes pour ce soccod
                var existingTranches = await _context.Partranches
                    .Where(p => p.Soccod == soccod)
                    .ToListAsync();

                // Supprimer les tranches qui n'existent plus dans la liste envoyée
                var tranchesToDelete = existingTranches
                    .Where(existing => !partrancheList.Any(t =>
                        t.Soccod == existing.Soccod &&
                        t.Empreg == existing.Empreg &&
                        t.Caltype == existing.Caltype))
                    .ToList();

                if (tranchesToDelete.Any())
                {
                    _context.Partranches.RemoveRange(tranchesToDelete);
                }

                // Mettre à jour ou ajouter les tranches de la liste
                foreach (var tranche in partrancheList)
                {
                    var existingTranche = existingTranches
                        .FirstOrDefault(p => p.Soccod == tranche.Soccod
                                           && p.Empreg == tranche.Empreg
                                           && p.Caltype == tranche.Caltype);

                    if (existingTranche != null)
                    {
                        // Mise à jour si existe
                        existingTranche.Ordre = tranche.Ordre;
                        existingTranche.Partranche1 = tranche.Partranche1;
                        existingTranche.Partaux1 = tranche.Partaux1;
                        existingTranche.Partranche2 = tranche.Partranche2;
                        existingTranche.Partaux2 = tranche.Partaux2;
                    }
                    else
                    {
                        // Ajout si n'existe pas
                        await _context.Partranches.AddAsync(tranche);
                    }
                }

                await _context.SaveChangesAsync();
                return true;
            }
            catch (Exception)
            {
                throw;
            }
        }
    }
}
