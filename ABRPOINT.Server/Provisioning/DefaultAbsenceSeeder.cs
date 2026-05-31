using ABRPOINT.Server.Data;
using ABRPOINT.Server.Models;
using Microsoft.EntityFrameworkCore;

namespace ABRPOINT.Server.Provisioning;

/// <summary>
/// Seed des natures d'absence par défaut (CP, FM, AUT, RTT, CET) pour une société, afin que
/// l'utilisateur dispose immédiatement des imputations essentielles à la création du compte.
/// Les codes <c>Abscng</c> pilotent la catégorisation : "0"=congé payé, "6"=formation et mission,
/// "B"=autorisation de sortie, "R"=RTT, "E"=Compte Épargne Temps (CET). CP et RTT sont marqués
/// "peut alimenter le CET" (<c>Abspeutcet</c>) ; le type CET porte <c>Absprendcet</c>.
///
/// Idempotent : ne touche pas une société qui possède DÉJÀ au moins une nature d'absence
/// (évite d'écraser une grille personnalisée). N'appelle PAS SaveChanges — c'est au caller de
/// committer. Utilisé au provisioning (nouveau tenant, cf. <see cref="ProvisioningService"/>) ET
/// en rattrapage pour les tenants existants via <c>POST /api/Roles/seed-system</c>.
/// </summary>
public static class DefaultAbsenceSeeder
{
    /// <summary>Ajoute les natures par défaut si la société n'en a aucune. Retourne le nombre créé.</summary>
    public static async Task<int> SeedAsync(ApplicationDbContext db, string soccod, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(soccod)) return 0;
        if (await db.Absences.AnyAsync(a => a.Soccod == soccod, ct)) return 0;

        db.Absences.AddRange(
            new Absence { Soccod = soccod, Abscod = "CP",  Abslib = "Congé payé",            Abscng = "0", Abspayer = "O", Absunite = "J", Abspeutcet = "1" },
            new Absence { Soccod = soccod, Abscod = "FM",  Abslib = "Formation et mission",   Abscng = "6", Abspayer = "O", Absunite = "J" },
            new Absence { Soccod = soccod, Abscod = "AUT", Abslib = "Autorisation de sortie", Abscng = "B", Abspayer = "O", Absunite = "H" },
            new Absence { Soccod = soccod, Abscod = "RTT", Abslib = "RTT",                    Abscng = "R", Abspayer = "O", Absunite = "J", Abspeutcet = "1" },
            new Absence { Soccod = soccod, Abscod = "CET", Abslib = "Congé CET",              Abscng = "E", Abspayer = "O", Absunite = "J", Absprendcet = "1" }
        );
        return 5;
    }
}
