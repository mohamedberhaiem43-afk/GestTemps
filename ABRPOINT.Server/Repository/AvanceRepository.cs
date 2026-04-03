using ABRPOINT.Server.Data;
using ABRPOINT.Server.Interfaces;
using AutoMapper;
using AutoMapper.QueryableExtensions;
using Microsoft.EntityFrameworkCore;

namespace ABRPOINT.Server.Repository
{
    public class AvanceRepository : IAvanceRepository
    {
		private readonly ApplicationDbContext _db;
		private readonly IMapper _mapper;
        public AvanceRepository(ApplicationDbContext db,IMapper mapper)
        {
            _db = db;
            _mapper = mapper;
        }
        public async Task<List<AvanceDto>> GetAvances(string soccod,string mois,string annee, string niveau)
        {
			try
			{
                var avances = await _db.Avances
                    .Include(a=>a.Employe)
                    .Where(a=>a.Soccod == soccod && a.Mois == mois && a.Annee == annee && a.Niveau == niveau)
                    .ProjectTo<AvanceDto>(_mapper.ConfigurationProvider)
                    .ToListAsync();
                return avances;
			}
			catch (Exception)
			{
				throw;
			}
        }

        public async Task UpdateAvance(string soccod, string mois, string annee, string empcod,string niveau, float montant)
        {
            try
            {
                 await _db.Avances
                .Where(a => a.Soccod == soccod && a.Mois == mois && a.Annee == annee && a.Empcod == empcod && a.Niveau == niveau)
                .ExecuteUpdateAsync(setters => setters.SetProperty(a => a.Montant, montant));
            }
            catch (Exception)
            {
                throw;
            }
        }
    }
}
