using ABRPOINT.Server.Data;
using ABRPOINT.Server.Models;
using Microsoft.EntityFrameworkCore;

namespace ABRPOINT.Server.Repository
{
    public class PointageOptimizer
    {
        private readonly ApplicationDbContext _context;
        private readonly string _societe;
        private readonly bool _isAccessDatabase;

        // Time tracking variables
        private DateTime? wentree1;
        private DateTime? wsortie1;
        private DateTime? wentree2;
        private DateTime? wsortie2;
        private DateTime? wentree3;
        private DateTime? wsortie3;
        private DateTime? wentree4;
        private DateTime? wsortie4;

        // Other variables
        private string zparmaxhjour = "12:00";
        private string wcodposte;
        private string wplancat;
        private string zcodposte;
        private string zcatcod;
        private string wparreperiod = "0";
        private int? wrepas;
        private decimal wdouche;
        private string wrepos = "0";
        private int wavantsort;
        private int wapressort;
        private int wavantent;
        private int wapresent;
        private string wdm_mat;
        private DateTime? wdm_dat;
        private string wcodemp;
        private string[] jour = new string[8] { "", "lun", "mar", "mer", "jeu", "ven", "sam", "dim" };
        private string[] catsem = new string[13];
        private string[] catposte = new string[13];
        private string[] semfiltre = new string[13];
        private string[] catfiltre = new string[13];

        // Reference to UI form (would need proper implementation)
        private dynamic frm_opt;
        private dynamic pwd;
        private string? whentm;
        private string? whenta;
        private string? whsortm;
        private string? whsorta;
        private string? whdrepas;
        private string? whfrepas;
        private TimeSpan? whentmdeb;
        private string? whentadeb;
        private TimeSpan? whentmfin;
        private string? whentafin;
        private TimeSpan? wnbhjour;

        public PointageOptimizer(ApplicationDbContext context, string societe, bool isAccessDatabase)
        {
            _context = context;
            _societe = societe;
            _isAccessDatabase = isAccessDatabase;
        }

        public void OptimizePointage(bool lireImp, string empMat, DateTime dateOptim)
        {
            var wii = 1;
            var wdatopt = new DateTime(2000, 1, 1);

            try
            {
                var parametre = _context.Parametres.FirstOrDefault(p => p.Soccod == _societe);
                if (parametre != null && parametre.Optimise.HasValue)
                {
                    wdatopt = parametre.Optimise.Value;
                }

                if (lireImp)
                {
                    if (!ShowConfirmation("Voulez-vous lancer l'optimisation de pointage maintenant?"))
                    {
                        return;
                    }

                    if (empMat == "*")
                    {
                        var employeesToUpdate = _context.Employes
                            .Where(e => e.Empoptim == null && e.Soccod == _societe)
                            .ToList();

                        foreach (var emp in employeesToUpdate)
                        {
                            emp.Empoptim = wdatopt;
                        }
                        _context.SaveChanges();
                    }
                    var result = from presence in _context.Presences
                                 join emp in _context.Employes
                                 on presence.Empcod equals emp.Empcod
                                 where presence.Soccod == _societe &&
                                       (empMat != "*"
                                            ? presence.Empcod == empMat && presence.Predat == dateOptim
                                            : presence.Predat >= wdatopt || (emp.Empoptim == null && presence.Predat >= wdatopt))
                                 select new
                                 {
                                     presence.Dmdate,
                                     presence.Predat,
                                     EmployeName = emp.Emplib
                                 };

                    var list = result.ToList();


                }
                else
                {
                    var presences = _context.Presences
                        .Where(p => p.Soccod == _societe)
                        .OrderBy(p => p.Empcod)
                        .ThenBy(p => p.Predat)
                        .ToList();

                    foreach (var presence in presences)
                    {
                        ProcessPresenceRecord(presence, wdatopt, lireImp);
                    }
                }

                if (empMat == "*")
                {
                    if (parametre != null)
                    {
                        parametre.Optimise = wdatopt;
                        _context.SaveChanges();
                    }
                }
            }
            catch (Exception ex)
            {
                throw new Exception("Optimization failed: " + ex.Message, ex);
            }
        }

        private void ProcessPresenceRecord(Presence presence, DateTime wdatopt, bool lireImp)
        {
            wcodemp = presence.Empcod;
            wdm_mat = wcodemp;
            wdm_dat = presence.Predat;
            var wcatcod = "";
            var wempcat = "";
            var wjourconfirme = false;
            var wjourvalider = true;

            var lpointjour = _context.Lpointjours
                .FirstOrDefault(l => l.Soccod == _societe &&
                                     l.Empcod == wcodemp &&
                                     l.Saljour == presence.Predat);

            if (lpointjour != null && (lpointjour.Salnbj > 0 || lpointjour.Salnbh > 0))
            {
                wjourconfirme = true;
            }

            if (!wjourconfirme)
            {
                var employee = _context.Employes
                    .FirstOrDefault(e => e.Empcod == wcodemp && e.Soccod == _societe);

                if (employee != null)
                {
                    wcatcod = employee.Catcod;
                    wempcat = wcatcod;

                    if (employee.Empmaxjour > 0)
                    {
                        var whh = (int)employee.Empmaxjour;
                        var wmn = (employee.Empmaxjour - whh) * 60;
                        zparmaxhjour = $"{whh:00}:{wmn:00}";
                    }

                    wdatopt = employee.Empoptim ?? new DateTime(2000, 1, 1);
                }

                var planHoraire = _context.Planhoraires
                    .FirstOrDefault(p => p.Soccod == _societe &&
                                        p.Empcod == wcodemp &&
                                        p.Plandate == presence.Predat);

                if (planHoraire != null)
                {
                    if (!string.IsNullOrEmpty(planHoraire.Planposte))
                    {
                        wcodposte = planHoraire.Planposte;
                    }
                    if (!string.IsNullOrEmpty(planHoraire.Plancat))
                    {
                        wplancat = planHoraire.Plancat;
                        wcatcod = wplancat ?? wcatcod;
                    }
                }

                // Initialize time variables from presence record
                wentree1 = ParseNullableDateTime(presence.Preentmatup);
                wsortie1 = ParseNullableDateTime(presence.Presortmatup);
                wentree2 = ParseNullableDateTime(presence.Preentamidiup);
                wsortie2 = ParseNullableDateTime(presence.Presortamidiup);
                wentree3 = ParseNullableDateTime(presence.Preentsupup);
                wsortie3 = ParseNullableDateTime(presence.Presortsupup);
                wentree4 = ParseNullableDateTime(presence.Preentasupup);
                wsortie4 = ParseNullableDateTime(presence.Presortasupup);

                // Process the time entries
                RecalcDmpoint();
                VoirDmpoint(wdm_dat, true);
                VoirCodposte();

                // Update presence record
                presence.Codposte = zcodposte;
                presence.Catcod = zcatcod;

                presence.Preentmatup = wentree1?.ToString("HH:mm");
                presence.Presortmatup = wsortie1?.ToString("HH:mm");
                presence.Preentamidiup = wentree2?.ToString("HH:mm");
                presence.Presortamidiup = wsortie2?.ToString("HH:mm");
                presence.Preentsupup = wentree3?.ToString("HH:mm");
                presence.Presortsupup = wsortie3?.ToString("HH:mm");
                presence.Preentasupup = wentree4?.ToString("HH:mm");
                presence.Presortasupup = wsortie4?.ToString("HH:mm");
                presence.Prerepas = wrepas;
                presence.Prerepos = wrepos;
                presence.Preavantent = wavantent;
                presence.Preapresent = wapresent;
                presence.Preavantsort = wavantsort;
                presence.Preapressort = wapressort;

                _context.SaveChanges();
            }

            if (wparreperiod == "1")
            {
                ProcessSpecialPeriod(presence);
            }
        }

        private void RecalcDmpoint()
        {
            // Handle time entry adjustments
            if (wsortie4.HasValue && !wentree4.HasValue)
            {
                wentree4 = wsortie4;
                wsortie4 = null;
            }
            if (wentree4.HasValue && !wsortie3.HasValue)
            {
                wsortie3 = wentree4;
                wentree4 = null;
            }
            if (wsortie3.HasValue && !wentree3.HasValue)
            {
                wentree3 = wsortie3;
                wsortie3 = null;
            }
            if (wentree3.HasValue && !wsortie2.HasValue)
            {
                wsortie2 = wentree3;
                wentree3 = null;
            }
            if (wsortie2.HasValue && !wentree2.HasValue)
            {
                wentree2 = wsortie2;
                wsortie2 = null;
            }
            if (wentree2.HasValue && !wsortie1.HasValue)
            {
                wsortie1 = wentree2;
                wentree2 = null;
            }
            if (wsortie1.HasValue && !wentree1.HasValue)
            {
                wentree1 = wsortie1;
                wsortie1 = null;
            }

            // Check if entry equals tomorrow's exit
            bool wok_entree = false;
            if (wentree1.HasValue && wsortie1.HasValue && wok_entree)
            {
                wok_entree = false;
                bool wok_sortie = false;

                var dmpoints = _context.Dmpoints
                    .Where(d => d.Empcod == wdm_mat && d.Dmdat == wdm_dat)
                    .OrderBy(d => d.Dmhre)
                    .ToList();

                foreach (var dm in dmpoints)
                {
                    if (dm.Dmhre.HasValue)
                    {
                        string dmTime = dm.Dmhre.Value.ToString("HH:mm");
                        if (dmTime == wentree1.Value.ToString("HH:mm"))
                        {
                            wok_entree = true;
                        }
                        else if (dmTime == wsortie1.Value.ToString("HH:mm"))
                        {
                            wok_sortie = true;
                        }
                    }
                }

                if (wok_sortie && !wok_entree)
                {
                    var tomorrowDmpoints = _context.Dmpoints
                        .Where(d => d.Empcod == wdm_mat && d.Dmdat == wdm_dat.Value.AddDays(1))
                        .OrderBy(d => d.Dmhre)
                        .ToList();

                    foreach (var dm in tomorrowDmpoints)
                    {
                        if (dm.Dmhre.HasValue)
                        {
                            string dmTime = dm.Dmhre.Value.ToString("HH:mm");
                            if (dmTime == wentree1.Value.ToString("HH:mm"))
                            {
                                wok_entree = true;
                            }
                            else if (dmTime == wsortie1.Value.ToString("HH:mm"))
                            {
                                wok_sortie = false;
                            }
                        }
                    }

                    if (wok_entree && wok_sortie)
                    {
                        var temp = wentree1;
                        wentree1 = wsortie1;
                        wsortie1 = temp;
                    }
                }
            }

            // Update the presence record
            var presence = _context.Presences
                .FirstOrDefault(p => p.Empcod == wdm_mat && p.Soccod == _societe && p.Predat == wdm_dat);

            if (presence != null)
            {
                presence.Preentmat = wentree1?.ToString("HH:mm");
                presence.Presortmat = wsortie1?.ToString("HH:mm");
                presence.Preentamidiup = wentree2?.ToString("HH:mm");
                presence.Presortamidiup = wsortie2?.ToString("HH:mm");
                presence.Preentsupup = wentree3?.ToString("HH:mm");
                presence.Presortsupup = wsortie3?.ToString("HH:mm");
                presence.Preentasupup = wentree4?.ToString("HH:mm");
                presence.Presortasupup = wsortie4?.ToString("HH:mm");

                _context.SaveChanges();
            }
        }

        private void VoirDmpoint(DateTime? wdte, bool wdmfile)
        {
            bool wjourvalider = true;

            if (pwd != null && pwd.frm == "frm_opt" && frm_opt.jourvalid.Value == 1)
            {
                wjourvalider = false;
            }

            if (wjourvalider)
            {
                var lpointjour = _context.Lpointjours
                    .FirstOrDefault(l => l.Soccod == _societe &&
                                        l.Empcod == wdm_mat &&
                                        l.Saljour == wdte.Value.AddDays(1));

                if (lpointjour != null && (lpointjour.Salnbj > 0 || lpointjour.Salnbh > 0))
                {
                    if (pwd != null && pwd.frm == "frm_opt")
                    {
                        frm_opt.emppnt.AddItem($"{wcodemp} {wdte} {lpointjour.Salnbh} Pour {wdte}");
                    }
                    return;
                }
            }

            if (whentm != null && whsortm != null)
            {
                bool wpasdemain = false;
                if (wentree1.HasValue && wsortie1.HasValue &&
                    wentree1 < wsortie1 && whsortm != null && wentree1.Value.TimeOfDay <= TimeSpan.Parse(whsortm))
                {
                    wpasdemain = true;
                }

                if (wentree1.HasValue && !wpasdemain)
                {
                    IQueryable<Dmpoint> query;
                    if (wdmfile)
                    {
                        query = _context.Dmpoints;
                    }
                    else
                    {
                        query = _context.Dmpresences.Cast<Dmpoint>();
                    }

                    var dmpoints = query
                        .Where(d => d.Empcod == wdm_mat &&
                                    d.Soccod == _societe &&
                                    d.Dmdat == wdte.Value.AddDays(1))
                        .OrderBy(d => d.Dmhre)
                        .ToList();

                    if (dmpoints.Any())
                    {
                        var firstDm = dmpoints.First();
                        if (firstDm.Dmhre.HasValue)
                        {
                            var wdmhre = firstDm.Dmhre.Value.TimeOfDay;
                            var zhentmdeb = whentmdeb ?? new TimeSpan(16, 0, 0);
                            zhentmdeb = zhentmdeb.Subtract(new TimeSpan(1, 0, 0));

                            if (wdmhre <= wentree1.Value.TimeOfDay &&
                                wentree1.Value.TimeOfDay >= zhentmdeb &&
                                wdmhre <= zhentmdeb)
                            {
                                wsortie1 = new DateTime(wdte.Value.Year, wdte.Value.Month, wdte.Value.Day,
                                    wdmhre.Hours, wdmhre.Minutes, wdmhre.Seconds);

                                TimeSpan wecart;
                                if (wsortie1 > wentree1)
                                {
                                    wecart = wsortie1.Value - wentree1.Value;
                                }
                                else
                                {
                                    wecart = (new TimeSpan(23, 59, 0) - wentree1.Value.TimeOfDay) +
                                            (wsortie1.Value.TimeOfDay - new TimeSpan(0, 0, 0));
                                }

                                // Handle meal time calculations
                                if (wnbhjour != null)
                                {
                                    var zrepas = TimeSpan.Zero;
                                    string wcoefrep = "+";
                                    if (wrepas != 0)
                                    {
                                        if (wrepas < 0) wcoefrep = "-";
                                        var absRepas = Math.Abs((decimal)wrepas);
                                        var whh = (int)(absRepas / 60);
                                        var wmn = absRepas - whh * 60;
                                        zrepas = new TimeSpan(whh, (int)wmn, 0);
                                    }

                                    var znbhjour = wcoefrep == "-"
                                        ? wnbhjour.Value - zrepas + new TimeSpan(1, 30, 0)
                                        : wnbhjour.Value + zrepas + new TimeSpan(1, 30, 0);

                                    if (!(wecart <= znbhjour))
                                    {
                                        if (wecart > TimeSpan.Parse(zparmaxhjour))
                                        {
                                            wsortie1 = null;
                                        }
                                    }
                                }
                                else
                                {
                                    if (wecart > TimeSpan.Parse(zparmaxhjour))
                                    {
                                        wsortie1 = null;
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }

        private void VoirCodposte()
        {
            if (!string.IsNullOrEmpty(wcodposte)) return;

            DateTime wdte = wdm_dat.Value;
            int ljj = (int)wdte.DayOfWeek - 1;
            if (ljj == 0) ljj = 7;
            string zdate = jour[ljj];

            for (int xx = 1; xx <= 12; xx++)
            {
                string w_codposte = catposte[xx];
                if (!string.IsNullOrEmpty(w_codposte))
                {
                    wcodposte = w_codposte;
                    whentm = null;
                    whenta = null;
                    whsortm = null;
                    whsorta = null;
                    whdrepas = null;
                    whfrepas = null;
                    whentmdeb = null;
                    whentadeb = null;
                    whentmfin = null;
                    whentafin = null;

                    TraitePoste(wcodposte, ljj);

                    if (whentm != null && whsortm != null)
                    {
                        if (TimeSpan.TryParse(whentm, out var parsedEntm))
                        {
                            whentmdeb = parsedEntm.Add(new TimeSpan(1, 0, 0));
                            whentmfin = parsedEntm.Add(new TimeSpan(1, 0, 0));
                        }
                        else
                        {
                            whentmdeb = null;
                            whentmfin = null;
                        }
                        if (whentmfin.Value.Hours == 0 && whentmfin.Value.Minutes == 0)
                        {
                            whentmfin = new TimeSpan(23, 59, 0);
                        }

                        int wok_plage = 0;
                        if (whentmdeb >= whentmfin)
                        {
                            if (wentree1.HasValue && whentmdeb.HasValue && wentree1.Value.TimeOfDay >= whentmdeb.Value)
                            {
                                wok_plage = -1;
                            }
                            else if (wentree1.HasValue && whentmfin.HasValue && wentree1.Value.TimeOfDay <= whentmfin.Value)
                            {
                                wok_plage = -2;
                            }
                        }
                        else if (
                            wentree1.HasValue && whentmdeb.HasValue && whentmfin.HasValue &&
                            wentree1.Value.TimeOfDay >= whentmdeb.Value &&
                            wentree1.Value.TimeOfDay <= whentmfin.Value
                        )
                        {
                            wok_plage = 1;
                        }

                        if (wok_plage != 0)
                        {
                            zcatcod = catsem[xx];
                            zcodposte = catposte[xx];
                        }
                    }
                }
            }

            wcodposte = zcodposte;
            TraitePoste(wcodposte, ljj);
        }

        private void TraitePoste(string codposte, int dayOfWeek)
        {
            var poste = _context.Postes
                .FirstOrDefault(p => p.Codposte == codposte && p.Soccod == _societe);

            if (poste != null)
            {
                switch (dayOfWeek)
                {
                    case 1: // Monday
                        whentm = poste.Lunhdmat;
                        whsortm = poste.Lunhfmat;
                        whenta = poste.Lunhdam;
                        whsorta = poste.Lunhfam;
                        whdrepas = poste.Lunhdrep;
                        whfrepas = poste.Lunhfrep;
                        wrepos = poste.Lunrepos;
                        wrepas = poste.Lunrepas;
                        break;
                    case 2: // Tuesday
                        whentm = poste.Marhdmat;
                        whsortm = poste.Marhfmat;
                        whenta = poste.Marhdam;
                        whsorta = poste.Marhfam;
                        whdrepas = poste.Marhdrep;
                        whfrepas = poste.Marhfrep;
                        wrepos = poste.Marrepos;
                        wrepas = poste.Marrepas;
                        break;
                    
                    case 3: // Wednesday
                        whentm = poste.Merhdmat;
                        whsortm = poste.Merhfmat;
                        whenta = poste.Merhdam;
                        whsorta = poste.Merhfam;
                        whdrepas = poste.Merhdrep;
                        whfrepas = poste.Merhfrep;
                        wrepos = poste.Merrepos;
                        wrepas = poste.Merrepas;
                        break;
                    
                    case 4: // Thursday
                        whentm = poste.Jeuhdmat;
                        whsortm = poste.Jeuhfmat;
                        whenta = poste.Jeuhdam;
                        whsorta = poste.Jeuhfam;
                        whdrepas = poste.Jeuhdrep;
                        whfrepas = poste.Jeuhfrep;
                        wrepos = poste.Jeurepos;
                        wrepas = poste.Jeurepas;
                        break;
                    
                    case 5: // Friday
                        whentm = poste.Venhdmat;
                        whsortm = poste.Venhfmat;
                        whenta = poste.Venhdam;
                        whsorta = poste.Venhfam;
                        whdrepas = poste.Venhdrep;
                        whfrepas = poste.Venhfrep;
                        wrepos = poste.Venrepos;
                        wrepas = poste.Venrepas;
                        break;
                    
                    case 6: // Saturday
                        whentm = poste.Samhdmat;
                        whsortm = poste.Samhfmat;
                        whenta = poste.Samhdam;
                        whsorta = poste.Samhfam;
                        whdrepas = poste.Samhdrep;
                        whfrepas = poste.Samhfrep;
                        wrepos = poste.Samrepos;
                        wrepas = poste.Samrepas;
                        break;
                    case 7: // Sunday
                        whentm = poste.Dimhdmat;
                        whsortm = poste.Dimhfmat;
                        whenta = poste.Dimhdam;
                        whsorta = poste.Dimhfam;
                        whdrepas = poste.Dimhdrep;
                        whfrepas = poste.Dimhfrep;
                        wrepos = poste.Dimrepos;
                        wrepas = poste.Dimrepas;
                        break;
                    
                    default:
                        break;
                }
            }
        }

        private void ProcessSpecialPeriod(Presence presence)
        {
            // Implementation for special period processing
        }

        private bool ShowConfirmation(string message)
        {
            // This would be implemented in the UI layer
            return true; // Simplified for example
        }

        private DateTime? ParseNullableDateTime(string value)
        {
            if (DateTime.TryParse(value, out var result))
                return result;
            return null;
        }

        public async Task TransPointage()
        {
            try
            {
                // Always fetch from Dmpoints (or Dmpresences if needed)
                var query = _context.Dmpoints
                    .OrderBy(p => p.Empcod)
                    .ThenBy(p => p.Dmdat)
                    .ThenBy(p => p.Dmhre);

                var pointages = await query.ToListAsync();

                foreach (var pnt in pointages)
                {
                    // Mark as read
                    pnt.Dmlue = "1";

                    string empId = pnt.Empcod;
                    DateTime? dmDate = pnt.Dmdat;
                    string dmTime = pnt.Dmhre?.ToString("HH:mm:ss");

                    // Get employee category
                    string wcatCod = await _context.Employes
                        .Where(e => e.Empcod == empId && e.Soccod == pnt.Soccod)
                        .Select(e => e.Catcod)
                        .FirstOrDefaultAsync() ?? "";

                    // Override with plan category if exists
                    var plan = await _context.Planhoraires
                        .FirstOrDefaultAsync(ph => ph.Empcod == empId &&
                                                   ph.Soccod == pnt.Soccod &&
                                                   ph.Plandate == dmDate);

                    if (plan != null && !string.IsNullOrEmpty(plan.Plancat))
                        wcatCod = plan.Plancat;

                    // If needed: process with your domain logic
                    //AppelDm(empId, dmDate, dmTime);
                }

                await _context.SaveChangesAsync();

            }
            catch (Exception ex)
            {

            }
        }

    }
}