using ABRPOINT.Server.Data;
using ABRPOINT.Server.Dtaos;
using ABRPOINT.Server.Interfaces;
using ABRPOINT.Server.Models;
using Microsoft.EntityFrameworkCore;

namespace ABRPOINT.Server.Repository
{
    public class JourFerieRepository : IJourFerieRepository
    {

        private readonly ApplicationDbContext _dbContext;
        public JourFerieRepository(ApplicationDbContext dbContext)
        {
            _dbContext = dbContext;
        }
        public async Task<List<Ferier>> GetFeriersByPeriod(string soccod,DateTime startDate,DateTime endDate)
        {
            try
            {
                return await _dbContext.Feriers
                    .Where(f => f.Soccod == soccod &&
                               f.Ferdate >= startDate &&
                               f.Ferdate <= endDate)
                    .ToListAsync();
            }
            catch (Exception)
            {
                throw;
            }
        }
        public async Task AddAsync(Ferier ferier)
        {
            await _dbContext.Feriers.AddAsync(ferier);
            await _dbContext.SaveChangesAsync();
        }

        public async Task DeleteAsync(Ferier ferier)
        {
            if (ferier != null)
            {
                _dbContext.Feriers.Remove(ferier);
                await _dbContext.SaveChangesAsync();
            }
        }

        public async Task<IEnumerable<Ferier>> GetAllAsync()
        {
            return await _dbContext.Feriers.ToListAsync();
        }
        public async Task<Dictionary<DateTime, Ferier>> GetByFerdateBatch(string soccod, DateTime dateDeb, DateTime dateFin)
        {
            var feries = await _dbContext.Feriers
                .Where(f => f.Soccod == soccod && f.Ferdate.HasValue
                            && f.Ferdate >= dateDeb
                            && f.Ferdate <= dateFin)
                .ToListAsync();

            // Clé normalisée sur .Date : un férié importé depuis calendrier.api.gouv.fr est
            // stocké à 12:00:00 UTC (Date.UTC(y, m, d, 12)) tandis que les saisies manuelles
            // arrivent à 00:00:00. Sans normalisation, le consommateur (qui itère en .Date)
            // ne matche que les saisies manuelles et rate les imports.
            return feries
                .GroupBy(f => f.Ferdate!.Value.Date)
                .ToDictionary(g => g.Key, g => g.First());
        }


        public async Task<Ferier> GetByFerdate(string soccod, DateTime ferdate)
        {
            return await _dbContext.Feriers.FirstOrDefaultAsync(s => s.Soccod == soccod && s.Ferdate == ferdate);
        }
        public async Task<float?> GetFerheure(string soccod,DateTime? ferdate)
        {
            try
            {
                if (!ferdate.HasValue) return null;
                // ⚠ Normalisation .Date : les fériés importés depuis l'API gouv.fr sont
                // persistés à 12:00 UTC, alors que presence.Dmdate est généralement à
                // 00:00. Sans .Date des deux côtés, l'égalité ne matche jamais → la
                // méthode renvoyait NULL et le caller (PresenceRepository férié branch)
                // forçait Tothre à "00:00" pour un employé qui avait pourtant pointé.
                var target = ferdate.Value.Date;
                return await _dbContext.Feriers
                    .Where(s => s.Soccod == soccod && s.Ferdate.HasValue && s.Ferdate.Value.Date == target)
                    .Select(f => f.Ferheure)
                    .FirstOrDefaultAsync();
            }
            catch (Exception)
            {
                throw;
            }
        }
        public async Task<float?> GetHeureFerieTrav(string soccod, DateTime? predat, string? tothre)
        {
            try
            {
                if (!predat.HasValue) return 0;
                var target = predat.Value.Date;
                // Même normalisation que GetFerheure (cf. commentaire ci-dessus).
                // Sans ce fix, NbhFerierTrv restait à 0 pour les fériés gouv.fr → la colonne
                // "H.Fér.Trv" du pointage du mois affichait 0 même si l'employé avait pointé.
                Ferier? ferier = await _dbContext.Feriers
                    .Where(f => f.Soccod == soccod && f.Ferdate.HasValue && f.Ferdate.Value.Date == target)
                    .FirstOrDefaultAsync();


                if (ferier == null) return 0;

                // Convert "09:30" to float (e.g., 9.5)
                if (TimeSpan.TryParse(tothre, out TimeSpan time))
                {
                    float totalHours = (float)time.TotalHours;
                    return totalHours;
                }

                return null; // Invalid format
            }
            catch (Exception)
            {
                throw;
            }
        }
        public async Task<float?> GetHeureFerieTravParPeriode(string soccod, DateTime? predat, string? tothre)
        {
            try
            {
                if (!predat.HasValue) return 0;
                var target = predat.Value.Date;
                Ferier? ferier = await _dbContext.Feriers
                    .Where(f => f.Soccod == soccod && f.Ferdate.HasValue && f.Ferdate.Value.Date == target)
                    .FirstOrDefaultAsync();

                if (ferier == null) return 0;

                // Convert "09:30" to float (e.g., 9.5)
                if (TimeSpan.TryParse(tothre, out TimeSpan time))
                {
                    float totalHours = (float)time.TotalHours;
                    return totalHours;
                }

                return null; // Invalid format
            }
            catch (Exception)
            {
                throw;
            }
        }


        public async Task<float?> GetNbHeures(PresenceDto presence,string codpost)
        {
            try
            {
                bool isFerier = await IsFerier(presence.Soccod, presence.Predat);
                float? nbheure = 0;
                //float? nbheure = await _posteRepository.GetJourHeures(presence.Soccod,presence.Predat, codpost);
                return nbheure;
            }
            catch (Exception)
            { 
                throw;
            }
        }

        public async Task<float?> GetTotheureFerierParPeriode(string soccod,DateTime? debut,DateTime? fin)
        {
            try
            {
                var query = _dbContext.Feriers
                    .Where(f => f.Soccod == soccod);

                if (debut.HasValue)
                    query = query.Where(f => f.Ferdate >= debut.Value);

                if (fin.HasValue)
                    query = query.Where(f => f.Ferdate <= fin.Value);

                var result = await query.SumAsync(f => (float?)f.Ferheure);

                // Prevent infinity values that can't be serialized to JSON
                if (result.HasValue && (float.IsInfinity(result.Value) || float.IsNaN(result.Value)))
                {
                    result = 0;
                }

                return result;
            }
            catch (Exception)
            {
                throw;
            }
        }


        public async Task<bool> IsFerier(string soccod,DateTime? predat)
        {
            try
            {
                bool isFerier = await _dbContext.Feriers.Where(f => f.Soccod == soccod && f.Ferdate == predat).AnyAsync();
                return isFerier;
            }
            catch (Exception)
            {
                throw;
            }
        }
        public async Task UpdateAsync(Ferier ferier)
        {
            try
            {
                var existing = await _dbContext.Feriers
                    .FirstOrDefaultAsync(f => f.Soccod == ferier.Soccod && f.Ferdate == ferier.Ferdate);

                if (existing == null)
                {
                    // L'entrée n'existe pas, vous pouvez l'ajouter
                    await _dbContext.Feriers.AddAsync(ferier);
                }
                else
                {
                    // L'entrée existe, donc on peut la mettre à jour
                    _dbContext.Entry(existing).CurrentValues.SetValues(ferier);
                }

                await _dbContext.SaveChangesAsync();

            }
            catch (Exception)
            {
                throw;
            }
        }

        public async Task UpdateByOriginalKeyAsync(string soccod, DateTime originalFerdate, Ferier ferier)
        {
            // PK = (Soccod, Ferdate). Si l'utilisateur change la date, on doit retrouver l'entrée
            // par sa clé d'origine — sinon on ne trouve rien et on insère un doublon.
            var existing = await _dbContext.Feriers
                .FirstOrDefaultAsync(f => f.Soccod == soccod && f.Ferdate == originalFerdate);

            if (existing == null)
            {
                // Plus rien sous l'ancienne clé : l'utilisateur a probablement supprimé puis ré-édite.
                await _dbContext.Feriers.AddAsync(ferier);
                await _dbContext.SaveChangesAsync();
                return;
            }

            // Si la date change, EF Core refuse de modifier la PK d'une entité tracked → on supprime
            // l'ancienne et on insère une nouvelle ligne avec les valeurs mises à jour. Sinon
            // un simple SetValues suffit (et préserve les colonnes hors PK non envoyées).
            var pkChanged = existing.Ferdate != ferier.Ferdate;
            if (pkChanged)
            {
                _dbContext.Feriers.Remove(existing);
                await _dbContext.SaveChangesAsync();
                ferier.Soccod = soccod;
                await _dbContext.Feriers.AddAsync(ferier);
                await _dbContext.SaveChangesAsync();
            }
            else
            {
                _dbContext.Entry(existing).CurrentValues.SetValues(ferier);
                await _dbContext.SaveChangesAsync();
            }
        }
    }
}
