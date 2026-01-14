using ABRPOINT.Server.Data;
using ABRPOINT.Server.Dtaos;
using ABRPOINT.Server.Interfaces;
using ABRPOINT.Server.Models;
using AutoMapper;
using AutoMapper.QueryableExtensions;
using Microsoft.EntityFrameworkCore;

namespace ABRPOINT.Server.Repository
{
    public class RubriqueService : IRubriqueService
    {
        private readonly ApplicationDbContext _dbContext;
        private readonly ILogger<RubriqueService> _logger;
        private readonly IMapper _mapper;
        public RubriqueService(ApplicationDbContext dbContext, ILogger<RubriqueService> logger, IMapper mapper)
        {
            _dbContext = dbContext;
            _logger = logger;
            _mapper = mapper;
        }
        public void Add(RubriqueDto entity)
        {
            throw new NotImplementedException();
        }

        public async Task<bool> AddRubrique(Rubrique rubrique)
        {
            try
            {
                if (rubrique.Rubtype == null)
                    rubrique.Rubtype = "255";
                await _dbContext.AddAsync(rubrique);
                await _dbContext.SaveChangesAsync();
                return true;
            }
            catch (Exception)
            {
                throw;
            }
        }

        public void Delete(RubriqueDto entity)
        {
            throw new NotImplementedException();
        }
        public async Task DeleteAsync(string soccod,string rubcod)
        {
            try
            {
                var rubrique = await _dbContext.Rubriques.Where(r => r.Soccod == soccod && r.Rubcod == rubcod).SingleOrDefaultAsync();
                if(rubrique != null)
                    _dbContext.Rubriques.Remove(rubrique);

                await _dbContext.SaveChangesAsync();
            }
            catch (Exception)
            {

                throw;
            }
        }

        public async Task<IEnumerable<RubriqueDto>> GetAll(string soccod)
        {
            try
            {
                var rubriques = await _dbContext.Rubriques
                    .Where(r => r.Soccod == soccod)
                    .ProjectTo<RubriqueDto>(_mapper.ConfigurationProvider)
                    .ToListAsync();
                return rubriques;
            }
            catch (Exception)
            {   
                _logger.LogError("An error occurred while fetching the data from the database");
                throw;
            }
        }

        public IEnumerable<RubriqueDto> GetAll()
        {
            throw new NotImplementedException();
        }

        public async Task<IEnumerable<RubriquePaireDto>> GetPaires(string soccod)
        {
            try
            {
                var rubriques = await _dbContext.Rubriques
                    .Where(r => r.Soccod == soccod)
                    .ProjectTo<RubriquePaireDto>(_mapper.ConfigurationProvider)
                    .ToListAsync();
                return rubriques;
            }
            catch (Exception)
            {
               throw;
            }
        }

        public async Task<Rubrique> GetRubrique(string soccod, string rubcod)
        {
            try
            {
                var rubrique = await _dbContext.Rubriques.Where(rub => rub.Soccod == soccod && rub.Rubcod == rubcod).SingleOrDefaultAsync();
                return rubrique;
            }
            catch (Exception)
            {
                throw;
            }
        }

        public void Update(RubriqueDto entity)
        {
            throw new NotImplementedException();
        }

        public async Task<bool> UpdateRubrique(Rubrique rubrique)
        {
            try
            {
                var entity = await _dbContext.Rubriques
                    .Where(r => r.Soccod == rubrique.Soccod && r.Rubcod == rubrique.Rubcod)
                    .SingleOrDefaultAsync();

                if (entity == null)
                    return false;
                if(rubrique.Rubtype!=null)
                    entity.Rubtype = rubrique.Rubtype;
                if(rubrique.Rublib!=null)
                entity.Rublib = rubrique.Rublib;
                if(rubrique.Rubregime!=null)
                entity.Rubregime = rubrique.Rubregime;
                if(rubrique.Vartype!=null)
                entity.Vartype = rubrique.Vartype;
                if(rubrique.Rubunite!=null)
                entity.Rubunite = rubrique.Rubunite;
                if(rubrique.Rubtaux!=null)
                entity.Rubtaux = rubrique.Rubtaux;

                await _dbContext.SaveChangesAsync();
                return true;
            }
            catch (Exception)
            {
                throw;
            }
        }
    
    }

}
