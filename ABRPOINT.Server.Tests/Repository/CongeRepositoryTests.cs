using ABRPOINT.Server.Data;
using ABRPOINT.Server.Interfaces;
using ABRPOINT.Server.Models;
using ABRPOINT.Server.Repository;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Moq;
using Xunit;

namespace ABRPOINT.Server.Tests.Repository;

/// <summary>
/// Tests de CongeRepository. On utilise EF Core InMemory pour les requêtes
/// LINQ (joins, group-by, filtres) qui sont la majorité du code, et on mocke
/// les dépendances annexes (JourFerieRepository, ParametreRepository, PosteRepository,
/// UtilisateurRepository) lorsque les méthodes testées y font appel.
///
/// Couverture cible :
///   - GetCongesByPeriodAsync : jointure conge × absence + filtre date overlap
///   - GetNbCongeRecueAsync : agrégation mensuelle filtrée par Abscng="0" (CP only)
///   - GetEmpCongeByDateAsync : lookup par date exacte
///   - AddAsync / AddMultipleAsync : persistance
/// </summary>
public class CongeRepositoryTests
{
    private const string Soc = "S1";
    private const string Emp = "E001";

    private static ApplicationDbContext NewContext()
    {
        var options = new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseInMemoryDatabase($"conge-repo-{Guid.NewGuid()}")
            .Options;
        return new ApplicationDbContext(options);
    }

    private static CongeRepository NewRepo(ApplicationDbContext db,
        Mock<IJourFerieRepository>? ferie = null,
        Mock<IParametreRepository>? param = null,
        Mock<IPosteRepository>? poste = null,
        Mock<IUtilisateurRepository>? user = null)
    {
        return new CongeRepository(
            db,
            (ferie ?? new Mock<IJourFerieRepository>()).Object,
            (poste ?? new Mock<IPosteRepository>()).Object,
            (param ?? new Mock<IParametreRepository>()).Object,
            (user ?? new Mock<IUtilisateurRepository>()).Object);
    }

    private static Conge MakeConge(string concod, DateTime debut, DateTime fin, string abscod = "CP", float? nbJour = 5f)
        => new()
        {
            Concod = concod,
            Soccod = Soc,
            Empcod = Emp,
            Condep = debut,
            Conret = fin,
            Condat = debut,
            Abscod = abscod,
            Connbjour = nbJour,
            Conamdep = "0",
            Conamret = "0",
        };

    private static Absence MakeAbsence(string code, string abscng = "0", string abspayer = "O", string absrepos = "N", string absferier = "0", string? lib = null)
        => new()
        {
            Abscod = code,
            Soccod = Soc,
            Abscng = abscng,
            Abspayer = abspayer,
            Absrepos = absrepos,
            Absferier = absferier,
            Abslib = lib ?? "Congé payé",
        };

    // ─── AddAsync ───────────────────────────────────────────────────────────

    [Fact]
    public async Task AddAsync_PersistsConge()
    {
        await using var db = NewContext();
        var repo = NewRepo(db);
        var c = MakeConge("C1", new(2026, 5, 1), new(2026, 5, 5));

        await repo.AddAsync(c);

        (await db.Conges.CountAsync()).Should().Be(1);
        (await db.Conges.FirstAsync()).Concod.Should().Be("C1");
    }

    // ─── GetCongesByPeriodAsync : overlap dates ─────────────────────────────

    [Fact]
    public async Task GetCongesByPeriodAsync_OverlapMatch_ReturnsLeave()
    {
        // Congé 5→10 mai, on cherche 8→15 mai → overlap → doit matcher.
        await using var db = NewContext();
        db.Absences.Add(MakeAbsence("CP", lib: "Congé payé"));
        db.Conges.Add(MakeConge("C1", new(2026, 5, 5), new(2026, 5, 10)));
        await db.SaveChangesAsync();
        var repo = NewRepo(db);

        var result = await repo.GetCongesByPeriodAsync(Soc, Emp, new(2026, 5, 8), new(2026, 5, 15));

        result.Should().ContainSingle();
        result[0].Abslib.Should().Be("Congé payé");
    }

    [Fact]
    public async Task GetCongesByPeriodAsync_NoOverlap_ReturnsEmpty()
    {
        // Congé entièrement avant la fenêtre → 0 résultat.
        await using var db = NewContext();
        db.Absences.Add(MakeAbsence("CP"));
        db.Conges.Add(MakeConge("C1", new(2026, 5, 5), new(2026, 5, 10)));
        await db.SaveChangesAsync();
        var repo = NewRepo(db);

        var result = await repo.GetCongesByPeriodAsync(Soc, Emp, new(2026, 6, 1), new(2026, 6, 30));

        result.Should().BeEmpty();
    }

    [Fact]
    public async Task GetCongesByPeriodAsync_FiltersBySoccod()
    {
        // Multi-tenant : un congé S2 ne doit JAMAIS remonter sur une requête S1.
        await using var db = NewContext();
        db.Absences.AddRange(
            new Absence { Abscod = "CP", Soccod = "S1", Abscng = "0", Abslib = "S1-CP" },
            new Absence { Abscod = "CP", Soccod = "S2", Abscng = "0", Abslib = "S2-CP" });
        db.Conges.AddRange(
            new Conge { Concod = "C1", Soccod = "S1", Empcod = Emp, Condep = new(2026, 5, 5), Conret = new(2026, 5, 10), Abscod = "CP", Connbjour = 5f },
            new Conge { Concod = "C2", Soccod = "S2", Empcod = Emp, Condep = new(2026, 5, 5), Conret = new(2026, 5, 10), Abscod = "CP", Connbjour = 5f });
        await db.SaveChangesAsync();
        var repo = NewRepo(db);

        var result = await repo.GetCongesByPeriodAsync("S1", Emp, new(2026, 5, 1), new(2026, 5, 31));

        result.Should().ContainSingle();
        result[0].Abslib.Should().Be("S1-CP");
    }

    [Fact]
    public async Task GetCongesByPeriodAsync_FiltersByEmpcod()
    {
        await using var db = NewContext();
        db.Absences.Add(MakeAbsence("CP"));
        db.Conges.AddRange(
            MakeConge("C1", new(2026, 5, 5), new(2026, 5, 10)),
            new Conge { Concod = "C2", Soccod = Soc, Empcod = "OTHER", Condep = new(2026, 5, 5), Conret = new(2026, 5, 10), Abscod = "CP", Connbjour = 5f });
        await db.SaveChangesAsync();
        var repo = NewRepo(db);

        var result = await repo.GetCongesByPeriodAsync(Soc, Emp, new(2026, 5, 1), new(2026, 5, 31));

        result.Should().ContainSingle();
    }

    // ─── GetNbCongeRecueAsync : seul Abscng="0" compte ──────────────────────

    [Fact]
    public async Task GetNbCongeRecueAsync_OnlyCountsAbscng0()
    {
        // Règle critique du droit français : seuls les congés PAYÉS (Abscng="0")
        // sont déduits du solde. Les RTT (Abscng="R") et autres absences ne touchent
        // pas au calcul du droit annuel. Tester ce filtre est NON NÉGOCIABLE.
        await using var db = NewContext();
        db.Absences.AddRange(
            new Absence { Abscod = "CP", Soccod = Soc, Abscng = "0", Abslib = "CP" },
            new Absence { Abscod = "RTT", Soccod = Soc, Abscng = "R", Abslib = "RTT" },
            new Absence { Abscod = "AUTRE", Soccod = Soc, Abscng = "1", Abslib = "Autre" }
        );
        db.Conges.AddRange(
            MakeConge("C1", new(2026, 5, 3), new(2026, 5, 8), "CP", 5f),
            MakeConge("C2", new(2026, 5, 15), new(2026, 5, 17), "RTT", 2f),     // exclu
            MakeConge("C3", new(2026, 5, 20), new(2026, 5, 22), "AUTRE", 3f)    // exclu
        );
        await db.SaveChangesAsync();
        var repo = NewRepo(db);

        var nb = await repo.GetNbCongeRecueAsync(Soc, Emp, "2026", "05");

        nb.Should().Be(5f, "seul le congé Abscng=\"0\" (5 j) doit être agrégé");
    }

    [Fact]
    public async Task GetNbCongeRecueAsync_NoConges_ReturnsZero()
    {
        await using var db = NewContext();
        var repo = NewRepo(db);

        var nb = await repo.GetNbCongeRecueAsync(Soc, Emp, "2026", "05");

        nb.Should().Be(0f);
    }

    [Fact]
    public async Task GetNbCongeRecueAsync_FiltersByMonth()
    {
        // Le filtre se fait sur Condep.Month — un congé qui chevauche 2 mois est
        // entièrement attribué au mois de DÉBUT (limitation connue, voir code).
        await using var db = NewContext();
        db.Absences.Add(MakeAbsence("CP"));
        db.Conges.AddRange(
            MakeConge("C-AVR", new(2026, 4, 28), new(2026, 5, 2), "CP", 5f),     // mois 4
            MakeConge("C-MAI", new(2026, 5, 10), new(2026, 5, 15), "CP", 5f)     // mois 5
        );
        await db.SaveChangesAsync();
        var repo = NewRepo(db);

        var avr = await repo.GetNbCongeRecueAsync(Soc, Emp, "2026", "04");
        var mai = await repo.GetNbCongeRecueAsync(Soc, Emp, "2026", "05");
        var jui = await repo.GetNbCongeRecueAsync(Soc, Emp, "2026", "06");

        avr.Should().Be(5f);
        mai.Should().Be(5f);
        jui.Should().Be(0f);
    }

    [Fact]
    public async Task GetNbCongeRecueAsync_FiltersByYear()
    {
        await using var db = NewContext();
        db.Absences.Add(MakeAbsence("CP"));
        db.Conges.AddRange(
            MakeConge("C-2025", new(2025, 5, 1), new(2025, 5, 5), "CP", 5f),
            MakeConge("C-2026", new(2026, 5, 1), new(2026, 5, 5), "CP", 5f)
        );
        await db.SaveChangesAsync();
        var repo = NewRepo(db);

        var nb2025 = await repo.GetNbCongeRecueAsync(Soc, Emp, "2025", "05");
        var nb2026 = await repo.GetNbCongeRecueAsync(Soc, Emp, "2026", "05");

        nb2025.Should().Be(5f);
        nb2026.Should().Be(5f);
    }

    [Fact]
    public async Task GetNbCongeRecueAsync_HandlesNullNbJour()
    {
        // Connbjour est nullable. ?? 0 dans le code doit gérer le cas null.
        await using var db = NewContext();
        db.Absences.Add(MakeAbsence("CP"));
        db.Conges.Add(MakeConge("C1", new(2026, 5, 1), new(2026, 5, 5), "CP", nbJour: null));
        await db.SaveChangesAsync();
        var repo = NewRepo(db);

        var nb = await repo.GetNbCongeRecueAsync(Soc, Emp, "2026", "05");

        nb.Should().Be(0f);
    }

    // ─── GetEmpCongeByDateAsync ─────────────────────────────────────────────

    [Fact]
    public async Task GetEmpCongeByDateAsync_ExactMatch_ReturnsConge()
    {
        var date = new DateTime(2026, 5, 10);
        await using var db = NewContext();
        db.Conges.Add(new Conge { Concod = "C1", Soccod = Soc, Empcod = Emp, Condat = date, Condep = date, Conret = date.AddDays(1), Abscod = "CP" });
        await db.SaveChangesAsync();
        var repo = NewRepo(db);

        var result = await repo.GetEmpCongeByDateAsync(Soc, Emp, date);

        result.Should().NotBeNull();
        result!.Concod.Should().Be("C1");
    }

    [Fact]
    public async Task GetEmpCongeByDateAsync_NoMatch_ReturnsNull()
    {
        await using var db = NewContext();
        var repo = NewRepo(db);

        var result = await repo.GetEmpCongeByDateAsync(Soc, Emp, new DateTime(2026, 5, 10));

        result.Should().BeNull();
    }

    [Fact]
    public async Task GetEmpCongeByDateAsync_FiltersBySoccodAndEmpcod()
    {
        var date = new DateTime(2026, 5, 10);
        await using var db = NewContext();
        db.Conges.AddRange(
            new Conge { Concod = "C-S1", Soccod = "S1", Empcod = Emp, Condat = date, Condep = date, Conret = date.AddDays(1), Abscod = "CP" },
            new Conge { Concod = "C-S2", Soccod = "S2", Empcod = Emp, Condat = date, Condep = date, Conret = date.AddDays(1), Abscod = "CP" },
            new Conge { Concod = "C-S1-OTHER", Soccod = "S1", Empcod = "OTHER", Condat = date, Condep = date, Conret = date.AddDays(1), Abscod = "CP" }
        );
        await db.SaveChangesAsync();
        var repo = NewRepo(db);

        var result = await repo.GetEmpCongeByDateAsync("S1", Emp, date);

        result.Should().NotBeNull();
        result!.Concod.Should().Be("C-S1");
    }
}
