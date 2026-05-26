using System.Reflection;
using ABRPOINT.Server.Repository;
using FluentAssertions;
using Xunit;

namespace ABRPOINT.Server.Tests.Repository;

/// <summary>
/// Tests ciblés sur l'invariant critique de l'État Périodique : <c>CalcNbHeure</c>
/// (PresenceRepository.cs:1553) — la fonction qui agrège les durées de présence
/// matin / après-midi / heures supp pour produire le "Total Travaillé".
///
/// Régression observée en prod 2026-05 (cf. commentaire ligne 1563-1569) : un
/// pointage de nuit type 22:00→06:00 ou 23:00→01:00 produisait une durée
/// NÉGATIVE qui, en se sommant aux autres plages, faisait passer le total sous
/// zéro → clampé à 0 → affichage "Total Travaillé 00:02" pour un employé ayant
/// réellement travaillé 15h. Cascade : H.Absences = jour entier marqué absent,
/// H.Suppl. non comptées.
///
/// La méthode étant privée (interne au repo, pas une surface publique), on l'invoque
/// par réflexion. C'est volontaire : le test verrouille la règle métier au plus près
/// du code, sans setup DbContext+Calendar+Site (qui multiplierait le coût pour
/// vérifier la même mécanique de TimeSpan).
/// </summary>
public class PresenceRepositoryEtatPeriodiqueTests
{
    private static readonly MethodInfo CalcNbHeureMethod = typeof(PresenceRepository)
        .GetMethod("CalcNbHeure", BindingFlags.NonPublic | BindingFlags.Instance)!;

    /// <summary>
    /// Wrapper réflexion : appelle CalcNbHeure sans avoir à instancier le repo lourd
    /// (qui nécessite IJourFerieRepository, IParametreRepository, etc.). On utilise
    /// FormatterServices pour bypass le constructeur — la méthode testée n'utilise
    /// AUCUN champ d'instance (cf. body ligne 1553+ : 100% pure de TimeSpan arithmétique
    /// + Console.WriteLine), donc l'objet "non-initialisé" est suffisant.
    /// </summary>
    private static double Invoke(string? ent1, string? sort1, string? ent2 = null, string? sort2 = null,
        string? ent3 = null, string? sort3 = null, float? repas = null)
    {
        var instance = (PresenceRepository)System.Runtime.Serialization.FormatterServices
            .GetUninitializedObject(typeof(PresenceRepository));
        return (double)CalcNbHeureMethod.Invoke(instance, new object?[] { ent1, sort1, ent2, sort2, ent3, sort3, repas })!;
    }

    // ─── Régression principale : midnight crossing ─────────────────────────

    [Fact]
    public void CalcNbHeure_NightShift_22To06_Returns8Hours()
    {
        // Cas terrain qui a déclenché le fix : 22:00 → 06:00 produisait -16h
        // avant ; doit maintenant donner +8h.
        var hours = Invoke("22:00", "06:00");
        hours.Should().BeApproximately(8.0, 0.001, "poste de nuit 22h→06h = 8h");
    }

    [Fact]
    public void CalcNbHeure_LateNightShort_23To01_Returns2Hours()
    {
        var hours = Invoke("23:00", "01:00");
        hours.Should().BeApproximately(2.0, 0.001);
    }

    [Fact]
    public void CalcNbHeure_SplitShiftCrossingMidnight_DoesNotGoNegative()
    {
        // Cas le plus retors : matin normal (08:30→12:00 = 3.5h) puis sortie
        // tardive franchissant minuit (22:00→01:00 = 3h). Total = 6.5h, jamais < 0.
        var hours = Invoke("08:30", "12:00", "22:00", "01:00");
        hours.Should().BeApproximately(6.5, 0.001);
        hours.Should().BeGreaterThan(0, "ne doit JAMAIS être négatif (clamp 0 résiduel cacherait la régression)");
    }

    [Fact]
    public void CalcNbHeure_MorningAndEvening_ContinuousAcrossLunch_DeprecatedDoesNotDeduct()
    {
        // Comportement actualisé 2026-05 (cf. commentaire ligne 1586-1596) : on ne
        // déduit PLUS la pause-déjeuner du total État Périodique. 08:00→17:00 = 9h.
        // L'ancien comportement (qui retranchait 1h de pause) faisait passer le total
        // à 8h et créait des incohérences vs feuille de présence.
        var hours = Invoke("08:00", "17:00", repas: 60f);
        hours.Should().BeApproximately(9.0, 0.001, "pause repas ignorée en État Périodique");
    }

    [Fact]
    public void CalcNbHeure_FourPunches_WithLunchGap_OnlySumsActualWork()
    {
        // 4 pointages 08:00-12:00 + 13:00-17:00. La pause 12:00-13:00 est NATURELLEMENT
        // exclue (pas d'addition entre les plages). Total = 4 + 4 = 8h.
        var hours = Invoke("08:00", "12:00", "13:00", "17:00");
        hours.Should().BeApproximately(8.0, 0.001);
    }

    [Fact]
    public void CalcNbHeure_WithSupplementaryPunch_AddsThirdSlot()
    {
        // 08:00-12:00 + 13:00-17:00 + 18:00-20:00 (supp). Total = 4 + 4 + 2 = 10h.
        var hours = Invoke("08:00", "12:00", "13:00", "17:00", "18:00", "20:00");
        hours.Should().BeApproximately(10.0, 0.001);
    }

    // ─── Garde-fous parsing ────────────────────────────────────────────────

    [Fact]
    public void CalcNbHeure_AllNull_Returns0()
    {
        var hours = Invoke(null, null);
        hours.Should().Be(0.0);
    }

    [Fact]
    public void CalcNbHeure_PartialPunch_Ent1OnlyNoSort1_Returns0()
    {
        // Si seulement l'entrée matin est saisie (pas la sortie), la durée matin = 0.
        // Pas de plantage, pas de NaN. C'est un cas terrain fréquent (oubli sortie).
        var hours = Invoke("08:00", null);
        hours.Should().Be(0.0);
    }

    [Fact]
    public void CalcNbHeure_OnlyEveningSupp_ReturnsThirdSlotOnly()
    {
        var hours = Invoke(null, null, null, null, "18:00", "21:00");
        hours.Should().BeApproximately(3.0, 0.001);
    }

    // ─── Vérification du sens "Diff" non régressif ─────────────────────────

    [Fact]
    public void CalcNbHeure_SameTimeStartAndEnd_Returns0()
    {
        // Pointage entrée == sortie (saisie erronée) → 0, pas une exception.
        var hours = Invoke("12:00", "12:00");
        hours.Should().Be(0.0);
    }

    [Theory]
    [InlineData("08:00", "12:00", 4.0)]
    [InlineData("09:30", "17:15", 7.75)]
    [InlineData("00:00", "08:00", 8.0)]
    [InlineData("16:00", "00:00", 8.0)] // 00:00 = minuit du lendemain
    public void CalcNbHeure_SinglePeriod_ProducesExpectedHours(string ent, string sort, double expected)
    {
        var hours = Invoke(ent, sort);
        hours.Should().BeApproximately(expected, 0.01, $"plage {ent}→{sort}");
    }
}
