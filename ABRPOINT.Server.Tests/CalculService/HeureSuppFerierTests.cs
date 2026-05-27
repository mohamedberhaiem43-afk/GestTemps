using ABRPOINT.Server.CalculService.HeureSupp;
using ABRPOINT.Server.Models;
using FluentAssertions;
using Xunit;

namespace ABRPOINT.Server.Tests.CalculService;

/// <summary>
/// Tests dédiés au calcul hebdomadaire des heures supplémentaires en présence
/// d'heures travaillées sur jours fériés.
///
/// Régression terrain (2026-05-27) : un employé H ayant travaillé 14h sur Lundi
/// de Pentecôte (08:00→22:00) voyait :
///   • EtatPeriodique (vue jour) : H.Supp = 07:00 ✅
///   • Pointage du Mois (vue semaine) : H.Supp = 05:50 ❌
/// Cause : double soustraction de NbhFerierTrv dans la formule hebdo
/// (HeuresSupplementaireHebdomadaireService.cs:283-297 avant fix). Asymétrie
/// de condition (`=="1"` vs `!="0"`) amplifiait le bug sur la valeur "2".
///
/// Cette suite verrouille la formule pure <c>ComputeWeeklyNormalAndOvertime</c>
/// qui est désormais la source de vérité du calcul hebdo.
/// </summary>
public class HeureSuppFerierTests
{
    private const float Seuil35h = 35f;

    // ─── Régression bug double-déduction ───────────────────────────────────

    [Fact]
    public void Compute_HourlyEmployeeWorked14hOnFerier_EliminerFerier1_NoDoubleDeduction()
    {
        // Scénario terrain : 14h travaillées le férié (toute la semaine = juste ce jour).
        //   tothre = 14, heureRepos = 0, hreFerier = 8 (heures théoriques férié),
        //   nbhFerierTrv = 14 (heures effectivement travaillées sur férié).
        //
        // Calcul attendu :
        //   HeuresNormales = 14 - (0 + 8) = 6   (déduction HreFerier)
        //   - eliminerFerier="1" → 6 - 14 = -8  (déduction NbhFerierTrv, UNE seule fois)
        //   -8 > 35 ? Non → heuresSupp = 0
        //
        // Avec l'ancien bug (double déduction), on obtenait heuresSupp = max(0, 0 - 14) = 0
        // ici aussi mais sur des semaines plus chargées (ex: 50h + 8h férié travaillé),
        // la double déduction faisait perdre 14h de supp injustement. Voir test suivant.
        var (normales, supp) = HeuresSupplementairesHebdomadairesService.ComputeWeeklyNormalAndOvertime(
            tothre: 14f, heureRepos: 0f, hreFerier: 8f,
            nbhFerierTrv: 14f, nbhCalendSem: Seuil35h,
            eliminerFerier: "1", empreg: "H");

        normales.Should().BeApproximately(-8f, 0.01f);
        supp.Should().Be(0f, "rien à compter au-delà de 35h cette semaine");
    }

    [Fact]
    public void Compute_HeavyWeekWithFerierWork_OldDoubleDeductionWouldUnderCount()
    {
        // Cas où la régression était visible : semaine de 50h dont 14h sur férié.
        //   tothre = 50, heureRepos = 0, hreFerier = 8, nbhFerierTrv = 14, seuil 35.
        //
        // Attendu (1 seule déduction) :
        //   HeuresNormales = 50 - 8 = 42
        //   - eliminerFerier=1 → 42 - 14 = 28
        //   28 > 35 ? Non → supp = 0
        //
        // Ancien bug (double déduction) : déduction supplémentaire après seuil →
        // toujours 0 ici. Mais sur 60h+ on perdait des supp réelles. Voir test 60h.
        var (normales, supp) = HeuresSupplementairesHebdomadairesService.ComputeWeeklyNormalAndOvertime(
            tothre: 50f, heureRepos: 0f, hreFerier: 8f,
            nbhFerierTrv: 14f, nbhCalendSem: Seuil35h,
            eliminerFerier: "1", empreg: "H");

        normales.Should().BeApproximately(28f, 0.01f);
        supp.Should().Be(0f);
    }

    [Fact]
    public void Compute_HeavyWeekAboveThreshold_FerierWork_SingleDeductionCounts()
    {
        // 60h travaillées, 8h férié théoriques, 14h férié travaillé, seuil 35h.
        //   HeuresNormales = 60 - 8 = 52
        //   - eliminerFerier=1 → 52 - 14 = 38
        //   38 > 35 ? Oui → supp = 38 - 35 = 3
        //
        // Avec ancien bug : 3 - 14 = -11 → max(0, ...) = 0. Perte de 3h injuste.
        var (_, supp) = HeuresSupplementairesHebdomadairesService.ComputeWeeklyNormalAndOvertime(
            tothre: 60f, heureRepos: 0f, hreFerier: 8f,
            nbhFerierTrv: 14f, nbhCalendSem: Seuil35h,
            eliminerFerier: "1", empreg: "H");

        supp.Should().BeApproximately(3f, 0.01f,
            "ancien bug retournait 0 — perte de 3h de supp pourtant légitimes");
    }

    // ─── EliminerFerier="0" (pas d'élimination) ────────────────────────────

    [Fact]
    public void Compute_EliminerFerier0_NoFerierDeduction()
    {
        // Heures férié restent dans le compte normal.
        //   tothre = 50, hreFerier = 8, nbhFerierTrv = 14, seuil 35.
        //   HeuresNormales = 50 - 8 = 42  (pas de soustraction NbhFerierTrv)
        //   42 > 35 ? Oui → supp = 7
        var (_, supp) = HeuresSupplementairesHebdomadairesService.ComputeWeeklyNormalAndOvertime(
            tothre: 50f, heureRepos: 0f, hreFerier: 8f,
            nbhFerierTrv: 14f, nbhCalendSem: Seuil35h,
            eliminerFerier: "0", empreg: "H");

        supp.Should().BeApproximately(7f, 0.01f);
    }

    // ─── EliminerFerier="2" (alias rétro-compat) ───────────────────────────

    [Fact]
    public void Compute_EliminerFerier2_BehavesLikeEliminerFerier1()
    {
        // Avant le fix, "2" déclenchait uniquement la DEUXIÈME soustraction
        // (asymétrie `!="0"` vs `=="1"`), donnant un résultat différent de "1".
        // Après unification : "1" et "2" ont le même effet.
        var r1 = HeuresSupplementairesHebdomadairesService.ComputeWeeklyNormalAndOvertime(
            60f, 0f, 8f, 14f, Seuil35h, "1", "H");
        var r2 = HeuresSupplementairesHebdomadairesService.ComputeWeeklyNormalAndOvertime(
            60f, 0f, 8f, 14f, Seuil35h, "2", "H");

        r1.Should().Be(r2);
    }

    // ─── Garde-fou régime mensuel ──────────────────────────────────────────

    [Fact]
    public void Compute_MensuelEmployee_EliminerFerierIgnored()
    {
        // La règle "Éliminer férié" ne s'applique qu'au régime horaire (H).
        // Pour un mensuel (M), les heures férié restent comptabilisées comme normales.
        var (normales, supp) = HeuresSupplementairesHebdomadairesService.ComputeWeeklyNormalAndOvertime(
            tothre: 50f, heureRepos: 0f, hreFerier: 8f,
            nbhFerierTrv: 14f, nbhCalendSem: Seuil35h,
            eliminerFerier: "1", empreg: "M");

        // M : aucune déduction NbhFerierTrv → HeuresNormales = 50 - 8 = 42 → supp = 7
        normales.Should().BeApproximately(42f, 0.01f);
        supp.Should().BeApproximately(7f, 0.01f);
    }

    // ─── Garde-fous robustesse ─────────────────────────────────────────────

    [Fact]
    public void Compute_AllZero_ReturnsZeros()
    {
        var (n, s) = HeuresSupplementairesHebdomadairesService.ComputeWeeklyNormalAndOvertime(
            0f, 0f, 0f, 0f, Seuil35h, "0", "H");

        n.Should().Be(0f);
        s.Should().Be(0f);
    }

    [Fact]
    public void Compute_NbhFerierTrvNull_DoesNotThrow()
    {
        // Si nbhFerierTrv n'est pas calculé (legacy), on traite comme 0.
        var (_, s) = HeuresSupplementairesHebdomadairesService.ComputeWeeklyNormalAndOvertime(
            tothre: 40f, heureRepos: 0f, hreFerier: 0f,
            nbhFerierTrv: null, nbhCalendSem: Seuil35h,
            eliminerFerier: "1", empreg: "H");

        s.Should().BeApproximately(5f, 0.01f, "40 - 35 = 5 sans deduction férié");
    }

    [Fact]
    public void Compute_NegativeNormales_OvertimeClampedToZero()
    {
        // Cas où HeuresNormales devient négatif (beaucoup d'heures repos/férié vs peu travaillé).
        // supp doit rester ≥ 0 sans propager du négatif côté UI.
        var (_, s) = HeuresSupplementairesHebdomadairesService.ComputeWeeklyNormalAndOvertime(
            tothre: 5f, heureRepos: 10f, hreFerier: 0f,
            nbhFerierTrv: 0f, nbhCalendSem: Seuil35h,
            eliminerFerier: "0", empreg: "H");

        s.Should().Be(0f);
        s.Should().BeGreaterThanOrEqualTo(0f);
    }

    [Theory]
    [InlineData(35f, 35f, 0f)] // pile au seuil
    [InlineData(36f, 35f, 1f)] // +1h
    [InlineData(48f, 35f, 13f)] // grosse semaine sans férié
    public void Compute_NoFerier_RegularOvertimeAboveThreshold(float tothre, float seuil, float expectedSupp)
    {
        var (_, s) = HeuresSupplementairesHebdomadairesService.ComputeWeeklyNormalAndOvertime(
            tothre: tothre, heureRepos: 0f, hreFerier: 0f,
            nbhFerierTrv: 0f, nbhCalendSem: seuil,
            eliminerFerier: "0", empreg: "H");

        s.Should().BeApproximately(expectedSupp, 0.01f);
    }

    // ─── ApplyFerierWorkedCap : régression H.Fér.Trv = 0 ───────────────────

    [Fact]
    public void ApplyFerierWorkedCap_MaxFerierNull_NoCapAllHoursCounted()
    {
        // Régression terrain (2026-05-27) : si Parmaxfer n'est pas saisi dans ParamSoc,
        // l'ancien code `Math.Min(worked, MaxFerier ?? 0)` clampait à 0 → H.Fér.Trv = 0
        // sur toutes les lignes, alors que l'employé avait effectivement travaillé 14h
        // sur Lundi de Pentecôte. Le nouveau défaut : null = ILLIMITÉ.
        var (cap, surplus) = HeuresSupplementairesHebdomadairesService.ApplyFerierWorkedCap(
            nbhFerierTrv: 14f, maxFerier: null);

        cap.Should().Be(14f, "null = aucun plafond → toutes les heures travaillées comptent");
        surplus.Should().Be(0f);
    }

    [Fact]
    public void ApplyFerierWorkedCap_MaxFerierExplicitZero_CapsAllToSurplus()
    {
        // Sémantique préservée pour les tenants ayant volontairement saisi 0 : aucune
        // heure férié payée en HreFerieTrv, tout bascule en HreFerieTrv2 (taux différent).
        var (cap, surplus) = HeuresSupplementairesHebdomadairesService.ApplyFerierWorkedCap(
            nbhFerierTrv: 14f, maxFerier: 0f);

        cap.Should().Be(0f);
        surplus.Should().Be(14f);
    }

    [Fact]
    public void ApplyFerierWorkedCap_MaxFerier8_SplitsAtThreshold()
    {
        // 14h travaillées, cap = 8h → 8h en HreFerieTrv, 6h en HreFerieTrv2.
        var (cap, surplus) = HeuresSupplementairesHebdomadairesService.ApplyFerierWorkedCap(
            nbhFerierTrv: 14f, maxFerier: 8f);

        cap.Should().Be(8f);
        surplus.Should().Be(6f);
    }

    [Fact]
    public void ApplyFerierWorkedCap_WorkedBelowCap_NoSurplus()
    {
        var (cap, surplus) = HeuresSupplementairesHebdomadairesService.ApplyFerierWorkedCap(
            nbhFerierTrv: 5f, maxFerier: 8f);

        cap.Should().Be(5f);
        surplus.Should().Be(0f);
    }

    [Fact]
    public void ApplyFerierWorkedCap_WorkedNull_ReturnsZeros()
    {
        var (cap, surplus) = HeuresSupplementairesHebdomadairesService.ApplyFerierWorkedCap(
            nbhFerierTrv: null, maxFerier: 8f);

        cap.Should().Be(0f);
        surplus.Should().Be(0f);
    }

    [Theory]
    [InlineData(0f, null, 0f, 0f)]      // rien travaillé, pas de cap → 0/0
    [InlineData(20f, null, 20f, 0f)]    // 20h travaillées, pas de cap → 20/0
    [InlineData(20f, 100f, 20f, 0f)]    // cap très large → tout en HreFerieTrv
    [InlineData(100f, 8f, 8f, 92f)]     // cap petit, gros surplus
    public void ApplyFerierWorkedCap_VariousScenarios(float worked, float? cap, float expectedCap, float expectedSurplus)
    {
        var (c, s) = HeuresSupplementairesHebdomadairesService.ApplyFerierWorkedCap(worked, cap);
        c.Should().BeApproximately(expectedCap, 0.01f);
        s.Should().BeApproximately(expectedSurplus, 0.01f);
    }

    // ─── ComputeWorkedHoursFromPunches : régression J.Fér.Trv=0 + H.Fér.Trv=0 ──

    [Fact]
    public void ComputeWorkedHoursFromPunches_ContinuousMorningOnly_ReturnsFullDuration()
    {
        // Cas terrain : pointage continu 08:00→22:00 en slot matin uniquement
        // (pas de slot aprem). Doit retourner 14h.
        var p = new Presence
        {
            Preentmatup = "08:00", Presortmatup = "22:00",
        };

        var hours = OptimizedPresenceService.ComputeWorkedHoursFromPunches(p);

        hours.Should().BeApproximately(14f, 0.01f);
    }

    [Fact]
    public void ComputeWorkedHoursFromPunches_AllThreeSlots_SumsCorrectly()
    {
        // 4h matin + 3h aprem + 5h supp = 12h. La régression était l'absence du slot
        // supp dans la version d'avant 2026-05-27 → cette plage était ignorée.
        var p = new Presence
        {
            Preentmatup = "08:00", Presortmatup = "12:00",
            Preentamidiup = "14:00", Presortamidiup = "17:00",
            Preentasupup = "18:00", Presortsupup = "23:00",
        };

        var hours = OptimizedPresenceService.ComputeWorkedHoursFromPunches(p);

        hours.Should().BeApproximately(12f, 0.01f, "matin 4h + aprem 3h + supp 5h");
    }

    [Fact]
    public void ComputeWorkedHoursFromPunches_OnlySuppSlot_NotMissed()
    {
        // CŒUR DU BUG terrain : si toutes les heures férié travaillées sont stockées
        // EXCLUSIVEMENT dans le slot supp (ce qui arrive sur les pointages atypiques
        // ou les jours fériés gérés en heures supplémentaires), l'ancienne implémentation
        // retournait 0 → garde `workedHours > 0` skip → J.Fér.Trv reste à 0 et l'employé
        // n'a aucune trace de son travail férié sur le Pointage du Mois.
        var p = new Presence
        {
            Preentasupup = "08:00", Presortsupup = "22:00",
        };

        var hours = OptimizedPresenceService.ComputeWorkedHoursFromPunches(p);

        hours.Should().BeApproximately(14f, 0.01f,
            "le slot supp doit être lu — sinon J.Fér.Trv et H.Fér.Trv restent à 0");
    }

    [Fact]
    public void ComputeWorkedHoursFromPunches_OvernightShift_HandlesMidnightCrossing()
    {
        // Pointage 22:00 → 02:00 (post-fix midnight-safe, comme CalcNbHeure).
        // Avant fix : (02:00 - 22:00).TotalHours = -20h → Math.Max(0, ...) = 0 → bug.
        var p = new Presence
        {
            Preentmatup = "22:00", Presortmatup = "02:00",
        };

        var hours = OptimizedPresenceService.ComputeWorkedHoursFromPunches(p);

        hours.Should().BeApproximately(4f, 0.01f, "22h→02h = 4h franchissement minuit");
    }

    [Fact]
    public void ComputeWorkedHoursFromPunches_EmptyPresence_ReturnsZero()
    {
        var p = new Presence();
        OptimizedPresenceService.ComputeWorkedHoursFromPunches(p).Should().Be(0f);
    }

    [Fact]
    public void ComputeWorkedHoursFromPunches_OnlyEntryNoExit_ReturnsZero()
    {
        // Oubli de pointer la sortie → slot incomplet → ne contribue pas.
        var p = new Presence
        {
            Preentmatup = "08:00", Presortmatup = null,
        };
        OptimizedPresenceService.ComputeWorkedHoursFromPunches(p).Should().Be(0f);
    }
}
