using ABRPOINT.Server.CalculService.Conge;
using ABRPOINT.Server.Data;
using ABRPOINT.Server.Interfaces;
using ABRPOINT.Server.Models;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Moq;
using Xunit;

// Volontairement PAS de sous-namespace `.Conge` : ça créerait un conflit avec
// ABRPOINT.Server.Models.Conge utilisé par d'autres fichiers de tests
// (CS0118: 'Conge' est un espace de noms mais est utilisé comme un type).
namespace ABRPOINT.Server.Tests.CalculService.CongeCalc;

/// <summary>
/// Tests intensifs du calcul du solde de congés (CongeCalculationService).
///
/// Règles métier couvertes (cf. CongeCalculationService.cs:70-227) :
///   • Droit annuel = Site.Sitconge ou 30 j (loi française L.3141-3 : 5 sem × 6 j).
///   • Acquisition mensuelle = annuel / 12 (2,5 j/mois par défaut).
///   • Pro-rata mois d'embauche : (jours restants du mois) / total mois.
///   • Pro-rata mois de sortie : (jours travaillés avant sortie) / total mois.
///   • Bonus ancienneté : +1 j par tranche de Parancemp années (défaut 5),
///     uniquement si ancienneté > seuil.
///   • Salarié embauché APRÈS l'année cible → 0 droit.
///   • Salarié sorti AVANT l'année cible → 0 droit.
///   • Sanctions (table Sanctions) déduites des jours ouvrés du mois.
///   • Solde initial repris depuis table `solde.Conge`.
///   • Convention Site.Sitsanc[m|h] annule l'ancienneté pour le régime concerné.
///
/// Mocks: ISiteRepository, ICalendrierRepository, IParametreRepository, ICongeRepository.
/// DbContext InMemory pour Soldes / Employes / Sanctions.
/// </summary>
public class CongeCalculationServiceTests
{
    private const string Soc = "S1";
    private const string Emp = "E001";
    private const string Sit = "01";
    private const string Caltype = "01";

    private readonly Mock<ICongeRepository> _congeRepo = new();
    private readonly Mock<ISiteRepository> _siteRepo = new();
    private readonly Mock<ICalendrierRepository> _calRepo = new();
    private readonly Mock<IParametreRepository> _paramRepo = new();

    private static ApplicationDbContext NewContext()
        => new(new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseInMemoryDatabase($"conge-calc-{Guid.NewGuid()}").Options);

    private CongeCalculationService NewService(ApplicationDbContext db)
        => new(_congeRepo.Object, _siteRepo.Object, _calRepo.Object, _paramRepo.Object, db);

    private void SetupSite(float? sitconge, string? sitsancm = "0", string? sitsanch = "0")
    {
        _siteRepo.Setup(x => x.GetBySitcodAsync(Soc, Sit))
                 .ReturnsAsync(new Site { Sitcod = Sit, Soccod = Soc, Sitconge = sitconge, Sitsancm = sitsancm, Sitsanch = sitsanch });
    }

    private void SetupStandardCalendar(float trav = 22f, float nbh = 176f, float hjour = 8f)
    {
        // 22 jours ouvrés × 8h = 176h — standard FR (lundi-vendredi).
        _calRepo.Setup(x => x.GetCalendrierAsync(Soc, It.IsAny<string>(), It.IsAny<string>(), Caltype))
                .ReturnsAsync(new Calendsoc { CalTrav = trav, CalNbh = nbh, CalHjour = hjour });
    }

    private void SetupNoCalendar()
    {
        _calRepo.Setup(x => x.GetCalendrierAsync(Soc, It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>()))
                .ReturnsAsync((Calendsoc?)null);
    }

    private void SetupParancemp(int parancemp = 5)
    {
        _paramRepo.Setup(x => x.GetParancempAsync(Soc)).ReturnsAsync(parancemp);
    }

    private void SetupNoConges()
    {
        _congeRepo.Setup(x => x.GetNbCongeRecueAsync(Soc, Emp, It.IsAny<string>(), It.IsAny<string>()))
                  .ReturnsAsync(0f);
    }

    private static Employe NewEmploye(DateTime embauche, DateTime? sortie = null, string regime = "M")
        => new()
        {
            Empcod = Emp, Soccod = Soc, Sitcod = Sit,
            Empemb = embauche, Empsort = sortie,
            Empreg = regime,
            Caltype = Caltype,
        };

    // ─── Garde-fous : employé absent / sans date d'embauche ────────────────

    [Fact]
    public async Task GetEmpEtatConge_NoEmployee_ReturnsZeros()
    {
        // Cas observé en prod : employé supprimé mais ligne solde résiduelle.
        // Le service ne doit pas planter, il retourne 0.
        await using var db = NewContext();
        SetupNoConges();
        var svc = NewService(db);

        var result = await svc.GetEmpEtatCongeAsync(Soc, Emp, "01", "12", "2026");

        result.DroitConge.Should().Be(0);
        result.SoldeAnterieur.Should().Be(0);
        result.Anciennete.Should().Be(0);
    }

    [Fact]
    public async Task GetEmpEtatConge_NoHireDate_ReturnsZeros()
    {
        // Fiche RH incomplète : pas de date d'embauche → 0 droit (au lieu de jeter).
        await using var db = NewContext();
        db.Employes.Add(new Employe { Empcod = Emp, Soccod = Soc, Sitcod = Sit, Empemb = null });
        await db.SaveChangesAsync();
        SetupNoConges();
        var svc = NewService(db);

        var result = await svc.GetEmpEtatCongeAsync(Soc, Emp, "01", "12", "2026");

        result.DroitConge.Should().Be(0);
    }

    [Fact]
    public async Task GetEmpEtatConge_HiredAfterTargetYear_ReturnsZero()
    {
        // Embauche en 2027, calcul pour 2026 → aucun droit acquis.
        await using var db = NewContext();
        db.Employes.Add(NewEmploye(new DateTime(2027, 3, 15)));
        await db.SaveChangesAsync();
        SetupSite(30f);
        SetupStandardCalendar();
        SetupParancemp();
        SetupNoConges();
        var svc = NewService(db);

        var result = await svc.GetEmpEtatCongeAsync(Soc, Emp, "01", "12", "2026");

        result.DroitConge.Should().Be(0);
    }

    [Fact]
    public async Task GetEmpEtatConge_LeftBeforeTargetYear_ReturnsZero()
    {
        // Sorti en 2025, calcul pour 2026 → 0 droit.
        await using var db = NewContext();
        db.Employes.Add(NewEmploye(new DateTime(2020, 1, 1), sortie: new DateTime(2025, 12, 31)));
        await db.SaveChangesAsync();
        SetupSite(30f);
        SetupStandardCalendar();
        SetupParancemp();
        SetupNoConges();
        var svc = NewService(db);

        var result = await svc.GetEmpEtatCongeAsync(Soc, Emp, "01", "12", "2026");

        result.DroitConge.Should().Be(0);
    }

    // ─── Calcul plein temps ─────────────────────────────────────────────────

    [Fact]
    public async Task GetEmpEtatConge_FullYearMensuel_AccruesCloseToAnnualRight()
    {
        // Salarié embauché en 2020, calcul 2026, droit 30 j/an → ~30 j sur 12 mois.
        // Calendrier 22 j/mois → 22×2.5/22 = 2.5/mois → 30 sur l'année.
        // CustomRound applique Math.Ceiling : on s'attend à 30.
        await using var db = NewContext();
        db.Employes.Add(NewEmploye(new DateTime(2020, 1, 1)));
        await db.SaveChangesAsync();
        SetupSite(30f);
        SetupStandardCalendar();
        SetupParancemp(parancemp: 5);
        SetupNoConges();
        var svc = NewService(db);

        var result = await svc.GetEmpEtatCongeAsync(Soc, Emp, "01", "12", "2026");

        // Avec parancemp=5 et ancienneté=6 → bonus = floor(6/5) = 1
        // → droit total = 30 + 1 = 31. Ceiling reste 31.
        result.DroitConge.Should().BeGreaterThanOrEqualTo(30);
        result.Anciennete.Should().BeGreaterThan(0);
    }

    [Fact]
    public async Task GetEmpEtatConge_AnneeRegulierePasDAnciennete_NoBonus()
    {
        // Embauche en 2024 → ancienneté en 2026 = 2, seuil parancemp=5 → pas de bonus.
        // Droit annuel 30 j, pas de seniorité → résultat ~30.
        await using var db = NewContext();
        db.Employes.Add(NewEmploye(new DateTime(2024, 1, 1)));
        await db.SaveChangesAsync();
        SetupSite(30f);
        SetupStandardCalendar();
        SetupParancemp(parancemp: 5);
        SetupNoConges();
        var svc = NewService(db);

        var result = await svc.GetEmpEtatCongeAsync(Soc, Emp, "01", "12", "2026");

        // Le code force anciente=0 si anciennete < parancemp (ligne 221).
        result.Anciennete.Should().Be(0);
        result.DroitConge.Should().BeGreaterThanOrEqualTo(30);
    }

    [Fact]
    public async Task GetEmpEtatConge_SoldeReporteN1_AddedToDroit()
    {
        // 5 j reportés de l'année précédente → doivent s'ajouter au droit acquis.
        await using var db = NewContext();
        db.Employes.Add(NewEmploye(new DateTime(2024, 1, 1)));
        db.Soldes.Add(new Solde { Empcod = Emp, Soccod = Soc, Annee = "2026", Conge = 5f, Empconge = 0 });
        await db.SaveChangesAsync();
        SetupSite(30f);
        SetupStandardCalendar();
        SetupParancemp(parancemp: 5);
        SetupNoConges();
        var svc = NewService(db);

        var result = await svc.GetEmpEtatCongeAsync(Soc, Emp, "01", "12", "2026");

        // 5 reportés + ~30 acquis = ~35.
        result.DroitConge.Should().BeGreaterThanOrEqualTo(35);
    }

    [Fact]
    public async Task GetEmpEtatConge_AvecCongesPris_SoldeAnterieurDecremente()
    {
        // 30 droit, 10 pris → solde restant = 20.
        await using var db = NewContext();
        db.Employes.Add(NewEmploye(new DateTime(2024, 1, 1)));
        await db.SaveChangesAsync();
        SetupSite(30f);
        SetupStandardCalendar();
        SetupParancemp(parancemp: 5);
        // 10 j pris au mois 06.
        _congeRepo.Setup(x => x.GetNbCongeRecueAsync(Soc, Emp, "2026", It.IsAny<string>()))
                  .ReturnsAsync((string s, string e, string a, string m) => m == "06" ? 10f : 0f);
        var svc = NewService(db);

        var result = await svc.GetEmpEtatCongeAsync(Soc, Emp, "01", "12", "2026");

        // sa = droitConge - congeRecue (10) → ~20.
        result.SoldeAnterieur.Should().BeApproximately(result.DroitConge - 10, 1.0);
    }

    // ─── Pro-rata mois d'embauche ──────────────────────────────────────────

    [Fact]
    public async Task GetEmpEtatConge_HiredMidYear_LessThanFullAnnual()
    {
        // Embauche 1er juillet 2026 → on n'a que 6 mois d'acquisition.
        // Droit attendu ≈ 30 × 6/12 = 15 (+/- pro-rata jour 1 = mois entier).
        await using var db = NewContext();
        db.Employes.Add(NewEmploye(new DateTime(2026, 7, 1)));
        await db.SaveChangesAsync();
        SetupSite(30f);
        SetupStandardCalendar();
        SetupParancemp(parancemp: 5);
        SetupNoConges();
        var svc = NewService(db);

        var result = await svc.GetEmpEtatCongeAsync(Soc, Emp, "01", "12", "2026");

        result.DroitConge.Should().BeGreaterThan(10);
        result.DroitConge.Should().BeLessThanOrEqualTo(20, "embauché à mi-année → ~15 j attendus");
    }

    [Fact]
    public async Task GetEmpEtatConge_HiredMidMonth_AppliesProrata()
    {
        // Embauche 16 juin 2026 → pro-rata juin = (30-16+1)/30 = 15/30 = 0.5.
        // Mois juin = 2.5 × 0.5 = 1.25 j (et 6 mois pleins juillet-décembre = 15)
        // Total ≈ 16.25 → Ceiling = 17.
        await using var db = NewContext();
        db.Employes.Add(NewEmploye(new DateTime(2026, 6, 16)));
        await db.SaveChangesAsync();
        SetupSite(30f);
        SetupStandardCalendar();
        SetupParancemp(parancemp: 5);
        SetupNoConges();
        var svc = NewService(db);

        var result = await svc.GetEmpEtatCongeAsync(Soc, Emp, "01", "12", "2026");

        result.DroitConge.Should().BeInRange(15, 20, "embauché 16/06 → ~16-17 j attendus");
    }

    // ─── Pro-rata mois de sortie ───────────────────────────────────────────

    [Fact]
    public async Task GetEmpEtatConge_LeftMidYear_AccruesOnlyUntilExit()
    {
        // Embauche ancienne, sortie 30 juin 2026 → on n'a que 6 mois d'acquisition.
        await using var db = NewContext();
        db.Employes.Add(NewEmploye(new DateTime(2020, 1, 1), sortie: new DateTime(2026, 6, 30)));
        await db.SaveChangesAsync();
        SetupSite(30f);
        SetupStandardCalendar();
        SetupParancemp(parancemp: 5);
        SetupNoConges();
        var svc = NewService(db);

        var result = await svc.GetEmpEtatCongeAsync(Soc, Emp, "01", "12", "2026");

        // 6 mois × 2.5 + bonus ancienneté éventuel.
        result.DroitConge.Should().BeLessThanOrEqualTo(20, "sortie à mi-année → max ~15-16 j");
    }

    // ─── Bonus ancienneté ──────────────────────────────────────────────────

    [Fact]
    public async Task GetEmpEtatConge_AncienneteAuSeuil_NoBonus()
    {
        // Ancienneté 5 ans, parancemp=5 → la condition est `anciente < parancemp` →
        // si anciente == parancemp, on reste à 0 dans le code final (ligne 221) ?
        // Lecture exacte : `if (anciente < parecart) anciente = 0;` → anc=5, parecart=5 → faux → on garde.
        // Bonus = floor(5/5) = 1 → on s'attend à anciennete=5 et droit +1.
        await using var db = NewContext();
        db.Employes.Add(NewEmploye(new DateTime(2021, 1, 1)));
        await db.SaveChangesAsync();
        SetupSite(30f);
        SetupStandardCalendar();
        SetupParancemp(parancemp: 5);
        SetupNoConges();
        var svc = NewService(db);

        var result = await svc.GetEmpEtatCongeAsync(Soc, Emp, "01", "12", "2026");

        result.Anciennete.Should().Be(5);
        result.DroitConge.Should().BeGreaterThanOrEqualTo(31, "30 + bonus 1");
    }

    [Fact]
    public async Task GetEmpEtatConge_AncienneteTresHaute_PlusieursPaliers()
    {
        // 15 ans d'ancienneté, parancemp=5 → bonus = floor(15/5) = 3 jours.
        await using var db = NewContext();
        db.Employes.Add(NewEmploye(new DateTime(2011, 1, 1)));
        await db.SaveChangesAsync();
        SetupSite(30f);
        SetupStandardCalendar();
        SetupParancemp(parancemp: 5);
        SetupNoConges();
        var svc = NewService(db);

        var result = await svc.GetEmpEtatCongeAsync(Soc, Emp, "01", "12", "2026");

        result.Anciennete.Should().Be(15);
        result.DroitConge.Should().BeGreaterThanOrEqualTo(33, "30 + bonus 3");
    }

    [Fact]
    public async Task GetEmpEtatConge_ConventionAnnuleAnciennete_MensueltType()
    {
        // Si Site.Sitsancm = "1" et Empreg = "M", ancienneté forcée à 0.
        await using var db = NewContext();
        db.Employes.Add(NewEmploye(new DateTime(2010, 1, 1), regime: "M"));
        await db.SaveChangesAsync();
        SetupSite(30f, sitsancm: "1");
        SetupStandardCalendar();
        SetupParancemp(parancemp: 5);
        SetupNoConges();
        var svc = NewService(db);

        var result = await svc.GetEmpEtatCongeAsync(Soc, Emp, "01", "12", "2026");

        result.Anciennete.Should().Be(0, "convention site annule l'ancienneté pour mensuels");
    }

    // ─── Sanctions disciplinaires ──────────────────────────────────────────

    [Fact]
    public async Task GetEmpEtatConge_AvecSanction_DimineCreditMensuel()
    {
        // Sanction qui couvre TOUT le mois (22 j) sur 3 mois différents → on perd
        // ~7.5 j de droit. On force une sanction massive pour passer outre
        // CustomRound = Math.Ceiling qui masque les petites différences (~0.5 j).
        // Sans cette taille de sanction, on aurait ~29.5 et ~30 — tous deux ceiling à 30.
        await using var db = NewContext();
        db.Employes.Add(NewEmploye(new DateTime(2024, 1, 1)));
        db.Sanctions.AddRange(
            new Sanction { Concod = "S1", Soccod = Soc, Empcod = Emp, Condep = new DateTime(2026, 6, 1), Connbjour = 22f },
            new Sanction { Concod = "S2", Soccod = Soc, Empcod = Emp, Condep = new DateTime(2026, 7, 1), Connbjour = 22f },
            new Sanction { Concod = "S3", Soccod = Soc, Empcod = Emp, Condep = new DateTime(2026, 8, 1), Connbjour = 22f }
        );
        await db.SaveChangesAsync();
        SetupSite(30f);
        SetupStandardCalendar();
        SetupParancemp(parancemp: 5);
        SetupNoConges();
        var svc = NewService(db);

        var avecSanction = await svc.GetEmpEtatCongeAsync(Soc, Emp, "01", "12", "2026");

        // Référence sans sanction : nouvelle DB, mocks partagés.
        await using var dbRef = NewContext();
        dbRef.Employes.Add(NewEmploye(new DateTime(2024, 1, 1)));
        await dbRef.SaveChangesAsync();
        var svcRef = NewService(dbRef);
        var ref_ = await svcRef.GetEmpEtatCongeAsync(Soc, Emp, "01", "12", "2026");

        avecSanction.DroitConge.Should().BeLessThan(ref_.DroitConge,
            "3 mois de sanctions totales doivent annuler ~7.5 j de droit (avant ceiling)");
    }

    // ─── Site.Sitconge non défini → fallback légal ─────────────────────────

    [Fact]
    public async Task GetEmpEtatConge_SiteSansSitconge_AppliqueDefaut30()
    {
        // Site.Sitconge null → fallback FRENCH_LEGAL_DAYS_PER_YEAR = 30.
        await using var db = NewContext();
        db.Employes.Add(NewEmploye(new DateTime(2024, 1, 1)));
        await db.SaveChangesAsync();
        SetupSite(sitconge: null);
        SetupStandardCalendar();
        SetupParancemp(parancemp: 5);
        SetupNoConges();
        var svc = NewService(db);

        var result = await svc.GetEmpEtatCongeAsync(Soc, Emp, "01", "12", "2026");

        result.DroitMensuelle.Should().BeApproximately(2.5, 0.5,
            "30 / 12 = 2.5 j/mois (CustomRound = Ceiling → 3 attendu en pratique)");
    }

    [Fact]
    public async Task GetEmpEtatConge_SiteSitcongePersonnalise_UtiliseValeur()
    {
        // Convention collective : 25 j/an au lieu de 30.
        await using var db = NewContext();
        db.Employes.Add(NewEmploye(new DateTime(2024, 1, 1)));
        await db.SaveChangesAsync();
        SetupSite(25f);
        SetupStandardCalendar();
        SetupParancemp(parancemp: 5);
        SetupNoConges();
        var svc = NewService(db);

        var result = await svc.GetEmpEtatCongeAsync(Soc, Emp, "01", "12", "2026");

        // 25 / 12 ≈ 2.083 → Ceiling = 3 (CustomRound).
        result.DroitMensuelle.Should().BeApproximately(3, 1);
        result.DroitConge.Should().BeInRange(24, 27);
    }

    // ─── Régime horaire (Empreg = "H") ─────────────────────────────────────

    [Fact]
    public async Task GetEmpEtatConge_RegimeHoraire_CalculBaséSurHeures()
    {
        // Empreg="H" → crédit = (jours_travaillés × heures_jour × cm) / heures_mois.
        // 22 j × 8h × 2.5 / 176h = 2.5 — équivalent au calcul jour.
        await using var db = NewContext();
        db.Employes.Add(NewEmploye(new DateTime(2024, 1, 1), regime: "H"));
        await db.SaveChangesAsync();
        SetupSite(30f);
        SetupStandardCalendar(trav: 22f, nbh: 176f, hjour: 8f);
        SetupParancemp(parancemp: 5);
        SetupNoConges();
        var svc = NewService(db);

        var result = await svc.GetEmpEtatCongeAsync(Soc, Emp, "01", "12", "2026");

        result.DroitConge.Should().BeGreaterThanOrEqualTo(30,
            "régime horaire avec ratio standard = équivalent jour");
    }

    // ─── Fallback calendrier ────────────────────────────────────────────────

    [Fact]
    public async Task GetEmpEtatConge_CalendrierAbsent_UtiliseDefauts()
    {
        // Aucun Calendsoc en base → fallback 26 j/mois, 208h, 8h/j.
        await using var db = NewContext();
        db.Employes.Add(NewEmploye(new DateTime(2024, 1, 1)));
        await db.SaveChangesAsync();
        SetupSite(30f);
        SetupNoCalendar(); // pas de calendrier configuré
        SetupParancemp(parancemp: 5);
        SetupNoConges();
        var svc = NewService(db);

        var result = await svc.GetEmpEtatCongeAsync(Soc, Emp, "01", "12", "2026");

        // Doit fonctionner sans planter — avec fallback 26 j, on a quand même un droit positif.
        result.DroitConge.Should().BeGreaterThan(0);
    }

    // ─── Borne moisfin ─────────────────────────────────────────────────────

    [Fact]
    public async Task GetEmpEtatConge_MoisfinPartiel_NeCalculeQueJusquaCeMois()
    {
        // moisfin = "06" → calcul s'arrête à juin → ~15 j (6 × 2.5).
        await using var db = NewContext();
        db.Employes.Add(NewEmploye(new DateTime(2024, 1, 1)));
        await db.SaveChangesAsync();
        SetupSite(30f);
        SetupStandardCalendar();
        SetupParancemp(parancemp: 5);
        SetupNoConges();
        var svc = NewService(db);

        var jusquJuin = await svc.GetEmpEtatCongeAsync(Soc, Emp, "01", "06", "2026");
        var jusquDec = await svc.GetEmpEtatCongeAsync(Soc, Emp, "01", "12", "2026");

        jusquJuin.DroitConge.Should().BeLessThan(jusquDec.DroitConge);
    }

    // ─── Régression : valeurs Infinity/NaN ────────────────────────────────

    [Fact]
    public async Task GetEmpEtatConge_NaNFromRepository_HandledGracefully()
    {
        // Le code défend contre NaN/Infinity dans congeRecue.
        await using var db = NewContext();
        db.Employes.Add(NewEmploye(new DateTime(2024, 1, 1)));
        await db.SaveChangesAsync();
        SetupSite(30f);
        SetupStandardCalendar();
        SetupParancemp(parancemp: 5);
        _congeRepo.Setup(x => x.GetNbCongeRecueAsync(Soc, Emp, "2026", It.IsAny<string>()))
                  .ReturnsAsync(float.NaN);
        var svc = NewService(db);

        var result = await svc.GetEmpEtatCongeAsync(Soc, Emp, "01", "12", "2026");

        // Pas de propagation de NaN/Infinity dans le résultat (problème JSON sinon).
        double.IsFinite(result.DroitConge).Should().BeTrue();
        double.IsFinite(result.SoldeAnterieur).Should().BeTrue();
    }
}
