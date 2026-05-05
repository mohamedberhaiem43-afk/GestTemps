using ABRPOINT.Server.Data;
using ABRPOINT.Server.Interfaces;
using ABRPOINT.Server.Models;
using Microsoft.EntityFrameworkCore;

namespace ABRPOINT.Server.CalculService.Rtt;

/// <summary>
/// Calcul du solde RTT (Réduction du Temps de Travail) selon la loi française.
///
/// Trois méthodes au choix par employé (champ <see cref="Employe.EmpRttMethode"/>) :
/// <list type="bullet">
/// <item><c>'N'</c> : non éligible — droit = 0.</item>
/// <item><c>'M'</c> : saisie manuelle — droit = <see cref="Employe.EmpRttJoursAnnuel"/>.</item>
/// <item><c>'H'</c> : calcul horaire — droit = (heuresContrat - 35) × ~52 sem ÷ 7h/jour.</item>
/// <item><c>'F'</c> : forfait jours — droit = joursOuvrésAnnuels - <see cref="Employe.EmpRttForfaitJours"/>.</item>
/// </list>
///
/// Le solde est stocké dans <see cref="Solde.RttJours"/> (droit) et <see cref="Solde.RttUtilises"/> (consommé).
/// La règle "perte au 31 décembre" est appliquée via <see cref="ResetEndOfYearAsync"/>.
/// </summary>
public class RttCalculationService : IRttCalculationService
{
    private readonly ApplicationDbContext _db;
    private readonly IJourFerieRepository _ferierRepo;

    // Constantes loi française.
    private const float HEURES_LEGALES_HEBDO = 35f;
    private const float HEURES_PAR_JOUR_RTT = 7f;
    private const int JOURS_CP_LEGAUX = 25;          // 5 semaines de congés payés
    private const int FORFAIT_JOURS_DEFAUT = 218;
    private const float SEMAINES_TRAVAILLEES_PAR_AN = 47f; // 52 - 5 sem CP (approx.)

    public RttCalculationService(ApplicationDbContext db, IJourFerieRepository ferierRepo)
    {
        _db = db;
        _ferierRepo = ferierRepo;
    }

    public async Task<RttSoldeDto> GetRttSoldeAsync(string soccod, string empcod)
    {
        var year = DateTime.Now.Year;
        var employe = await _db.Employes
            .FirstOrDefaultAsync(e => e.Soccod == soccod && e.Empcod == empcod);

        if (employe == null)
            return new RttSoldeDto { Methode = "N", Annee = year.ToString() };

        var methode = string.IsNullOrEmpty(employe.EmpRttMethode) ? "N" : employe.EmpRttMethode!;

        // Si l'employé n'est pas éligible, on renvoie un solde vide.
        if (methode == "N")
        {
            return new RttSoldeDto { Methode = "N", Annee = year.ToString() };
        }

        var solde = await _db.Soldes
            .FirstOrDefaultAsync(s => s.Soccod == soccod && s.Empcod == empcod);

        // Auto-recalcul si :
        //  - la ligne solde n'existe pas,
        //  - rtt_jours est null (jamais calculé),
        //  - ou l'année a changé (clôture implicite).
        // Évite à l'admin de cliquer "Recalculer" manuellement à chaque ajout/modif d'employé.
        bool needsRecompute =
            solde == null
            || solde.RttJours == null
            || (!string.IsNullOrEmpty(solde.Annee) && solde.Annee != year.ToString());

        if (needsRecompute)
        {
            return await RecalculateRttForEmployeeAsync(soccod, empcod, year);
        }

        return new RttSoldeDto
        {
            Methode = methode,
            DroitAnnuel = solde!.RttJours ?? 0f,
            Pris = solde.RttUtilises ?? 0f,
            Annee = solde.Annee ?? year.ToString(),
        };
    }

    public async Task<RttSoldeDto> RecalculateRttForEmployeeAsync(string soccod, string empcod, int year)
    {
        var employe = await _db.Employes
            .FirstOrDefaultAsync(e => e.Soccod == soccod && e.Empcod == empcod);

        if (employe == null)
            throw new KeyNotFoundException($"Employé {empcod} introuvable pour la société {soccod}.");

        var methode = string.IsNullOrEmpty(employe.EmpRttMethode) ? "N" : employe.EmpRttMethode!;
        float droit = await ComputeDroitAnnuelAsync(employe, methode, soccod, year);

        // Charge ou crée la ligne Solde de l'employé. Le schéma actuel ne stocke
        // qu'une ligne par employé (PK = Empcod+Soccod) ; on met à jour son
        // champ `Annee` pour refléter l'année du calcul.
        var solde = await _db.Soldes
            .FirstOrDefaultAsync(s => s.Soccod == soccod && s.Empcod == empcod);

        if (solde == null)
        {
            solde = new Solde
            {
                Soccod = soccod,
                Empcod = empcod,
                Annee = year.ToString(),
                RttJours = droit,
                RttUtilises = 0f,
            };
            _db.Soldes.Add(solde);
        }
        else
        {
            solde.RttJours = droit;
            // Si on change d'année, on remet à 0 (perte des jours non consommés).
            if (solde.Annee != year.ToString())
            {
                solde.Annee = year.ToString();
                solde.RttUtilises = 0f;
            }
        }

        await _db.SaveChangesAsync();

        return new RttSoldeDto
        {
            Methode = methode,
            DroitAnnuel = droit,
            Pris = solde.RttUtilises ?? 0f,
            Annee = year.ToString(),
        };
    }

    public async Task IncrementUsedAsync(string soccod, string empcod, int year, float jours)
    {
        if (jours <= 0) return;

        var solde = await _db.Soldes
            .FirstOrDefaultAsync(s => s.Soccod == soccod && s.Empcod == empcod);

        if (solde == null)
        {
            // Cas limite : pas encore de ligne solde pour cet employé. On crée
            // une ligne minimale plutôt que de silencieusement perdre la conso.
            solde = new Solde
            {
                Soccod = soccod,
                Empcod = empcod,
                Annee = year.ToString(),
                RttJours = 0f,
                RttUtilises = jours,
            };
            _db.Soldes.Add(solde);
        }
        else
        {
            solde.RttUtilises = (solde.RttUtilises ?? 0f) + jours;
        }

        await _db.SaveChangesAsync();
    }

    public async Task<int> ResetEndOfYearAsync(string soccod, int targetYear)
    {
        var employes = await _db.Employes
            .Where(e => e.Soccod == soccod && e.Actif != "N")
            .ToListAsync();

        int count = 0;
        foreach (var emp in employes)
        {
            await RecalculateRttForEmployeeAsync(soccod, emp.Empcod, targetYear);
            count++;
        }

        return count;
    }

    // ────────────────────────────────────────────────────────────────────────
    // Helpers de calcul du droit annuel selon la méthode
    // ────────────────────────────────────────────────────────────────────────

    private async Task<float> ComputeDroitAnnuelAsync(Employe emp, string methode, string soccod, int year)
    {
        switch (methode)
        {
            case "M":
                return emp.EmpRttJoursAnnuel ?? 0f;

            case "H":
                return ComputeDroitHoraire(emp);

            case "F":
                return await ComputeDroitForfaitAsync(emp, soccod, year);

            case "N":
            default:
                return 0f;
        }
    }

    /// <summary>
    /// Méthode horaire : crédit annuel basé sur les heures hebdo contractuelles.
    /// (heuresContrat - 35) × 47 semaines travaillées ÷ 7h par jour de RTT.
    /// </summary>
    private static float ComputeDroitHoraire(Employe emp)
    {
        var heuresContrat = emp.EmpRttHeuresContrat ?? HEURES_LEGALES_HEBDO;
        if (heuresContrat <= HEURES_LEGALES_HEBDO) return 0f;

        var excedentHebdo = heuresContrat - HEURES_LEGALES_HEBDO;
        var excedentAnnuel = excedentHebdo * SEMAINES_TRAVAILLEES_PAR_AN;
        return (float)Math.Round(excedentAnnuel / HEURES_PAR_JOUR_RTT, 1);
    }

    /// <summary>
    /// Méthode forfait jours : RTT = joursOuvrésAnnuels - forfaitJours.
    /// joursOuvrés = 365 - 104 (weekends) - jours fériés ouvrés - 25 (CP légaux).
    /// </summary>
    private async Task<float> ComputeDroitForfaitAsync(Employe emp, string soccod, int year)
    {
        var forfait = emp.EmpRttForfaitJours ?? FORFAIT_JOURS_DEFAUT;

        // Jours fériés tombant en semaine pour l'année donnée.
        var debutAnnee = new DateTime(year, 1, 1);
        var finAnnee = new DateTime(year, 12, 31);
        var feries = await _ferierRepo.GetFeriersByPeriod(soccod, debutAnnee, finAnnee);
        int feriesOuvres = feries.Count(f => f.Ferdate.HasValue
            && f.Ferdate.Value.DayOfWeek != DayOfWeek.Saturday
            && f.Ferdate.Value.DayOfWeek != DayOfWeek.Sunday);

        int joursAnnee = DateTime.IsLeapYear(year) ? 366 : 365;
        int weekends = CountWeekendDays(year);

        int joursOuvres = joursAnnee - weekends - feriesOuvres - JOURS_CP_LEGAUX;
        var rtt = joursOuvres - forfait;

        return Math.Max(0, rtt);
    }

    private static int CountWeekendDays(int year)
    {
        int count = 0;
        var d = new DateTime(year, 1, 1);
        var end = new DateTime(year, 12, 31);
        while (d <= end)
        {
            if (d.DayOfWeek == DayOfWeek.Saturday || d.DayOfWeek == DayOfWeek.Sunday)
                count++;
            d = d.AddDays(1);
        }
        return count;
    }
}
