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
                foreach (var tranche in partrancheList)
                {
                    await _context.Partranches
                        .Where(p => p.Soccod == tranche.Soccod && p.Empreg == tranche.Empreg)
                        .ExecuteUpdateAsync(p => p
                            .SetProperty(x => x.Partranche1, tranche.Partranche1)
                            .SetProperty(x => x.Partaux1, tranche.Partaux1)
                            .SetProperty(x => x.Partranche2, tranche.Partranche2)
                            .SetProperty(x => x.Partaux2, tranche.Partaux2));
                }

                return true;
            }
            catch (Exception)
            {
                throw;
            }
        }

    }
}
