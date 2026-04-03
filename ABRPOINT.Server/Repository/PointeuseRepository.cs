using ABRPOINT.Server.Data;
using ABRPOINT.Server.Dtaos;
using ABRPOINT.Server.Interfaces;
using ABRPOINT.Server.Models;
using Microsoft.EntityFrameworkCore;

namespace ABRPOINT.Server.Repository
{
    public class PointeuseRepository : IPointeuseRepository
    {
        private ApplicationDbContext _dbContext;
        public PointeuseRepository(ApplicationDbContext dbContext)
        {
            _dbContext = dbContext;
        }
        public void Add(Pointeuse entity)
        {
            try
            {
                _dbContext.Pointeuses.Add(entity);
                _dbContext.SaveChanges();
            }
            catch (Exception ex)
            {

                throw new Exception("",ex);
            }
            
        }

        public void Delete(Pointeuse entity)
        {
            var existingEntity = _dbContext.Pointeuses
                .FirstOrDefault(p => p.Poicod == entity.Poicod && p.Soccod == entity.Soccod);

            if (existingEntity != null)
            {
                _dbContext.Pointeuses.Remove(existingEntity);
                _dbContext.SaveChanges();
            }
        }

        public IEnumerable<Pointeuse> GetAll()
        {
            return _dbContext.Pointeuses.ToList();
        }

        public void Update(Pointeuse entity)
        {
            var existingEntity = _dbContext.Pointeuses
                .FirstOrDefault(p => p.Poicod == entity.Poicod && p.Soccod == entity.Soccod);

            if (existingEntity != null)
            {
                // You can map individual fields if needed
                existingEntity.Poilib = entity.Poilib;
                existingEntity.Poiadrip1 = entity.Poiadrip1;
                existingEntity.Poiadrip2 = entity.Poiadrip2;
                existingEntity.Poiadrip3 = entity.Poiadrip3;
                existingEntity.Poiadrip4 = entity.Poiadrip4;
                existingEntity.Poiport = entity.Poiport;
                existingEntity.Poietat = entity.Poietat;
                existingEntity.Poicom = entity.Poicom;

                _dbContext.Pointeuses.Update(existingEntity);
                _dbContext.SaveChanges();
            }
        }
    
        public IEnumerable<Pointeuse> GetAll(string soccod)
        {
            try
            {
                IEnumerable<Pointeuse> pointeuses = _dbContext.Pointeuses.Where(p => p.Soccod == soccod);
                return pointeuses;
            }
            catch (Exception ex)
            {

                throw new Exception("",ex);
            }
            
        }

        public async Task<List<string>> GetAllIps(string soccod)
        {
            try
            {
                var ips = await _dbContext.Pointeuses
                    .Where(p => p.Soccod == soccod)
                    .Select(p =>
                        p.Poiadrip1 + "." +
                        p.Poiadrip2 + "." +
                        p.Poiadrip3 + "." +
                        p.Poiadrip4 + ":" +
                        p.Poiport
                    )
                    .ToListAsync();

                return ips;
            }
            catch (Exception)
            {
                throw;
            }
        }

        public async Task AddAsync(Pointeuse? pointeuse)
        {
            try
            {
                await _dbContext.Pointeuses.AddAsync(pointeuse);
                await _dbContext.SaveChangesAsync();
            }
            catch (Exception)
            {
                throw;
            }
        }

        public async Task<Pointeuse> GetById(string poicod, string soccod)
        {
            try
            {
                var pointeuse = await _dbContext.Pointeuses.FirstOrDefaultAsync(p => p.Poicod == poicod && p.Soccod == soccod);
                return pointeuse;
            }
            catch (Exception)
            {
                throw;
            }
        }

        public async Task<string[]> GetIpsByPoicod(string[] poicods)
        {
            try
            {
                var pointeuses = await _dbContext.Pointeuses
                    .Where(p => poicods.Contains(p.Poicod))
                    .ToListAsync();

                var ips = pointeuses
                    .Where(p => p.Poiadrip1.HasValue && p.Poiadrip2.HasValue && p.Poiadrip3.HasValue && p.Poiadrip4.HasValue && p.Poiport.HasValue)
                    .Select(p => $"{p.Poiadrip1}.{p.Poiadrip2}.{p.Poiadrip3}.{p.Poiadrip4}:{p.Poiport}")
                    .ToArray();

                return ips;
            }
            catch (Exception)
            {
                throw;
            }
        }

        public async Task<IEnumerable<Pointeuse>> GetAllAsync(string soccod)
        {
            try
            {
                IEnumerable<Pointeuse> pointeuses = await _dbContext.Pointeuses.Where(p => p.Soccod == soccod).ToListAsync();
                return pointeuses;
            }
            catch (Exception)
            {
                throw;
            }
        }
        public async Task<IEnumerable<PointeuseDto>> GetAllAsyncWithLatestRead(string soccod)
        {
            try
            {
                var pointeuses = await _dbContext.Pointeuses
                    .Where(p => p.Soccod == soccod)
                    .Select(p => new PointeuseDto
                    {
                        // Mapper les propriétés de Pointeuse
                        Poicod = p.Poicod,
                        Soccod = p.Soccod,
                        Poilib = p.Poilib,
                        Poiport = p.Poiport,
                        Poiadrip1 = p.Poiadrip1,
                        Poiadrip2 = p.Poiadrip2,
                        Poiadrip3 = p.Poiadrip3,
                        Poiadrip4 = p.Poiadrip4,
                        // Récupérer la dernière lecture (dmhre) pour cette pointeuse
                        LatestDmhre = _dbContext.Dmpoints
                            .Where(dm => dm.Soccod == soccod && dm.Dmpnt == p.Poicod)
                            .OrderByDescending(dm => dm.Dmhre) // ou un champ date si disponible
                            .Select(dm => dm.Dmhre)
                            .FirstOrDefault()
                    })
                    .ToListAsync();

                return pointeuses;
            }
            catch (Exception)
            {
                throw;
            }
        }

        public async Task<List<PointeuseType>> GetPointeuseTypesByPoicod(string[] poicods)
        {
            try
            {
                var pointeuses = await _dbContext.Pointeuses
                    .Where(p => poicods.Contains(p.Poicod))
                    .Select(p => new PointeuseType
                    {
                        Soccod = p.Soccod,
                        Ip = p.Poiadrip1.HasValue && p.Poiadrip2.HasValue &&
                             p.Poiadrip3.HasValue && p.Poiadrip4.HasValue && p.Poiport.HasValue
                                ? $"{p.Poiadrip1}.{p.Poiadrip2}.{p.Poiadrip3}.{p.Poiadrip4}:{p.Poiport}"
                                : null,
                        Poicom = p.Poicom,
                        Poipwd = p.Poipwd
                    })
                    .ToListAsync();

                return pointeuses;
            }
            catch (Exception)
            {
                throw;
            }
        }

        public async Task<string> GetByIp(string soccod, string ip)
        {
            try
            {
                // Split IP:Port
                var parts = ip.Split(':');
                if (parts.Length != 2)
                    throw new ArgumentException("Invalid IP format. Expected format: xxx.xxx.xxx.xxx:port");

                var ipParts = parts[0].Split('.');
                if (ipParts.Length != 4)
                    throw new ArgumentException("Invalid IP format. Expected IPv4 with 4 segments.");

                int ip1 = int.Parse(ipParts[0]);
                int ip2 = int.Parse(ipParts[1]);
                int ip3 = int.Parse(ipParts[2]);
                int ip4 = int.Parse(ipParts[3]);
                int port = int.Parse(parts[1]);

                var pointeuse = await _dbContext.Pointeuses
                    .Where(p => p.Soccod == soccod &&
                                p.Poiadrip1 == ip1 &&
                                p.Poiadrip2 == ip2 &&
                                p.Poiadrip3 == ip3 &&
                                p.Poiadrip4 == ip4 &&
                                p.Poiport == port)
                    .FirstOrDefaultAsync();

                return pointeuse?.Poicod;
            }
            catch (Exception)
            {
                throw;
            }
        }

    }
}
