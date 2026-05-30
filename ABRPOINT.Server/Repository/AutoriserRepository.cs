using ABRPOINT.Server.Data;
using ABRPOINT.Server.Dtaos;
using ABRPOINT.Server.Interfaces;
using ABRPOINT.Server.Models;
using Microsoft.EntityFrameworkCore;

namespace ABRPOINT.Server.Repository
{
    public class AutoriserRepository : IautoriserRepository
    {

        private readonly ApplicationDbContext _dbContext;
        public AutoriserRepository(ApplicationDbContext dbContext)
        {
            _dbContext = dbContext;
        }
        public async Task AddAsync(Autoriser autoriser)
        {
            try
            {
                autoriser.Conjour = "O";
                autoriser.Conamdep = autoriser.Conamdep ?? "0";
                autoriser.Conamret = autoriser.Conamret ?? "0";

                // Calculate hours difference between Conret and Condep
                if (autoriser.Condep.HasValue && autoriser.Conret.HasValue)
                {
                    var condep = autoriser.Condep.Value;
                    var conret = autoriser.Conret.Value;

                    // Créer une nouvelle date pour conret avec l'année de condep
                    var adjustedConret = new DateTime(
                        condep.Year,
                        condep.Month,
                        condep.Day,
                        conret.Hour,
                        conret.Minute,
                        conret.Second
                    );
                    autoriser.Conret = adjustedConret;

                    TimeSpan duration = autoriser.Conret.Value - autoriser.Condep.Value;
                    autoriser.Connbjour = (float)Math.Round(duration.TotalHours, 2); // Rounded to 2 decimal places
                }
                else
                {
                    autoriser.Connbjour = 0; // Default if dates are null
                }

                await _dbContext.Autorisers.AddAsync(autoriser);
                await _dbContext.SaveChangesAsync();
            }
            catch (Exception)
            {
                throw;
            }
        }
        private float? CalculateTotalDuration(DateTime? startDate, DateTime? endDate, string amDep, string amRet)
        {
            if (!startDate.HasValue || !endDate.HasValue)
                return null;

            // Calculate full days between dates (exclusive of start/end days)
            int fullDays = (endDate.Value.Date - startDate.Value.Date).Days - 1;

            // If end date is same as start date, we have a single day case
            if (fullDays < 0)
                fullDays = 0;

            // Parse day fractions (1 = full day, 0 = half day)
            bool isStartFullDay = amDep == "1";
            bool isEndFullDay = amRet == "1";

            // Calculate partial days
            float startDayValue = isStartFullDay ? 1f : 0.5f;
            float endDayValue = isEndFullDay ? 1f : 0.5f;

            // Total duration = start day + full days + end day
            float totalDuration = startDayValue + fullDays + endDayValue;

            return totalDuration;
        }
        public async Task AddMultipleAutorisation(List<Autoriser> autoriser)
        {
            try
            {
                foreach (var auth in autoriser)
                {
                    auth.Conjour = "O";
                    auth.Conamdep = auth.Conamdep ?? "0";
                    auth.Conamret = auth.Conamret ?? "0";

                    // Calculate hours difference between Conret and Condep
                    if (auth.Condep.HasValue && auth.Conret.HasValue)
                    {
                        var condep = auth.Condep.Value;
                        var conret = auth.Conret.Value;

                        // Créer une nouvelle date pour conret avec l'année de condep
                        var adjustedConret = new DateTime(
                            condep.Year,
                            condep.Month,
                            condep.Day,
                            conret.Hour,
                            conret.Minute,
                            conret.Second
                        );
                        auth.Conret = adjustedConret;

                        TimeSpan duration = auth.Conret.Value - auth.Condep.Value;
                        auth.Connbjour = (float)Math.Round(duration.TotalHours, 2); // Rounded to 2 decimal places
                    }
                    else
                    {
                        auth.Connbjour = 0; // Default if dates are null
                    }
                }

                await _dbContext.Autorisers.AddRangeAsync(autoriser);
                await _dbContext.SaveChangesAsync();
            }
            catch (Exception)
            {
                throw;
            }
        }

        public async Task DeleteAsync(Autoriser autoriser)
        {
            try
            {
                if (autoriser != null)
                {
                    _dbContext.Autorisers.Remove(autoriser);
                    await _dbContext.SaveChangesAsync();
                }
            }
            catch (Exception)
            {
                throw;
            }
        }

        public async Task<List<AutoriserEmployeDto>> GetAutoriserWithAbsenceAsync(string soccod, string uticod)
        {
            try
            {
                // BUG fix : avant on faisait un INNER JOIN sur Absences (`c.Abscod equals a.Abscod`).
                // Les autorisations issues d'une demande approuvée peuvent avoir `Abscod` null
                // (champ optionnel sur DemandeAutorisation → recopié tel quel dans Autoriser),
                // ce qui faisait disparaître TOUTES ces lignes de la liste. On passe en LEFT JOIN
                // et on scope correctement la jointure par tenant (Soccod, Abscod) pour éviter
                // toute fuite cross-tenant si un code d'absence est partagé entre sociétés.
                // Idem pour Employes : on joint sur (Soccod, Empcod) au lieu de Empcod seul.
                var rawResult = await (
                    from c in _dbContext.Autorisers
                    join e in _dbContext.Employes
                        on new { Soccod = c.Soccod, Empcod = c.Empcod } equals new { Soccod = (string?)e.Soccod, Empcod = (string?)e.Empcod }
                    join a in _dbContext.Absences
                        on new { Soccod = c.Soccod, Abscod = c.Abscod } equals new { Soccod = (string?)a.Soccod, Abscod = (string?)a.Abscod }
                        into absJoin
                    from a in absJoin.DefaultIfEmpty()
                    join su in _dbContext.Socusers
                        on new { e.Soccod, e.Sitcod } equals new { su.Soccod, su.Sitcod }
                    where e.Soccod == soccod
                        && su.Uticod == uticod
                    select new AutoriserEmployeDto
                    {
                        Concod = c.Concod,
                        Soccod = e.Soccod,
                        Emplib = e.Emplib,
                        Condat = c.Condat,
                        Condep = c.Condep,
                        Conret = c.Conret,
                        Connbjour = c.Connbjour,
                        Abslib = a != null ? a.Abslib : null,
                    }).ToListAsync();

                // Tri et dédoublonnage en mémoire
                var result = rawResult
                    .OrderByDescending(a => a.Condat)
                    .DistinctBy(s => s.Concod)
                    .ToList();

                return result;
            }
            catch (Exception ex)
            {
                throw;
            }
        }
        /// <summary>
        /// Liste TOUTES les autorisations de sortie de la société (écran de gestion admin),
        /// indépendamment du site de l'utilisateur connecté. Distinct de
        /// <see cref="GetAutoriserWithAbsenceAsync"/> qui scope par Socusers (self-service /
        /// visibilité par site) — d'où la liste vide à l'ouverture tant qu'aucun
        /// enregistrement n'était rattaché au site du compte courant.
        /// </summary>
        public async Task<List<AutoriserEmployeDto>> GetAllAutoriserWithAbsenceAsync(string soccod)
        {
            var rawResult = await (
                from c in _dbContext.Autorisers
                join e in _dbContext.Employes
                    on new { Soccod = c.Soccod, Empcod = c.Empcod } equals new { Soccod = (string?)e.Soccod, Empcod = (string?)e.Empcod }
                join a in _dbContext.Absences
                    on new { Soccod = c.Soccod, Abscod = c.Abscod } equals new { Soccod = (string?)a.Soccod, Abscod = (string?)a.Abscod }
                    into absJoin
                from a in absJoin.DefaultIfEmpty()
                where e.Soccod == soccod
                select new AutoriserEmployeDto
                {
                    Concod = c.Concod,
                    Soccod = e.Soccod,
                    Empcod = c.Empcod,
                    Emplib = e.Emplib,
                    Condat = c.Condat,
                    Condep = c.Condep,
                    Conret = c.Conret,
                    Connbjour = c.Connbjour,
                    Abscod = c.Abscod,
                    Abslib = a != null ? a.Abslib : null,
                }).ToListAsync();

            return rawResult
                .OrderByDescending(a => a.Condat)
                .DistinctBy(s => s.Concod)
                .ToList();
        }

        public async Task<IEnumerable<Autoriser>> GetAllAsync(string soccod,string uticod)
        {
            try
            {
                return await _dbContext.Autorisers.ToListAsync();
            }
            catch (Exception)
            {
                throw;
            }
        }

        public async Task<Autoriser?> GetByConcodAsync(string soccod, string concod)
        {
            try
            {
                return await _dbContext.Autorisers
                    .FirstOrDefaultAsync(a => a.Soccod == soccod && a.Concod == concod);
            }
            catch (Exception ex)
            {
                throw new Exception("Erreur innatendu: "+ex);
            }
        }

        public async Task UpdateAsync(Autoriser autoriser)
        {
            if (autoriser != null)
            {
                var condep = autoriser.Condep.Value;
                var conret = autoriser.Conret.Value;

                // Créer une nouvelle date pour conret avec l'année de condep
                var adjustedConret = new DateTime(
                    condep.Year,
                    condep.Month,
                    condep.Day,
                    conret.Hour,
                    conret.Minute,
                    conret.Second
                );
                autoriser.Conret = adjustedConret;
                TimeSpan duration = autoriser.Conret.Value - autoriser.Condep.Value;
                autoriser.Connbjour = (float)Math.Round(duration.TotalHours, 2); // Rounded to 2 decimal places
                _dbContext.Autorisers.Update(autoriser);
                await _dbContext.SaveChangesAsync();
            }
        }

        public async Task<AutDto?> GetAutLib(string? soccod, string? empcod, DateTime dmdate)
        {
            try
            {
                DateTime startOfDay = dmdate.Date;
                DateTime endOfDay = dmdate.Date.AddDays(1).AddTicks(-1);

                var autorisation = await (
                    from a in _dbContext.Autorisers
                    join ab in _dbContext.Absences on a.Abscod equals ab.Abscod
                    where a.Soccod == soccod
                        && a.Empcod == empcod
                        && a.Condep.Value.Day == dmdate.Day
                        && a.Condep <= endOfDay
                        && a.Conret >= startOfDay
                    select new
                    {
                        Abslib = ab.Abslib,
                        Condep = a.Condep,
                        Conret = a.Conret,
                        Connbjour = a.Connbjour,
                        Abspayer = ab.Abspayer
                    }
                ).FirstOrDefaultAsync();

                if (autorisation == null)
                    return null;


                return new AutDto()
                {
                    Abslib = autorisation.Abslib,
                    Connbjour = autorisation.Connbjour,
                    Condep = autorisation.Condep,
                    Conret = autorisation.Conret,
                    Abspayer = autorisation.Abspayer,
                };
            }
            catch (Exception)
            {
                throw;
            }
        }
        public async Task<Dictionary<(string Empcod, DateTime Date), AutDto?>> GetAutLibBatch(string soccod, string empcod, DateTime dateDeb, DateTime dateFin)
        {
            var result = await (
                from a in _dbContext.Autorisers
                join ab in _dbContext.Absences on a.Abscod equals ab.Abscod
                where a.Soccod == soccod && a.Soccod == ab.Soccod
                    && a.Empcod == empcod
                    && a.Condep.Value.Date <= dateFin
                    && a.Conret.Value.Date >= dateDeb
                select new
                {
                    a.Empcod,
                    a.Condep,
                    a.Conret,
                    ab.Abslib,
                    a.Connbjour,
                    ab.Abspayer
                })
                .ToListAsync();

            // Plusieurs autorisations peuvent partager la même clé (Empcod, Date) lorsqu'un employé
            // possède plus d'une autorisation le même jour. On regroupe pour éviter une exception
            // "duplicate key" dans ToDictionary et on retient la première occurrence.
            return result
                .GroupBy(x => (x.Empcod, Date: x.Condep.Value.Date))
                .ToDictionary(
                    g => g.Key,
                    g =>
                    {
                        var x = g.First();
                        return new AutDto
                        {
                            Abslib = x.Abslib,
                            Connbjour = x.Connbjour,
                            Condep = x.Condep,
                            Conret = x.Conret,
                            Abspayer = x.Abspayer
                        };
                    });
        }

        public async Task<IEnumerable<Autoriser>> GetAllAsync()
        {
            return await _dbContext.Autorisers.ToListAsync();
        }

        public async Task<Dictionary<(string Empcod, DateTime Date), AutDto>> GetAutLibBatch(string soccod,List<(string Empcod, DateTime Date)> demandes)
        {
            if (string.IsNullOrWhiteSpace(soccod))
                throw new ArgumentException(nameof(soccod));

            if (demandes == null || !demandes.Count.Equals(0) == false)
                return new Dictionary<(string, DateTime), AutDto>();

            var empcods = demandes.Select(d => d.Empcod).Distinct().ToList();
            var dates = demandes.Select(d => d.Date.Date).Distinct().ToList();

            DateTime minDate = dates.Min();
            DateTime maxDate = dates.Max().AddDays(1).AddTicks(-1);

            // ========================
            // 1️⃣ Requête SQL unique
            // ========================
            var data = await (
                from a in _dbContext.Autorisers
                join ab in _dbContext.Absences on a.Abscod equals ab.Abscod
                where a.Soccod == soccod
                      && empcods.Contains(a.Empcod)
                      && a.Condep <= maxDate
                      && a.Conret >= minDate
                select new
                {
                    a.Empcod,
                    Abslib = ab.Abslib,
                    a.Condep,
                    a.Conret,
                    a.Connbjour,
                    Abspayer = ab.Abspayer
                }
            ).ToListAsync();

            // ========================
            // 2️⃣ Filtrage en mémoire
            // ========================
            var result = new Dictionary<(string Empcod, DateTime Date), AutDto>();

            foreach (var d in demandes)
            {
                var startOfDay = d.Date.Date;
                var endOfDay = startOfDay.AddDays(1).AddTicks(-1);

                var aut = data.FirstOrDefault(a =>
                    a.Empcod == d.Empcod &&
                    a.Condep <= endOfDay &&
                    a.Conret >= startOfDay);

                if (aut == null)
                    continue;

                result[(d.Empcod, startOfDay)] = new AutDto
                {
                    Abslib = aut.Abslib,
                    Connbjour = aut.Connbjour,
                    Condep = aut.Condep,
                    Conret = aut.Conret,
                    Abspayer = aut.Abspayer
                };
            }

            return result;
        }
        public async Task<List<AutDto>> GetAutorisationsByPeriod(string soccod, string empcod, DateTime startDate, DateTime endDate)
        {
            try
            {
                return await (
                    from a in _dbContext.Autorisers
                    join ab in _dbContext.Absences on a.Abscod equals ab.Abscod
                    where a.Soccod == soccod &&
                          a.Empcod == empcod &&
                          a.Condep <= endDate &&
                          a.Conret >= startDate
                    select new AutDto
                    {
                        Abslib = ab.Abslib,
                        Connbjour = a.Connbjour,
                        Condep = a.Condep,
                        Conret = a.Conret,
                        Abspayer = ab.Abspayer
                    }
                ).ToListAsync();
            }
            catch (Exception)
            {
                throw;
            }
        }

        // Marker repris d'AutorisersController.cs — toute logique de filtrage
        // h.supp doit l'utiliser pour rester alignée sur ce que le mobile pose
        // dans conmotif lors de la création d'une demande de type "Heures sup.".
        private const string OvertimeMotifMarker = "[HEURES SUP]";

        public async Task<Dictionary<DateTime, OvertimeApprovalSummary>> GetOvertimeApprovalBatchAsync(
            string soccod, string empcod, DateTime startDate, DateTime endDate)
        {
            var startDay = startDate.Date;
            var endDayExclusive = endDate.Date.AddDays(1);

            // On indexe par condep.Date : c'est le jour réellement travaillé en
            // h.supp. condat (date de création de la demande) peut différer de
            // plusieurs jours (l'employé déclare a posteriori), donc il n'est
            // pas utilisable comme clé d'agrégation par jour.
            var rows = await _dbContext.Autorisers
                .AsNoTracking()
                .Where(a => a.Soccod == soccod
                            && a.Empcod == empcod
                            && a.Conmotif != null
                            && EF.Functions.ILike(a.Conmotif, "%" + OvertimeMotifMarker + "%")
                            && a.Condep.HasValue
                            && a.Condep.Value >= startDay
                            && a.Condep.Value < endDayExclusive)
                .Select(a => new
                {
                    a.Condep,
                    a.Conret,
                    a.Connbjour,
                    a.Conetat,
                    a.Concommentaire,
                    a.Contraitedat,
                })
                .ToListAsync();

            var result = new Dictionary<DateTime, OvertimeApprovalSummary>();
            if (rows.Count == 0) return result;

            // Groupe par jour (condep.Date) puis agrège les durées par état.
            // Préférence pour Connbjour (déjà calculé/persisté à la création)
            // avec fallback (conret - condep) si null — garde le bon
            // comportement même sur des lignes anciennes/migrées sans Connbjour.
            foreach (var dayGroup in rows.GroupBy(r => r.Condep!.Value.Date))
            {
                float approved = 0f, pending = 0f, rejected = 0f;
                string? latestComment = null;
                DateTime? latestCommentAt = null;
                var statuses = new HashSet<string>(StringComparer.OrdinalIgnoreCase);

                foreach (var r in dayGroup)
                {
                    var hours = r.Connbjour
                        ?? (r.Conret.HasValue
                            ? (float)Math.Round((r.Conret.Value - r.Condep!.Value).TotalHours, 2)
                            : 0f);
                    if (hours < 0) hours = 0;

                    var state = string.IsNullOrWhiteSpace(r.Conetat) ? "Pending" : r.Conetat!;
                    statuses.Add(state);

                    if (string.Equals(state, "Approved", StringComparison.OrdinalIgnoreCase))
                        approved += hours;
                    else if (string.Equals(state, "Rejected", StringComparison.OrdinalIgnoreCase))
                        rejected += hours;
                    else
                        pending += hours;

                    // Le commentaire affiché côté UI est celui de la décision la
                    // plus récente (utile quand l'admin refuse plusieurs lignes
                    // sur la même journée : on garde le motif courant).
                    if (!string.IsNullOrWhiteSpace(r.Concommentaire)
                        && (latestCommentAt == null
                            || (r.Contraitedat.HasValue && r.Contraitedat.Value > latestCommentAt)))
                    {
                        latestComment = r.Concommentaire;
                        latestCommentAt = r.Contraitedat;
                    }
                }

                string consolidated;
                if (statuses.Count == 1)
                    consolidated = statuses.First();
                else if (statuses.Contains("Rejected"))
                    consolidated = "Mixed"; // au moins une refusée + d'autres états — l'UI affiche Rejected en priorité
                else
                    consolidated = "Mixed";

                result[dayGroup.Key] = new OvertimeApprovalSummary(
                    Status: consolidated,
                    ApprovedHours: approved,
                    PendingHours: pending,
                    RejectedHours: rejected,
                    LatestComment: latestComment);
            }

            return result;
        }
    }
}
