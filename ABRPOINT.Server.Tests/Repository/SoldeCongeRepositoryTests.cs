using ABRPOINT.Server.CalculService.Conge;
using ABRPOINT.Server.CalculService.Rtt;
using ABRPOINT.Server.Data;
using ABRPOINT.Server.Dtaos;
using ABRPOINT.Server.Models;
using ABRPOINT.Server.Repository;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Moq;
using Xunit;

namespace ABRPOINT.Server.Tests.Repository;

/// <summary>
/// Tests de SoldeCongeRepository.
///
/// Particularité : ce repo combine deux sources pour produire le solde renvoyé à l'UI :
///   • CongeCalculationService.GetEmpEtatCongeAsync → DroitConge + SoldeAnterieur
///   • RttCalculationService.GetRttSoldeAsync → RttJours + Pris
///
/// Avant le fix (cf. commentaire ligne 64-66 du repo), RTT n'était pas appelé et la
/// carte « Solde RTT » côté front affichait 0 même quand l'employé avait 11 j saisis.
/// Ces tests vérifient le contrat : les deux services sont appelés ET leurs valeurs
/// sont remontées dans la DTO Solde.
/// </summary>
public class SoldeCongeRepositoryTests
{
    private const string Soc = "S1";
    private const string Emp = "E001";

    private readonly Mock<ICongeCalculationService> _cngCalc = new();
    private readonly Mock<IRttCalculationService> _rttCalc = new();

    private static ApplicationDbContext NewContext()
        => new(new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseInMemoryDatabase($"solde-{Guid.NewGuid()}").Options);

    private SoldeCongeRepository NewRepo(ApplicationDbContext db)
        => new(db, _cngCalc.Object, _rttCalc.Object);

    // ─── CRUD basique ──────────────────────────────────────────────────────

    [Fact]
    public async Task AddAsync_PersistsSolde()
    {
        await using var db = NewContext();
        var repo = NewRepo(db);
        var s = new Solde { Soccod = Soc, Empcod = Emp, Conge = 30f, Empconge = 5f };

        await repo.AddAsync(s);

        (await db.Soldes.CountAsync()).Should().Be(1);
    }

    [Fact]
    public async Task DeleteAsync_RemovesSolde()
    {
        await using var db = NewContext();
        var s = new Solde { Soccod = Soc, Empcod = Emp, Conge = 30f };
        db.Soldes.Add(s);
        await db.SaveChangesAsync();
        var repo = NewRepo(db);

        await repo.DeleteAsync(s);

        (await db.Soldes.CountAsync()).Should().Be(0);
    }

    [Fact]
    public async Task DeleteAsync_NullSolde_DoesNotThrow()
    {
        // Le code tolère null (pas de NullReferenceException). On vérifie ce contrat.
        await using var db = NewContext();
        var repo = NewRepo(db);

        var act = async () => await repo.DeleteAsync(null!);

        await act.Should().NotThrowAsync();
    }

    [Fact]
    public async Task GetByEmpcodAsync_ReturnsCorrectSolde()
    {
        await using var db = NewContext();
        db.Soldes.AddRange(
            new Solde { Soccod = Soc, Empcod = Emp, Conge = 30f },
            new Solde { Soccod = Soc, Empcod = "OTHER", Conge = 25f }
        );
        await db.SaveChangesAsync();
        var repo = NewRepo(db);

        var s = await repo.GetByEmpcodAsync(Soc, Emp);

        s.Should().NotBeNull();
        s!.Conge.Should().Be(30f);
    }

    [Fact]
    public async Task GetByEmpcodAsync_NotFound_ReturnsNull()
    {
        await using var db = NewContext();
        var repo = NewRepo(db);

        var s = await repo.GetByEmpcodAsync(Soc, "NOPE");

        s.Should().BeNull();
    }

    // ─── GetByEmpCalculatedAsync : fusion Conge + RTT ──────────────────────

    [Fact]
    public async Task GetByEmpCalculatedAsync_CombinesCongeAndRtt()
    {
        // Régression critique : si l'appel RTT manque, RttJours/RttUtilises restent à
        // null et la carte côté front affiche 0 alors que l'employé a un droit.
        await using var db = NewContext();
        _cngCalc.Setup(x => x.GetEmpEtatCongeAsync(Soc, Emp, "01", It.IsAny<string>(), It.IsAny<string>()))
                .ReturnsAsync(new EmpEtatConge(2.5, 5, 30, 22));
        _rttCalc.Setup(x => x.GetRttSoldeAsync(Soc, Emp))
                .ReturnsAsync(new RttSoldeDto { DroitAnnuel = 11f, Pris = 3f, Methode = "J", Annee = DateTime.Now.Year.ToString() });
        var repo = NewRepo(db);

        var solde = await repo.GetByEmpCalculatedAsync(Soc, Emp);

        solde.Should().NotBeNull();
        solde!.Soccod.Should().Be(Soc);
        solde.Empcod.Should().Be(Emp);
        solde.Conge.Should().Be(30f, "DroitConge venant du CongeCalculationService");
        solde.Empconge.Should().Be(22f, "SoldeAnterieur venant du CongeCalculationService");
        solde.RttJours.Should().Be(11f, "DroitAnnuel venant du RttCalculationService");
        solde.RttUtilises.Should().Be(3f, "Pris venant du RttCalculationService");
    }

    [Fact]
    public async Task GetByEmpCalculatedAsync_RttNull_PreservesCongeData()
    {
        // Si RTT renvoie null (méthode non configurée), les données Congé restent valides.
        await using var db = NewContext();
        _cngCalc.Setup(x => x.GetEmpEtatCongeAsync(Soc, Emp, "01", It.IsAny<string>(), It.IsAny<string>()))
                .ReturnsAsync(new EmpEtatConge(2.5, 0, 30, 30));
        _rttCalc.Setup(x => x.GetRttSoldeAsync(Soc, Emp))
                .ReturnsAsync((RttSoldeDto)null!);
        var repo = NewRepo(db);

        var solde = await repo.GetByEmpCalculatedAsync(Soc, Emp);

        solde!.Conge.Should().Be(30f);
        solde.RttJours.Should().BeNull();
        solde.RttUtilises.Should().BeNull();
    }

    [Fact]
    public async Task GetByEmpCalculatedAsync_AlwaysCallsCongeAndRtt()
    {
        // Vérification du contrat : les DEUX services doivent être appelés à chaque
        // requête. Si quelqu'un commente l'un par erreur, le test casse.
        await using var db = NewContext();
        _cngCalc.Setup(x => x.GetEmpEtatCongeAsync(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>()))
                .ReturnsAsync(new EmpEtatConge(0, 0, 0, 0));
        _rttCalc.Setup(x => x.GetRttSoldeAsync(It.IsAny<string>(), It.IsAny<string>()))
                .ReturnsAsync(new RttSoldeDto());
        var repo = NewRepo(db);

        await repo.GetByEmpCalculatedAsync(Soc, Emp);

        _cngCalc.Verify(x => x.GetEmpEtatCongeAsync(Soc, Emp, "01", It.IsAny<string>(), It.IsAny<string>()), Times.Once);
        _rttCalc.Verify(x => x.GetRttSoldeAsync(Soc, Emp), Times.Once);
    }

    [Fact]
    public async Task GetByEmpCalculatedAsync_UsesCurrentYearAndMonth()
    {
        // L'année et le mois passés au service doivent correspondre au présent.
        await using var db = NewContext();
        string? capturedAnnee = null, capturedMois = null;
        _cngCalc.Setup(x => x.GetEmpEtatCongeAsync(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>()))
                .Callback<string, string, string, string, string>((_, _, _, m, a) =>
                {
                    capturedMois = m;
                    capturedAnnee = a;
                })
                .ReturnsAsync(new EmpEtatConge(0, 0, 0, 0));
        _rttCalc.Setup(x => x.GetRttSoldeAsync(It.IsAny<string>(), It.IsAny<string>()))
                .ReturnsAsync(new RttSoldeDto());
        var repo = NewRepo(db);

        await repo.GetByEmpCalculatedAsync(Soc, Emp);

        capturedAnnee.Should().Be(DateTime.Now.Year.ToString());
        capturedMois.Should().Be(DateTime.Now.Month.ToString("D2"));
    }

    [Fact]
    public async Task GetByEmpCalculatedAsync_SetsAnneeOnResult()
    {
        await using var db = NewContext();
        _cngCalc.Setup(x => x.GetEmpEtatCongeAsync(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>()))
                .ReturnsAsync(new EmpEtatConge(0, 0, 0, 0));
        _rttCalc.Setup(x => x.GetRttSoldeAsync(It.IsAny<string>(), It.IsAny<string>()))
                .ReturnsAsync(new RttSoldeDto());
        var repo = NewRepo(db);

        var s = await repo.GetByEmpCalculatedAsync(Soc, Emp);

        s!.Annee.Should().Be(DateTime.Now.Year.ToString());
    }
}
