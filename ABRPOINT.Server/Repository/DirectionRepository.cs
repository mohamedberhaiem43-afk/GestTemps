using ABRPOINT.Server.Data;
using ABRPOINT.Server.Interfaces;
using ABRPOINT.Server.Models;

namespace ABRPOINT.Server.Repository
{
    public class DirectionRepository : IDirectionRepository
    {
        private readonly ApplicationDbContext _dbContext;
        public DirectionRepository(ApplicationDbContext dbContext)
        {
            _dbContext = dbContext;
        }
        public void Add(Direction entity)
        {
            try
            {
                if (entity != null)
                {
                    _dbContext.Add(entity);
                    _dbContext.SaveChanges();
                }
            }
            catch(Exception ex)
            {
                throw new Exception("An error occured while adding direction",ex);
            }
            
        }
        public Direction AddDirection(Direction entity)
        {
            try
            {
                if (entity != null)
                {
                    _dbContext.Add(entity);
                    _dbContext.SaveChanges();
                }
                return entity;
            }
            catch(Exception ex)
            {
                throw new Exception("An error occured while adding direction", ex);
            }
           
        }

        public void Delete(Direction entity)
        {
            try
            {
                _dbContext.Directions.Remove(entity);
                _dbContext.SaveChanges();
            }
            catch (Exception ex)
            {
                throw new Exception("An error occured while deleting direction",ex);
            }
        }

        public Direction Get(string soccod, string dircod)
        {
            try
            {
                return _dbContext.Directions
                              .Where(d => d.Soccod == soccod && d.Dircod == dircod)
                              .SingleOrDefault();
            }   
            catch(Exception ex)
            {
                throw new Exception("An error occured while getting direction", ex);
            }
            
        }


        public IEnumerable<Direction> GetAll()
        {
            try
            {
                return _dbContext.Directions.ToList();
            }
            catch(Exception ex)
            {
                throw new Exception("An error occured while getting directions list", ex);
            }
        }
        public IEnumerable<Direction> GetAll(string soccod)
        {
            return _dbContext.Directions.Where(d=>d.Soccod == soccod).ToList();
        }

        public Dictionary<string, string> GetDirLibs(string soccod)
        {
            try
            {
                return _dbContext.Directions.Where(d=>d.Soccod == soccod).ToDictionary(d=>d.Dircod,d=>d.Dirlib) ;
            }
            catch(Exception ex)
            {
                throw new Exception("An error occured while getting directions libs", ex);
            }
        }

        public void Update(Direction entity)
        {
            try
            {
                _dbContext.Directions.Update(entity);
                _dbContext.SaveChanges();
            }
            catch (Exception ex)
            {
                throw new Exception("An error occured while updating direction", ex);

            }
            
        }
    }
}
