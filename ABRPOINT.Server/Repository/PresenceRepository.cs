using ABRPOINT.Helper;
using ABRPOINT.Server.CalculService.Conge;
using ABRPOINT.Server.CalculService.HeureAbsences;
using ABRPOINT.Server.CalculService.HeureNuit;
using ABRPOINT.Server.CalculService.HeureRetard;
using ABRPOINT.Server.CalculService.HeureSupp;
using ABRPOINT.Server.Controllers;
using ABRPOINT.Server.Data;
using ABRPOINT.Server.Dtaos;
using ABRPOINT.Server.Interfaces;
using ABRPOINT.Server.Models;
using AutoMapper;
using AutoMapper.QueryableExtensions;
using FastReport.Data;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;

namespace ABRPOINT.Server.Repository
{
    public class PresenceRepository : IPresenceRepository
    {
        private readonly ApplicationDbContext _dbContext;
        private readonly IPosteRepository _posteRepository;
        private readonly IParametreRepository _parametreRepository;
        private readonly IHeureSuppService _heureSuppService;
        private readonly IHeureRetardService _heureRetardService;
        private readonly IHeureNuitService _heureNuitService;
        private readonly IJourFerieRepository _jourFerierRepository;
        private readonly IAllaitementRepository _allaitementRepository;
        private readonly ICongeCalculationService _congeCalculationService;
        private readonly ICongeRepository _congeRepository;
        private readonly ISanctionRepository _sanctionRepository;
        private readonly IEmployeRepository _employeRepository;
        private readonly IHeureRetardService _retardService;
        private readonly IHeureAbsencesService _absenceService;
        private readonly IautoriserRepository _autorisationRepository;
        private readonly IUtilisateurRepository _utilisateurRepository;
        private readonly IDmpointService _dmpointRepository;
        private readonly IMapper _mapper;
        public PresenceRepository(
            ApplicationDbContext dbContext,IPosteRepository posteRepository,IHeureSuppService heureSuppService,IEmployeRepository employeRepository,
            IParametreRepository parametreRepository,IMapper mapper,IHeureRetardService heureRetardService,IHeureNuitService heureNuitService,
            IJourFerieRepository jourFerieRepository,IAllaitementRepository allaitementRepository,ICongeCalculationService congeCalculationService,
            ISanctionRepository sanctionRepository,ICongeRepository congeRepository,IHeureRetardService retardService,IHeureAbsencesService absencesService,
            IautoriserRepository autorisationRepository,IUtilisateurRepository utilisateurRepository,IDmpointService dmpointService)
        {
            _dbContext = dbContext;
            _posteRepository = posteRepository;
            _employeRepository = employeRepository;
            _heureSuppService = heureSuppService;
            _heureRetardService = heureRetardService;
            _heureNuitService = heureNuitService;
            _retardService = retardService;
            _absenceService = absencesService;
            _parametreRepository = parametreRepository;
            _jourFerierRepository = jourFerieRepository;
            _allaitementRepository = allaitementRepository;
            _congeCalculationService = congeCalculationService;
            _sanctionRepository = sanctionRepository;
            _autorisationRepository = autorisationRepository;
            _congeRepository = congeRepository;
            _utilisateurRepository = utilisateurRepository;
            _dmpointRepository = dmpointService;
            _mapper = mapper;
        }
        public void Add(Presence presence)
        {
            _dbContext.Presences.Add(presence);
            _dbContext.SaveChanges();
        }

        public void Delete(Presence presence)
        {
            if (presence != null)
            {
                _dbContext.Presences.Remove(presence);
                _dbContext.SaveChanges();
            }
        }

        // Add this as a class-level cache dictionary
        private static readonly Dictionary<string, int> _longbdgCache = new Dictionary<string, int>();

        public async Task<PresenceDto?> AddPresence(string soccod,string empcod,DateTime date,string poicod)
        {
            PresenceDto? presenceDto = null;

            string formattedEmpcod = await FormatEmpcodCached(soccod, empcod);

            var emp = await _employeRepository.GetByEmpcod(soccod, formattedEmpcod);
            if (emp == null)
                return null;

            var poste = await _posteRepository.GetPoste(soccod, emp.Poscod);

            var dbpresence = await _dbContext.Presences
                .FirstOrDefaultAsync(p =>
                    p.Soccod == soccod &&
                    p.Empcod == formattedEmpcod &&
                    p.Predat.HasValue &&
                    p.Predat.Value.Date == date.Date);

            if (dbpresence == null)
            {
                dbpresence = await CreateNewPresence(
                    soccod, formattedEmpcod, date, emp, poste);

                await _dbContext.Presences.AddAsync(dbpresence);
            }
            else
            {
                await UpdateExistingPresence(dbpresence, date);
            }

            // 🔹 Mapping

            // 🔹 FORCER null => ""
            NormalizePresenceDto(dbpresence);

            // 🔹 Calculs métier
            await UpdateAsync(presenceDto);

            // 🔹 Historique pointage
            await _dmpointRepository.AddAsync(dbpresence, date, poicod);

            await _dbContext.SaveChangesAsync();

            return presenceDto;
        }
        private void NormalizePresenceDto(Presence dto)
        {
            dto.Preentmat ??= "";
            dto.Presortmat ??= "";
            dto.Preentamidi ??= "";
            dto.Presortamidi ??= "";
            dto.Preentsup ??= "";
            dto.Presortsup ??= "";
            dto.Tothnuit ??= "";
            dto.Tothsup ??= "";
            dto.Tothre ??= "";
            dto.Preobs ??= "";
        }

        // Cached version to avoid repeated database calls
        private async Task<string> FormatEmpcodCached(string soccod, string empcod)
        {
            try
            {
                if (string.IsNullOrWhiteSpace(empcod) || string.IsNullOrWhiteSpace(soccod))
                {
                    return empcod ?? string.Empty;
                }

                // Get from database and cache it
                short? longbdg = await _parametreRepository.GetLongbdg(soccod);
                // Extract numeric part and format
                string numericPart = new string(empcod.Where(char.IsDigit).ToArray());

                if (!string.IsNullOrEmpty(numericPart) && long.TryParse(numericPart, out long empcodNumber))
                {
                    return empcodNumber.ToString($"D{longbdg}");
                }

                return empcod;
            }
            catch (Exception)
            {
                return empcod ?? string.Empty;
            }
        }

        private async Task<Presence> CreateNewPresence(string soccod, string empcod, DateTime date, dynamic emp, dynamic poste)
        {
            var presence = new Presence()
            {
                Ordre = 1,
                Empcod = empcod,
                Predat = date.Date,
                Empmat = empcod,
                Sitcod = emp?.Sitcod,
                Codposte = emp?.Poscod,
                Empreg = emp?.Empreg,
                Catcod = emp?.Catcod,
                Sercod = emp?.Sercod,
                Dmdate = DateTime.Now.Date,
                Soccod = soccod,
                Preentmat = date.ToString("HH:mm"),
                Preentmatup = date.ToString("HH:mm"),
                Optimise = "N",
                Totcmp = 0,
                Preavantent = poste?.Avantent,
                Preapresent = poste?.Apresent,
                Preavantsort = poste?.Avantsort,
                Preapressort = poste?.Apressort,
                Empcharge = emp?.Emptype,
                Prerepas = GenericMethodes.GetRepasWorkDay(date, poste),
                Prerepos = GenericMethodes.GetReposWorkDay(date, poste),
            };
            var presenceDto = _mapper.Map<PresenceDto>(presence);
            if(presence.Codposte != null)
                presence.Tothre = await CalcHreTrav(presenceDto,poste);
            return presence;
        }

        private async Task UpdateExistingPresence(Presence dbpresence, DateTime date)
        {
            // ⚡ Récupération du paramètre parecart (en minutes)
            var param = await _dbContext.Parametres.FirstOrDefaultAsync();
            float parecart = param?.Parecart ?? 0;

            string dateStr = date.ToString("HH:mm");

            // ✅ Check if update is allowed based on time difference
            if (!CanUpdatePresence(dbpresence, date, parecart))
                return;

            // ✅ Update the next available time slot
            UpdateNextAvailableTimeSlot(dbpresence, dateStr);
        }

        private bool CanUpdatePresence(Presence dbpresence, DateTime date, float parecart)
        {
            // ✅ Trouver la dernière valeur non vide (dernier log)
            string lastLog = GetLastLogTime(dbpresence);

            if (string.IsNullOrEmpty(lastLog))
                return true;

            // ⚡ Convertir en DateTime pour comparer
            if (DateTime.TryParseExact(lastLog, "HH:mm", null, System.Globalization.DateTimeStyles.None, out var lastLogTime))
            {
                TimeSpan diff = date.TimeOfDay - lastLogTime.TimeOfDay;
                return diff.TotalMinutes >= parecart;
            }

            return true;
        }

        private string GetLastLogTime(Presence dbpresence)
        {
            // Return the last non-empty time log in chronological order
            if (!string.IsNullOrEmpty(dbpresence.Presortamidi))
                return dbpresence.Presortamidi;
            if (!string.IsNullOrEmpty(dbpresence.Preentamidi))
                return dbpresence.Preentamidi;
            if (!string.IsNullOrEmpty(dbpresence.Presortmat))
                return dbpresence.Presortmat;
            if (!string.IsNullOrEmpty(dbpresence.Preentmat))
                return dbpresence.Preentmat;

            return null;
        }

        private void UpdateNextAvailableTimeSlot(Presence dbpresence, string timeStr)
        {
            if (string.IsNullOrEmpty(dbpresence.Presortmat))
            {
                dbpresence.Presortmat = timeStr;
                dbpresence.Presortmatup = timeStr;
            }
            else if (string.IsNullOrEmpty(dbpresence.Preentamidi))
            {
                dbpresence.Preentamidi = timeStr;
                dbpresence.Preentamidiup = timeStr;
            }
            else if (string.IsNullOrEmpty(dbpresence.Presortamidi))
            {
                dbpresence.Presortamidi = timeStr;
                dbpresence.Presortamidiup = timeStr;
            }
            var presenceDto = _mapper.Map<PresenceDto>(dbpresence);


        }

        private async Task UpdatePresenceCalculations(Presence dbpresence, dynamic poste)
        {
            var presenceDto = _mapper.Map<PresenceDto>(dbpresence);

            // ✅ Calculate night hours and format as "HH:mm"
            var nightHours = await _heureNuitService.CalculateHeureNuit(presenceDto);
            dbpresence.Tothnuit = FormatNightHours(nightHours);

            // ✅ Calculate overtime hours and format as "HH:mm"
            var overtimeMinutes = await _heureSuppService.CalculateHeureSupp(presenceDto, poste);
            var hretrav = await CalcHreTrav(presenceDto,poste);
            dbpresence.Tothsup = FormatMinutesToTimeSpan(overtimeMinutes);
        }

        private string FormatNightHours(object nightHours)
        {
            if (nightHours == null)
                return "00:00";

            // If it's already a string, try to parse and reformat it
            if (nightHours is string strValue)
            {
                if (string.IsNullOrEmpty(strValue))
                    return "00:00";

                // If it's already in HH:mm format, return as is
                if (TimeSpan.TryParse(strValue, out var timeSpan))
                    return timeSpan.ToString(@"hh\:mm");

                // If it's a number as string (minutes), convert it
                if (int.TryParse(strValue, out var minutes))
                    return TimeSpan.FromMinutes(minutes).ToString(@"hh\:mm");

                return strValue; // Return original if can't parse
            }

            // If it's an integer (minutes)
            if (nightHours is int intValue)
                return TimeSpan.FromMinutes(intValue).ToString(@"hh\:mm");

            // If it's a TimeSpan
            if (nightHours is TimeSpan timeSpanValue)
                return timeSpanValue.ToString(@"hh\:mm");

            // Default fallback
            return "00:00";
        }

        private string FormatTimeSpan(TimeSpan? timeSpan)
        {
            if (!timeSpan.HasValue)
                return "00:00";

            return timeSpan.Value.ToString(@"hh\:mm");
        }

        private string FormatMinutesToTimeSpan(int minutes)
        {
            var timeSpan = TimeSpan.FromMinutes(minutes);
            return timeSpan.ToString(@"hh\:mm");
        }

        public PresenceDto Get(string soccod, string empcod, DateTime predat)
        {
            try
            {
                PresenceDto? presence = _dbContext.Presences
                    .ProjectTo<PresenceDto>(_mapper.ConfigurationProvider)
                    .Where(p => p.Soccod == soccod
                            && p.Empcod == empcod && p.Predat == predat)
                        .FirstOrDefault();

                return presence;
            }
            catch (Exception ex)
            {

                throw new Exception("",ex);
            }
        }
        public async Task<float?> GetNbJours(string empcod, DateTime? dateDeb, DateTime? dateFin)
        {
            try
            {
                float? nbJours = 0;
                var presences = await _dbContext.Presences
                    .Where(p => p.Empcod == empcod && p.Dmdate >= dateDeb && p.Dmdate <= dateFin)
                    .ToListAsync();

                foreach (var p in presences)
                {
                    var conge = await _congeRepository.GetCongeLib(p.Soccod, p.Empcod, (DateTime)p.Dmdate);
                    if (GenericMethodes.IsValid(p) && string.IsNullOrEmpty(conge) )
                        nbJours++;
                }

                return nbJours;
            }
            catch (Exception)
            {
                throw;
            }
        }
        
        public IEnumerable<Presence> GetAll()
        {
            return _dbContext.Presences.ToList();
        }

        public async Task<IEnumerable<EtatEmpPresence>> GetAllAsync(string soccod,DateTime dateDebut,DateTime dateFin,string regime,List<string> empcods)
        {
            try
            {
                // =========================
                // 1️⃣ Requête SQL (SANS empcods.Contains)
                // =========================
                var query =
                    from p in _dbContext.Presences

                    join e in _dbContext.Employes
                        on new { p.Soccod, p.Empcod }
                        equals new { e.Soccod, e.Empcod }
                        into empJoin
                    from e in empJoin.DefaultIfEmpty()

                    where p.Soccod == soccod
                          && p.Predat >= dateDebut
                          && p.Predat <= dateFin
                          && (regime == "T" || p.Empreg == regime)

                    select new
                    {
                        Presence = p,
                        Employe = e,

                        HasConge = _dbContext.Conges.Any(c =>
                            c.Soccod == p.Soccod &&
                            c.Empcod == p.Empcod &&
                            c.Condep <= p.Predat &&
                            c.Conret >= p.Predat),

                        HasAllaitement = _dbContext.Allaitements.Any(a =>
                            a.Soccod == p.Soccod &&
                            a.Empcod == p.Empcod &&
                            a.Condat == p.Predat)
                    };

                var data = await query.ToListAsync();

                // =========================
                // 2️⃣ Filtre empcods EN MÉMOIRE
                // =========================
                if (empcods != null && empcods.Any())
                {
                    data = data
                        .Where(x => empcods.Contains(x.Presence.Empcod))
                        .ToList();
                }

                // =========================
                // 3️⃣ Construction du résultat
                // =========================
                var result = new List<EtatEmpPresence>();

                foreach (var item in data)
                {
                    var p = item.Presence;
                    string motif;
                    if (!string.IsNullOrWhiteSpace(p.Codposte) &&
                        await _parametreRepository.IsEmpfeRepos(p.Soccod, p.Predat, p.Codposte,item.Employe.Empferepos))
                    {
                        motif = "J. Repos";
                    }
                    else
                    {
                        motif = await _sanctionRepository.GetAbsenceLib(
                            p.Soccod,
                            p.Empcod,
                            p.Predat ?? default
                        );
                    }

                    result.Add(new EtatEmpPresence
                    {
                        Predat = p.Predat ?? default,
                        Empcod = p.Empcod,
                        EmpSite = p.Sitcod,
                        Empmat = p.Empmat,
                        Regime = p.Empreg,
                        TotalHeure = p.Tothre,
                        Emplib = item.Employe?.Emplib ?? "Anonyme",
                        HeureNuit = p.Tothnuit,

                        Entree1 = p.Preentmatup,
                        Entree2 = p.Preentamidiup,
                        Sortie1 = p.Presortmatup,
                        Sortie2 = p.Presortamidiup,

                        preretmateup = p.Preretmateup.HasValue
                            ? TimeOnly.FromDateTime(p.Preretmateup.Value)
                            : default,

                        preretameup = p.Preretameup.HasValue
                            ? TimeOnly.FromDateTime(p.Preretameup.Value)
                            : default,

                        preretmatsup = p.Preretmatsup.HasValue
                            ? TimeOnly.FromDateTime(p.Preretmatsup.Value)
                            : default,

                        preretamsup = p.Preretamsup.HasValue
                            ? TimeOnly.FromDateTime(p.Preretamsup.Value)
                            : default,

                        TotalRetard =
                            (p.Preretmateup?.TimeOfDay ?? TimeSpan.Zero)
                            .Add(p.Preretameup?.TimeOfDay ?? TimeSpan.Zero)
                            .ToString(@"hh\:mm"),

                        HasConge = item.HasConge.ToString(),
                        Allaitement = item.HasAllaitement,
                        Motif = motif
                    });
                }

                return result;
            }
            catch (Exception)
            {
                throw;
            }
        }

        public Presence GetByAbscod(string soccod, string empcod)
        {
            return _dbContext.Presences.FirstOrDefault(s => s.Soccod == soccod && s.Empcod == empcod);
        }

        public async Task<IEnumerable<Presence>> GetEmpEtatPeriodiqueAsync(string soccod,string empcod)
        {
            return await _dbContext.Presences.Where(p=>p.Soccod == soccod && p.Empcod == empcod).ToListAsync();
        }
        public async Task<IEnumerable<PresenceDto>> GetEmpEtatPeriodiqueAsync(string soccod, string empcod, DateTime dateDeb, DateTime dateFin)
        {
            try
            {
                // 1️⃣ Récupérer les présences existantes
                var presenceList = await _dbContext.Presences
                    .ProjectTo<PresenceDto>(_mapper.ConfigurationProvider)
                    .Where(p => p.Soccod == soccod
                                && p.Empcod == empcod
                                && p.Predat >= dateDeb
                                && p.Predat <= dateFin)
                    .ToListAsync();

                // 2️⃣ Batch des postes
                var employePostes = await _posteRepository.GetEmployePosteBatch(soccod, empcod, dateDeb, dateFin);

                // 3️⃣ Batch des sanctions, autorisations, congés, feriés, poicod
                var sanctions = await _sanctionRepository.GetAbsenceLibBatch(soccod, empcod, dateDeb, dateFin);
                var autorisations = await _autorisationRepository.GetAutLibBatch(soccod, empcod, dateDeb, dateFin);
                var conges = await _congeRepository.GetCongeEmployeLibBatch(soccod, empcod, dateDeb, dateFin);
                var feriers = await _jourFerierRepository.GetByFerdateBatch(soccod, dateDeb, dateFin);
                var poicods = await _dmpointRepository.GetPoicodBatch(soccod, empcod, dateDeb, dateFin);

                // 4️⃣ Construire un dictionnaire pour lookup rapide
                var presenceDict = presenceList.ToDictionary(p => p.Dmdate.Value.Date);

                var allDates = new List<PresenceDto>();

                for (DateTime date = dateDeb; date <= dateFin; date = date.AddDays(1))
                {
                    // 5️⃣ Créer présence si absente
                    presenceDict.TryGetValue(date.Date, out var presence);

                    if (presence == null)
                    {
                        presence = new PresenceDto
                        {
                            Soccod = soccod,
                            Empcod = empcod,
                            Dmdate = date,
                            Predat = date,
                            Codposte = employePostes.GetValueOrDefault((Empcod: empcod, Date: date))
                        };
                    }

                    // 6️⃣ Lookup batch
                    if (!sanctions.TryGetValue((empcod, date), out var sanction)) sanction = null;
                    if (!autorisations.TryGetValue((empcod, date), out var autorisation)) autorisation = null;
                    if (!feriers.TryGetValue(date, out var ferier)) ferier = null;

                    // ✅ Récupérer le congé avec Connbjour
                    string? conge = null;
                    float? connbjour = null;

                    // Chercher dans le dictionnaire avec tous les Connbjour possibles
                    var congeEntry = conges.FirstOrDefault(c =>
                        c.Key.Soccod == soccod &&
                        c.Key.Empcod == empcod &&
                        c.Key.Date == date);

                    if (congeEntry.Key != default)
                    {
                        conge = congeEntry.Value;
                        connbjour = congeEntry.Key.connbjour;
                    }

                    presence.Etat = sanction
                                    ?? autorisation?.Abslib
                                    ?? conge
                                    ?? ferier?.Fermotif;

                    presence.Poicod = poicods.GetValueOrDefault((empcod, date));

                    // 7️⃣ Calcul temps
                    if (string.IsNullOrEmpty(presence.Codposte))
                    {
                        presence.Codposte = await _posteRepository.GetEmpPoste(presence.Soccod, presence.Empcod, presence.Dmdate);
                    }

                    if (!string.IsNullOrEmpty(presence.Codposte))
                    {
                        bool isRepos = false;
                        var (isPreRepos, emprepos) = await _parametreRepository.IsEmpcodRepos(soccod, date, presence.Codposte, empcod);
                        if (presence.Empmat == null)
                            isRepos = await _parametreRepository.IsRepos(soccod, date, presence.Codposte);

                        ArrondiParam? arrondiparams = await _parametreRepository.GetEtatPeriodiqueParamAsync(soccod);
                        presence.Arrondi = arrondiparams.Arrondi;
                        presence.Arrhsup = arrondiparams.Arrhsup;

                        if (isPreRepos || isRepos)
                        {
                            if (emprepos != "0" && emprepos != "-1")
                                presence.Etat = "J.Repos";
                            presence.Prerepos = "1";
                        }
                        var poste = await _posteRepository.GetPoste(soccod, presence.Codposte);
                        presence.TotalHeure = await _posteRepository.GetJourHeures(soccod, date, presence.Codposte);
                        presence.Tothre = await CalcHreTrav(presence,poste);
                        //float? absheure = await _absenceService.CalculateHeureAbsences(_mapper.Map<Presence>(presence),soccod,presence.Codposte,presence.Dmdate,autorisations.GetValueOrDefault((empcod, date)));
                        //presence.Tothabs = GenericMethodes.ConvertDoubleToHHmm(absheure);

                        // 🔴 CAS JOUR FÉRIÉ : forcer les heures et ignorer le calcul normal
                        if (ferier != null)
                        {
                            presence.Etat = ferier.Fermotif;

                            var ferHeure = await _jourFerierRepository.GetFerheure(soccod, presence.Dmdate);

                            if (ferHeure.HasValue)
                            {
                                var time = TimeSpan.FromHours(ferHeure.Value);
                                presence.Tothre = time.ToString(@"hh\:mm");
                                presence.TotalHeure = ferHeure;
                            }
                            else
                            {
                                presence.Tothre = "00:00";
                                presence.TotalHeure = 0;
                            }

                            allDates.Add(presence);
                            continue;
                        }

                        // ✅ CAS CONGÉ avec gestion de Connbjour
                        if (!string.IsNullOrEmpty(conge))
                        {
                            var nbhconge = await _parametreRepository.GetNbhConge(soccod);

                            // Si Connbjour est 0.5, diviser les heures par 2
                            float heuresConge = (connbjour.HasValue && connbjour.Value == 0.5f)
                                ? (nbhconge ?? 0) * 0.5f
                                : (nbhconge ?? 0);

                            var time = TimeSpan.FromHours(heuresConge);
                            presence.Tothre = time.ToString(@"hh\:mm");
                            presence.TotalHeure = heuresConge;

                            // Afficher "Congé 0.5" ou "Congé 1"
                            presence.Etat = $"{conge} {(connbjour ?? 1)}";

                            allDates.Add(presence);
                            continue;
                        }
                        TimeSpan totalTime = TimeSpan.Zero;

                        // Étape 1 : Ajouter tothsup à tothre
                        if (!string.IsNullOrEmpty(presence.Tothsup) && !string.IsNullOrEmpty(presence.Tothre))
                        {
                            if (TimeSpan.TryParse(presence.Tothsup, out TimeSpan tothsup) &&
                                TimeSpan.TryParse(presence.Tothre, out TimeSpan tothre))
                            {
                                totalTime = tothre.Add(tothsup);
                                presence.Tothre = $"{(int)totalTime.TotalHours:D2}:{totalTime.Minutes:D2}";
                            }
                        }

                        // Étape 2 : Ajouter Totcmp (heures décimales)
                        if (!string.IsNullOrEmpty(presence.Tothre) && presence.Totcmp.HasValue)
                        {
                            if (TimeSpan.TryParse(presence.Tothre, out TimeSpan tothreActuel))
                            {
                                totalTime = tothreActuel.Add(TimeSpan.FromHours(presence.Totcmp.Value));
                                presence.Tothre = $"{(int)totalTime.TotalHours:D2}:{totalTime.Minutes:D2}";
                            }
                        }

                        // Calcul du retard
                        int retard = await _retardService.CalculateHeureRetard(presence, poste, autorisations.GetValueOrDefault((empcod, date)));
                        presence.Totret = $"{retard / 60:D2}:{retard % 60:D2}";
                    }

                    allDates.Add(presence);
                }

                return allDates;
            }
            catch (Exception)
            {
                throw;
            }
        }
        public async void Update(Presence presence)
        {
            try
            {
                if (presence != null)
                {
                    await CalculatePresence(presence);
                    _dbContext.Presences.Update(presence);
                    _dbContext.SaveChanges();
                }
            }
            catch (Exception ex)
            {

                throw new Exception("",ex);
            }
            
        }
        public async Task CalculatePresence(Presence presence)
        {
            var transaction = await _dbContext.Database.BeginTransactionAsync();

            try
            {
                if (presence != null)
                {
                    var parameters = new[]
                    {
                        new SqlParameter("@psoccod", presence.Soccod ?? (object)DBNull.Value),
                        new SqlParameter("@psocmere", presence.Soccod ?? (object)DBNull.Value), // Assuming same as psoccod
                        new SqlParameter("@psitcod", presence.Sitcod ?? (object)DBNull.Value),
                        new SqlParameter("@pannee", presence.Predat?.Year.ToString() ?? (object)DBNull.Value),
                        new SqlParameter("@pmois", presence.Predat?.Month.ToString("00") ?? (object)DBNull.Value),
                        new SqlParameter("@pmodcod", presence.Preobs ?? "SYSTEM"), // Using Preobs as modcod?
                        new SqlParameter("@puticod", "API"), // Or get from auth context
                        new SqlParameter("@pempcod", presence.Empcod ?? (object)DBNull.Value),
                        new SqlParameter("@pempreg", presence.Empreg ?? "0"),
                        new SqlParameter("@pfontype", "1"), // Default value
                        new SqlParameter("@pempnuit", "0"), // Default value
                        new SqlParameter("@pempmaxhre", 10.0), // Default value or get from employee
                        new SqlParameter("@pempminhjour", 4.0), // Default value or get from employee
                        new SqlParameter("@pcaltype", "STANDARD"), // Default value
                        new SqlParameter("@pdte", presence.Predat ?? DateTime.Now),
                        new SqlParameter("@pcatcod", presence.Catcod ?? (object)DBNull.Value),
                        new SqlParameter("@pcodposte", presence.Codposte ?? (object)DBNull.Value),
                        new SqlParameter("@pdtedeb", presence.Predat ?? DateTime.Now), // Same as pdte
                        new SqlParameter("@pdtefin", presence.Predat ?? DateTime.Now),
            };

                    await _dbContext.Database.ExecuteSqlRawAsync(
                        "EXEC [dbo].[calcul_impupd] @psoccod, @psocmere, @psitcod, @pannee, @pmois, @pmodcod, @puticod, " +
                        "@pempcod, @pempreg, @pfontype, @pempnuit, @pempmaxhre, @pempminhjour, @pcaltype, @pdte, @pcatcod, " +
                        "@pcodposte, @pdtedeb, @pdtefin",
                        parameters);

                    await _dbContext.Entry(presence).ReloadAsync();
                    await transaction.CommitAsync();
                }
            }
            catch (Exception ex)
            {
                await transaction.RollbackAsync();
                throw new Exception("Error calculating presence", ex);
            }
        }


        private async Task<(float? nbHeurSupp, int nbRetard)> CalculateDayWorkMetrics(PresenceDto presence)
        {
            try
            {
                // Add null check for Dmdate
                if (!presence.Dmdate.HasValue)
                {
                    return (0, 0);
                }
                string codpost = presence.Codposte;
                if(string.IsNullOrEmpty(presence.Codposte))
                    codpost = await _posteRepository.GetEmpPoste(presence.Soccod,presence.Empcod, presence.Predat);
                var poste = await _posteRepository.GetPoste(presence.Soccod, codpost);

                if (poste == null) return (0, 0);

                AutDto? autorisation = await _autorisationRepository.GetAutLib(
                    presence.Soccod,
                    presence.Empcod,
                    presence.Dmdate.Value); // Safe to use .Value now

                return (
                    await _heureSuppService.CalculateHeureSupp(presence, poste),
                    await _heureRetardService.CalculateHeureRetard(presence, poste, autorisation)
                );
            }
            catch (Exception ex)
            {
                throw new ApplicationException("Error calculating work metrics", ex);
            }
        }

        public async Task<double?> GetPreRepas(string empcod, DateTime? predate)
        {
            try
            {
                double? prerepas = await _dbContext.Presences.Where(p => p.Empcod == empcod && p.Predat == predate).Select(p => p.Prerepas)
                    .SingleOrDefaultAsync();
                return prerepas;
            }
            catch (Exception)
            {
                throw;
            }
        }



        public async Task UpdateAsync(PresenceDto presence)
        {
            try
            {
                if (presence != null)
                {
                    Poste? poste = null;
                    if(string.IsNullOrEmpty(presence.Codposte))
                    {
                        string? codpost = await _posteRepository.GetEmpPoste(presence.Soccod, presence.Empcod, presence.Predat);
                        poste = await _posteRepository.GetPoste(presence.Soccod, codpost);
                        presence.Codposte = codpost;
                    }
                    // Calculs
                    var (nbHeurSupp, nbRetard) = await CalculateDayWorkMetrics(presence);
                    float? heuresNuit = await _heureNuitService.CalculateHeureNuit(presence);

                    presence.Totret = $"{nbRetard / 60:D2}:{nbRetard % 60:D2}";
                    presence.Tothre = await CalcHreTrav(presence,poste);

                    float? tothreInHours = GenericMethodes.ConvertHHmmToDouble(presence.Tothre);

                    int suppHours = (int)(nbHeurSupp / 60);
                    int suppMinutes = (int)(nbHeurSupp % 60);
                    presence.Tothsup = $"{suppHours:D2}:{suppMinutes:D2}";

                    TimeSpan nuitTimeSpan = TimeSpan.FromHours((double)heuresNuit);
                    presence.Tothnuit = $"{nuitTimeSpan.Hours:D2}:{nuitTimeSpan.Minutes:D2}";

                    if (tothreInHours == 0)
                        presence.Prerepas = 0;

                    // ✅ Charger l'entité existante
                    var existingPresence = await _dbContext.Presences
                        .FirstOrDefaultAsync(p => p.Empcod == presence.Empcod
                                               && p.Predat == presence.Predat);

                    if (existingPresence != null)
                    {
                        // ✅ Mapper DTO → entité déjà suivie
                        _mapper.Map(presence, existingPresence);

                        await _dbContext.SaveChangesAsync();
                    }
                }
            }
            catch (Exception ex)
            {
                throw new Exception("Error updating presence record", ex);
            }
        }

        private TimeSpan? ParseSafe(string? value)
        {
            if (string.IsNullOrWhiteSpace(value))
                return null;
            return TimeSpan.Parse(value);
        }

        private async Task<string?> CalcHreTrav(PresenceDto presence,Poste poste)
        {
            try
            {
                // 🔹 Étape 0 : Récupérer le paramètre d'arrondi
                var paramArrondi = await _parametreRepository.GetEtatPeriodiqueParamAsync(presence.Soccod);
                float arrondi = paramArrondi?.Arrondi ?? 0f; // en minutes

                // Étape 1 : Récupération des infos
                AutDto autorisation = await _autorisationRepository.GetAutLib(presence.Soccod, presence.Empcod, (DateTime)presence.Dmdate);
                if(poste == null)
                {
                    var codpost = await _posteRepository.GetEmpPoste(presence.Soccod, presence.Empcod, presence.Predat);
                    presence.Codposte = codpost;
                    poste = await _posteRepository.GetPoste(presence.Soccod, codpost);
                }
                presence.Codposte = poste.Codposte;
                float? totalPosteJourHeures = await _posteRepository.GetJourHeures(presence.Soccod, presence.Dmdate, presence.Codposte);
                var (nbHeurSupp, nbRetard) = await CalculateDayWorkMetrics(presence);

                // Heures de base (y compris autorisation via GetJourHeures si pas travaillées)
                float? totalHeure = totalPosteJourHeures;

                double hretrv = CalcNbHeure(presence.Preentmatup, presence.Presortmatup, presence.Preentamidiup,
                    presence.Presortamidiup, presence.Preentasupup, presence.Presortsupup, presence.Prerepas);
                hretrv += ((double)nbHeurSupp - nbRetard) /60f;
                // Étape 2 : Ajout heures d'autorisation si absence de présence
                if (autorisation?.Condep != null && autorisation?.Conret != null)
                {
                    var condep = autorisation.Condep.Value;
                    var conret = autorisation.Conret.Value;

                    // Création des périodes de présence
                    List<(TimeSpan start, TimeSpan end)> presencePeriods = new();

                    if (TimeSpan.TryParse(presence.Preentmatup, out var entMat) && TimeSpan.TryParse(presence.Presortmatup, out var sortMat))
                        presencePeriods.Add((entMat, sortMat));

                    if (TimeSpan.TryParse(presence.Preentamidiup, out var entPm) && TimeSpan.TryParse(presence.Presortamidiup, out var sortPm))
                        presencePeriods.Add((entPm, sortPm));

                    // Autorisation
                    var authStart = condep.TimeOfDay;
                    var authEnd = conret.TimeOfDay;
                    TimeSpan totalAutorisedNotWorked = TimeSpan.Zero;
                    var authPeriod = (start: authStart, end: authEnd);

                    foreach (var period in GetOverlappingPeriods(authPeriod, presencePeriods))
                    {
                        totalAutorisedNotWorked += period;
                    }

                    TimeSpan authTotal = authEnd - authStart;
                    TimeSpan authWorked = totalAutorisedNotWorked;
                    TimeSpan authNotWorked = authTotal - authWorked;
                    hretrv += (float)authNotWorked.TotalHours;
                }

                // 🔹 Étape 2.5 : Appliquer l'arrondi (EN MINUTES)
                if (arrondi > 0)
                {
                    // Convertir les heures en minutes
                    float totalMinutes = (float)hretrv * 60f;

                    // Arrondir au multiple supérieur
                    totalMinutes = (float)(Math.Floor(totalMinutes / arrondi) * arrondi);

                    // Reconvertir en heures
                    hretrv = totalMinutes / 60f;
                }
                // ✅ Convertir des heures (double) en TimeSpan
                TimeSpan totalHeureTimeSpan = TimeSpan.FromHours(hretrv);
                if(string.IsNullOrEmpty(presence.Tothre) || presence.Tothre == "00:00")
                    presence.Tothre = $"{totalHeureTimeSpan.Hours:D2}:{totalHeureTimeSpan.Minutes:D2}";

                    // Étape 4 : Contrôle des plafonds
                    EtatPresenceParametreDto param = await _parametreRepository.GetEtatPresenceParametres(presence.Soccod);

                if (!string.IsNullOrEmpty(presence.Tothre) &&
                    TimeSpan.TryParse(presence.Tothre, out TimeSpan tothreTime) &&
                    param.Nbhtr3M.HasValue)
                {
                    float tothreDecimal = (float)tothreTime.TotalHours;

                    if (param.Nbhtr3M.Value != 0 && param.Tauxtr3M != 0 && param.Nbhtr3M.Value < tothreDecimal)
                    {
                        presence.Tothre = param.Tauxtr3M?.ToString("0.##");
                    }
                }

                return presence.Tothre;
            }
            catch (Exception)
            {
                throw;
            }
        }

        private List<TimeSpan> GetOverlappingPeriods((TimeSpan start, TimeSpan end) basePeriod, List<(TimeSpan start, TimeSpan end)> workedPeriods)
        {
            List<TimeSpan> overlaps = new();

            foreach (var work in workedPeriods)
            {
                if (work.end <= basePeriod.start || work.start >= basePeriod.end)
                    continue;

                var overlapStart = work.start > basePeriod.start ? work.start : basePeriod.start;
                var overlapEnd = work.end < basePeriod.end ? work.end : basePeriod.end;

                overlaps.Add(overlapEnd - overlapStart);
            }

            return overlaps;
        }

        private double CalcNbHeure(string? ent1, string? sort1, string? ent2, string? sort2, string? ent3, string? sort3, float? repas)
        {
            try
            {

                // Parse the string inputs to TimeSpan or DateTime before performing subtraction  
                TimeSpan hours1 = TimeSpan.Zero;
                TimeSpan hours2 = TimeSpan.Zero;
                TimeSpan hours3 = TimeSpan.Zero;
                if (!string.IsNullOrEmpty(ent1) && !string.IsNullOrEmpty(sort1))
                {
                    hours1 = DateTime.Parse(sort1).TimeOfDay - DateTime.Parse(ent1).TimeOfDay;
                }

                if (!string.IsNullOrEmpty(ent2) && !string.IsNullOrEmpty(sort2))
                {
                    hours2 = DateTime.Parse(sort2).TimeOfDay - DateTime.Parse(ent2).TimeOfDay;
                }

                if (!string.IsNullOrEmpty(ent3) && !string.IsNullOrEmpty(sort3))
                {
                    hours3 = DateTime.Parse(sort3).TimeOfDay - DateTime.Parse(ent3).TimeOfDay;
                }
                if (repas == null) repas = 0;
                // Convert TimeSpan to total hours and subtract repose  
                var res = (double)(hours1.TotalHours + hours2.TotalHours + hours3.TotalHours - ((repas / 60) ) );
                if (res < 0)
                    res = 0;
                return res;
            }
            catch (Exception)
            {
                throw;
            }
        }
       // PresenceRepository.cs implementation example
        public async Task<Presence> GetPresenceByEmployeeAndTime(string soccod, string empcode, DateTime time)
        {
            // Check if a presence record exists within a 1-minute window to avoid duplicates
            var timeWindow = TimeSpan.FromMinutes(1);
            var startTime = time.Subtract(timeWindow);
            var endTime = time.Add(timeWindow);

            return await _dbContext.Presences
                .FirstOrDefaultAsync(p =>
                    p.Soccod == soccod &&
                    p.Empcod == empcode &&
                    p.Predat >= startTime &&
                    p.Predat <= endTime);
        }
        public async Task<PresenceSemaineData> GetPresenceSemaineData(string soccod, string empcod, string mois, string annee, string semaine,string emppanier)
        {
            try
            {

                float? nbhFerierTrv = 0;
                int? nbNuits = 0;
                float? hreNuits = 0;
                float? retards = 0;
                float? hreabs = 0;
                float? nbhFerier = 0;
                float? hreRepos = 0;
                int? nbjourFerier = 0;
                float totalHours = 0;
                float? nbJours = 0;
                float? maladie = 0;
                int? nbJourPointer = 0;
                float? nbjourCng = 0;
                float? nbHreCng = 0;
                int nbJourRepos = 0;
                float? deplacement = 0;
                float? nbhAllaitement = 0;
                float? csf = 0;
                float? hcsf = 0;
                float? css = 0;
                float? map = 0;
                float? fm = 0;
                float? absnj = 0;
                float? absj = 0;
                float? absnp = 0;
                float? ct = 0;
                float? hct = 0;
                float? act = 0;
                int? panier = 0;
                float? joursameditrv = 0;
                float? hresameditrv = 0;
                IDictionary<string, string> weekDetails = new Dictionary<string, string>();

                // Validate input parameters
                if (string.IsNullOrEmpty(soccod) || string.IsNullOrEmpty(empcod) ||
                    string.IsNullOrEmpty(mois) || string.IsNullOrEmpty(annee))
                {
                    return null;
                }
                // Parse month and year
                if (!int.TryParse(mois, out int month) || !int.TryParse(annee, out int year))
                {
                    return null;
                }

                // Get the company's month configuration
                ParametreMoisPointageDto parametreMoisPointage = await _parametreRepository.GetParametreMoisPointage(soccod);
                if (parametreMoisPointage == null)
                {
                    return null;
                }

                // Determine the actual start and end dates based on company parameters
                DateTime startDate, endDate;
                // If a specific week is requested (not "0" which means all weeks)
               
                // For the start date
                if (parametreMoisPointage.Moisdeb == "P") // Previous month
                {
                    var previousMonth = month == 1 ? 12 : month - 1;
                    var previousYear = month == 1 ? year - 1 : year;
                    startDate = new DateTime(previousYear, previousMonth, parametreMoisPointage.DebutCalc);
                }
                else // Current month
                {
                    startDate = new DateTime(year, month, parametreMoisPointage.DebutCalc);
                }

                // For the end date
                if (parametreMoisPointage.Moisfin == "P") // Previous month
                {
                    var previousMonth = month == 1 ? 12 : month - 1;
                    var previousYear = month == 1 ? year - 1 : year;
                    endDate = new DateTime(previousYear, previousMonth, int.Parse(parametreMoisPointage.Joufin));
                }
                else // Current month
                {
                    endDate = new DateTime(year, month, int.Parse(parametreMoisPointage.Joufin));
                }

                // Adjust for month boundaries (e.g., if day is 31 but month only has 30 days)
                startDate = AdjustDayToMonth(startDate);
                endDate = AdjustDayToMonth(endDate);

                // Filter by employee and date range
                var query = _dbContext.Presences
                    .Where(p => p.Soccod == soccod &&
                                p.Empcod == empcod &&
                                p.Predat >= startDate &&
                                p.Predat <= endDate);
                DateTime weekStart;
                DateTime weekEnd;
                if (semaine != "0" && int.TryParse(semaine, out int weekNumber) && weekNumber > 0)
                {
                    if (weekNumber == 1)
                    {
                        // First week: start from startDate, even if it's not Monday
                        weekStart = startDate;

                        // End on first Sunday or endDate
                        weekEnd = weekStart;
                        while (weekEnd.DayOfWeek != DayOfWeek.Sunday && weekEnd < endDate)
                        {
                            weekEnd = weekEnd.AddDays(1);
                        }

                        // Adjust endDate to this week's end to constrain the loop later
                        endDate = weekEnd;
                    }
                    else
                    {
                        // Find the (weekNumber - 1)th Sunday after startDate
                        int sundaysFound = 0;
                        DateTime currentDay = startDate;

                        while (sundaysFound < weekNumber - 1 && currentDay <= endDate)
                        {
                            if (currentDay.DayOfWeek == DayOfWeek.Sunday)
                            {
                                sundaysFound++;
                            }
                            currentDay = currentDay.AddDays(1);
                        }

                        // Set weekStart to next Monday
                        weekStart = currentDay;
                        while (weekStart.DayOfWeek != DayOfWeek.Monday && weekStart <= endDate)
                        {
                            weekStart = weekStart.AddDays(1);
                        }

                        // Set weekEnd to the following Sunday or endDate
                        weekEnd = weekStart;
                        while (weekEnd.DayOfWeek != DayOfWeek.Sunday && weekEnd < endDate)
                        {
                            weekEnd = weekEnd.AddDays(1);
                        }
                    }

                    // Cap weekEnd within the overall endDate range
                    weekEnd = weekEnd > endDate ? endDate : weekEnd;

                    // Filter presence records in that week
                    if (weekStart <= endDate && weekEnd >= startDate && weekStart <= weekEnd)
                    {
                        query = query.Where(p => p.Predat >= weekStart && p.Predat <= weekEnd);
                    }
                    else
                    {
                        query = query.Where(p => false); // Week outside of period
                    }
                    endDate = weekEnd;
                    startDate = weekStart;
                }

                // Step 1: Generate all dates in the selected period
                List<DateTime> allDates = new List<DateTime>();
                DateTime day = startDate;
                while (day <= endDate)
                {
                    allDates.Add(day);
                    day = day.AddDays(1);
                }

                // Step 2: Load all relevant presence records
                var presences = await query.ToListAsync();
                var presencesByDate = presences
                    .Where(p => p.Predat.HasValue)
                    .ToDictionary(p => p.Predat.Value.Date);
                // Step 3: Iterate over all days, with or without presence
                foreach (var date in allDates)
                {
                    AutDto autorisation = await _autorisationRepository.GetAutLib(soccod, empcod, date);
                    IDictionary<string, bool> countedSanction = new Dictionary<string, bool>();
                    //presencesByDate.TryGetValue(date.Date, out var presence); // May be null
                    if(date != null && presencesByDate.TryGetValue(date.Date,out var presence))
                    {
                        weekDetails.Add(date.ToString(), GetWeekDetails(presence, date));
                        // Do all your processing, even if `presence` is null
                        // For example, check sanctions:
                        SanctionDto? sanction = await _sanctionRepository.GetAbsence(soccod, empcod, date);
                        if (sanction != null)
                        {
                            if (sanction.Abspaye == "N")
                                absnp += sanction.Connbjour;
                            if (sanction.Abscng == "6")
                            {
                                deplacement = sanction.Connbjour;
                                fm = sanction.Connbjour;
                            }
                            if (sanction.Abscng == "1")
                            {
                                csf = sanction.Connbjour;
                                if (parametreMoisPointage.Nbhconge != 0)
                                    hcsf += parametreMoisPointage.Nbhconge;
                            }
                            if (sanction.Abscng == "5")
                                css = sanction.Connbjour;
                            if (sanction.Abscng == "4")
                                map = sanction.Connbjour;
                            if (sanction.Abscng == "3")
                                absnj = sanction.Connbjour;
                            if (sanction.Abscng == "2")
                                absj = sanction.Connbjour;
                            if (sanction.Abscng == "8")
                                act = sanction.Connbjour;
                            if (sanction.Abscng == "9" && sanction.Abslib.ToLower() == "maladie")
                                maladie = sanction.Connbjour;
                            if (sanction.Abscng == "A")
                            {
                                ct = sanction.Connbjour;
                            }
                            if (!string.IsNullOrEmpty(sanction?.Concod))
                            {
                                if (!countedSanction.TryGetValue(sanction.Concod, out bool isSanctionCounted))
                                {
                                    if (sanction.Abspaye == "N")
                                        nbJours -= sanction.Connbjour;

                                    countedSanction.Add(sanction.Concod, true);
                                }
                            }

                        }

                        IDictionary<string, bool> countedConge = new Dictionary<string, bool>();
                        if (((GenericMethodes.NotPresent(presence) || !GenericMethodes.IsValid(presence)) && sanction == null))
                        {
                            string? poste = await _employeRepository.GetEmpPoste(soccod, empcod, date);
                            var (isRepos, emprepos) = await _parametreRepository.IsEmpcodRepos(soccod, date, poste, empcod);
                            string conge = await _congeRepository.GetCongeLib(soccod, empcod, date);
                            if (!isRepos && string.IsNullOrEmpty(conge))
                            {
                                var res = await _absenceService.CalculateHeureAbsences(presence, soccod, poste, date,autorisation);
                                if (!GenericMethodes.IsValid(presence) || (GenericMethodes.NotPresent(presence)))
                                {
                                    hreabs += res;
                                    absnp++;
                                    absnj++;
                                }

                            }
                            if (!string.IsNullOrEmpty(conge))
                            {
                                string? codpost = await _employeRepository.GetEmpPoste(soccod, empcod, date);
                                NombreConge nombreConge = await _congeCalculationService
                                    .CalculerNbJourAndHreCongePaye(soccod, empcod, date, codpost);
                                if (!string.IsNullOrEmpty(sanction?.Concod))
                                {
                                    if (nombreConge.Concod != null && !countedConge.TryGetValue(nombreConge?.Concod, out bool isCongeCounted) && nombreConge?.nbJourConge != 0)
                                    {
                                        nbjourCng += nombreConge?.nbJourConge;
                                        if (parametreMoisPointage.Nbhconge != 0)
                                            nbHreCng += parametreMoisPointage.Nbhconge;
                                        else
                                            nbHreCng += nombreConge?.nbHeureConge;
                                        nbJours -= nombreConge?.nbJourConge;
                                        countedConge.Add(nombreConge.Concod, true);
                                    }
                                }
                                                                
                            }

                            bool isFerier = await _jourFerierRepository.IsFerier(soccod, date);
                            if (isFerier)
                            {
                                var codpost = await _employeRepository.GetEmpPoste(soccod, empcod, date);
                                var hreJour = await _posteRepository.GetJourHeures(soccod, date, codpost);
                                nbhFerier += hreJour;
                            }
                        }


                        // If there's a presence record, process it
                        if (presence != null)
                        {
                                // ... ton code existant pour les sanctions, congés, fériés, etc. ...

                                bool isFerier = await _jourFerierRepository.IsFerier(soccod, date);
                                string? conge = await _congeRepository.GetCongeLib(soccod, empcod, date);

                                // Calcul du panier uniquement si ce n'est ni congé ni férié
                                if (!isFerier && string.IsNullOrEmpty(conge))
                                {
                                        float nbHeuresJour = 0;

                                        if (!string.IsNullOrEmpty(presence.Tothre) && TimeSpan.TryParseExact(presence.Tothre, "hh\\:mm", null, out TimeSpan h))
                                        {
                                            nbHeuresJour = (float)h.TotalHours;
                                        }
                                        DateTime startMonthReal;
                                        if(month == 1)
                                            startMonthReal = new DateTime(year, 12, parametreMoisPointage.DebutReel);
                                        else
                                            startMonthReal = new DateTime(year, month - 1, parametreMoisPointage.DebutReel);
                                        if (startMonthReal <= presence.Dmdate)
                                        {
                                             if (emppanier == "1" && nbHeuresJour >= 7) panier++;
                                             if (emppanier == "2" && nbHeuresJour >= 6) panier++;
                                        }
                                        var codpost = await _posteRepository.GetEmpPoste(soccod, empcod, date);
                                        var (isrepos, emprepos) = await _parametreRepository.IsEmpcodRepos(soccod, date, codpost, empcod); 
                                        if(presence.Predat.Value.DayOfWeek == DayOfWeek.Saturday && GenericMethodes.ConvertHHmmToDouble(presence.Tothre)>0 && isrepos)
                                            {
                                              joursameditrv++;
                                              hresameditrv += GenericMethodes.ConvertHHmmToDouble(presence.Tothre);
                                            }
                                }
                            ParametreNuitDto parametreNuit = await _parametreRepository.GetParametresNuitAsync(soccod);
                            TimeSpan? heureDebutNuit = TimeSpan.TryParse(parametreNuit.Nuitdeb, out var debut) ? debut : null;
                            TimeSpan? heureFinNuit = TimeSpan.TryParse(parametreNuit.Nuitfin, out var fin) ? fin : null;
                            if (heureDebutNuit.HasValue && heureFinNuit.HasValue)
                            {
                                TimeSpan? heureEntree = TimeSpan.TryParse(presence.Preentmatup, out var ent) ? ent :
                                 TimeSpan.TryParse(presence.Preentamidiup, out var ent2) ? ent2 : null;

                                TimeSpan? heureSortie = TimeSpan.TryParse(presence.Presortamidiup, out var sort) ? sort :
                                                         TimeSpan.TryParse(presence.Presortmatup, out var sort2) ? sort2 : null;
                                if (heureDebutNuit.HasValue && heureFinNuit.HasValue && heureEntree.HasValue && heureSortie.HasValue)
                                {
                                    DateTime dateDebut = date.Date;
                                    DateTime entree = dateDebut.Add(heureEntree.Value);
                                    DateTime sortie = dateDebut.Add(heureSortie.Value);

                                    DateTime debutNuit = dateDebut.Add(heureDebutNuit.Value);
                                    DateTime finNuit = heureFinNuit > heureDebutNuit
                                        ? dateDebut.Add(heureFinNuit.Value)
                                        : dateDebut.AddDays(1).Add(heureFinNuit.Value); // nuit qui passe minuit

                                    // Ajuster si la sortie est après minuit
                                    if (sortie < entree)
                                        sortie = sortie.AddDays(1);

                                    // Calcul de l’intersection
                                    DateTime overlapStart = entree > debutNuit ? entree : debutNuit;
                                    DateTime overlapEnd = sortie < finNuit ? sortie : finNuit;

                                    if (overlapEnd > overlapStart)
                                    {
                                        var heuresNuit = (float)(overlapEnd - overlapStart).TotalHours;
                                        hreNuits += heuresNuit;
                                        nbNuits++;
                                    }
                                }

                            }
                            if (presence.Prerepos == "0" && !string.IsNullOrWhiteSpace(presence.Codposte))
                            {
                                var poste = await _posteRepository.GetPoste(soccod, presence.Codposte);
                                var presencedto = _mapper.Map<Presence, PresenceDto>(presence);
                                retards += await _retardService.CalculateHeureRetard(presencedto, poste, autorisation);
                            }
                            if (GenericMethodes.IsValid(presence) && !GenericMethodes.NotPresent(presence))
                                nbJourPointer++;
                            NombreConge nombreConge = await _congeCalculationService
                              .CalculerNbJourAndHreCongePaye(soccod, empcod, presence?.Predat, presence?.Codposte);
                            if (nombreConge.Concod != null && !countedConge.TryGetValue(nombreConge?.Concod, out bool isCongeCounted) && nombreConge?.nbJourConge != 0)
                            {
                                nbjourCng += nombreConge?.nbJourConge;
                                if (parametreMoisPointage.Nbhconge != 0)
                                    nbHreCng += parametreMoisPointage.Nbhconge;
                                else
                                    nbHreCng += nombreConge?.nbHeureConge;
                                nbJours -= nombreConge?.nbJourConge;
                                countedConge.Add(nombreConge.Concod, true);
                            }

                            if (sanction?.Connbjour != 0 && nombreConge?.nbJourConge != 0 && !string.IsNullOrEmpty(presence?.Tothre) || presence?.Tothre == "00:00")
                                nbJours++;
                            nbhAllaitement += await _allaitementRepository.GetNbhAllaitement(soccod, empcod, date);
                            if (!string.IsNullOrEmpty(presence.Tothre) && TimeSpan.TryParseExact(presence.Tothre, "hh\\:mm", null, out TimeSpan hours))
                            {
                                var hreFerierTrav = await _jourFerierRepository.GetHeureFerieTrav(soccod, presence.Predat, presence.Tothre);

                                nbhFerierTrv += hreFerierTrav;
                                if (hreFerierTrav != 0)
                                {
                                    var hreJour = await _posteRepository.GetJourHeures(soccod, date, presence.Codposte);
                                    nbjourFerier++;
                                    nbJours--;
                                    nbhFerier += hreJour;
                                }

                                totalHours += (float)hours.TotalHours;
                                if (presence.Prerepos == "1")
                                {
                                    if (string.IsNullOrEmpty(presence.Codposte))
                                        presence.Codposte = await _posteRepository.GetEmpPoste(soccod, empcod, date);
                                    var (isrepos, emprepos) = await _parametreRepository.IsEmpcodRepos(soccod,date,presence.Codposte,empcod);
                                    if (isrepos)
                                    {
                                        hreRepos += (float)hours.TotalHours;
                                        nbJourRepos++;
                                    }
                                }
                            }
                        }
                    }
                }
                if (nbJours < 0) nbJours = 0;
                return new PresenceSemaineData {
                    NbJourConge = nbjourCng, NbHeureConge = nbHreCng, NbJourPointer = nbJourPointer, NbJourFerier = nbjourFerier,NbJourCngPaye = nbjourCng,
                    NbhFerierTrv = nbhFerierTrv,HreFerier = nbhFerier,NbhAllaitement = nbhAllaitement, TotalHours = totalHours ,HeureRepos = hreRepos,
                    JourRepos = nbJourRepos,Deplacement = deplacement,NbJours = nbJours,CSF = csf,HCSF = hcsf,Maladie = maladie,CSS = css,MAP = map,
                    FM = fm,Absnj = absnj,Absj = absj,CT = ct,ACT = act,Absnp = absnp,WeekDetails = weekDetails,TotalRetards = retards,
                    NbNuits = nbNuits,HreNuits = hreNuits, TotalAbsence = hreabs,Panier = panier,HreSamediTrv = hresameditrv,JourSamediTrv = joursameditrv
                };

            }
            catch (Exception)
            {
                throw;
            }
        }

        private string GetWeekDetails(Presence presence, DateTime date)
        {
            try
            {
                if (presence != null)
                    return presence.Tothre;
                else
                    return  "_";  
            }
            catch (Exception)
            {
                throw;
            }
        }
        // Helper method to adjust day to fit within month boundaries
        private DateTime AdjustDayToMonth(DateTime date)
        {
            // If the day exceeds the number of days in the month, use the last day of the month
            int daysInMonth = DateTime.DaysInMonth(date.Year, date.Month);
            return date.Day > daysInMonth ? new DateTime(date.Year, date.Month, daysInMonth) : date;
        }

        public async Task<PresenceStatistics> GetStatistics(DateTime startDate, DateTime endDate)
        {
            var presences = await _dbContext.Presences
                .Where(p => p.Predat >= startDate && p.Predat <= endDate)
                .ToListAsync();

            var totalEmployees = presences.Select(p => p.Empcod).Distinct().Count();
            var today = DateTime.Today;
            var todayPresences = presences.Where(p => p.Predat.Value.Date == today).ToList();

            return new PresenceStatistics
            {
                TotalEmployees = totalEmployees,
                PresentToday = todayPresences.Count(p => p.Preentmatup != null),
                AbsentToday = todayPresences.Count(p => p.Preentmatup == null),
                TotalRetards = presences.Count(p => !string.IsNullOrEmpty(p.Preentmatup)),
                AttendanceRate = totalEmployees > 0
                    ? (decimal)todayPresences.Count(p => p.Preentmatup != null) / totalEmployees * 100
                    : 0
            };
        }

        public async Task<List<AbsenceInfo>> GetRecentAbsences(DateTime startDate, DateTime endDate, int limit)
        {
            return await _dbContext.Presences
                .Where(p => p.Predat >= startDate && p.Predat <= endDate && p.Preentmatup == null)
                .OrderByDescending(p => p.Predat)
                .Take(limit)
                .Select(p => new AbsenceInfo
                {
                    EmployeeName = p.Empcod,
                    Date = p.Predat.Value.Date,
                    Motif = p.Empreg ?? "Non spécifié"
                })
                .ToListAsync();
        }

        public async Task<GlobalStatistics> GetGlobalStatistics()
        {
            var totalEmployees = await _dbContext.Employes.CountAsync();
            var thisMonth = DateTime.Today.Month;
            var thisYear = DateTime.Today.Year;

            var monthlyPresences = await _dbContext.Presences
                .Where(p => p.Predat.Value.Month == thisMonth && p.Predat.Value.Year == thisYear)
                .ToListAsync();

            var totalHours = 20;
            //var totalHours = monthlyPresences.Sum(p => p.Tothre ?? 0);
            var workDays = DateTime.DaysInMonth(thisYear, thisMonth);
            var expectedPresences = totalEmployees * workDays;
            var actualPresences = monthlyPresences.Count(p => p.Preentmatup != null);

            return new GlobalStatistics
            {
                TotalEmployees = totalEmployees,
                AverageMonthlyAttendance = expectedPresences > 0
                    ? (decimal)actualPresences / expectedPresences * 100
                    : 0,
                TotalHoursThisMonth = totalHours
            };
        }
    }
}
