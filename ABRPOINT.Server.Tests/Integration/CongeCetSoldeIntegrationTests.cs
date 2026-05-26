using ABRPOINT.Server.CalculService.Conge;
using ABRPOINT.Server.Controllers;
using ABRPOINT.Server.Data;
using ABRPOINT.Server.Interfaces;
using ABRPOINT.Server.Models;
using FluentAssertions;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Moq;
using Xunit;

namespace ABRPOINT.Server.Tests.Integration;

/// <summary>
/// Tests d'intégration : simulent des SCÉNARIOS COMPLETS qui touchent plusieurs
/// composants (Conge, Solde, CET) sans isoler chaque service.
///
/// Objectif : démontrer que les invariants métier tiennent quand on enchaîne des
/// actions réelles (poser un congé, recalculer le solde, transférer vers le CET).
/// </summary>
public class CongeCetSoldeIntegrationTests
{
    private const string Soc = "S1";
    private const string Emp = "E001";
    private const string Sit = "01";
    private const string Caltype = "01";

    private static ApplicationDbContext NewContext(string name)
        => new(new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseInMemoryDatabase($"{name}-{Guid.NewGuid()}").Options);

    // ─── Scénario 1 : Cycle complet année N → CET ──────────────────────────

    [Fact]
    public async Task Scenario_AnnualCycle_AccrueTakeTransferToCet()
    {
        // Salarié plein temps, 30 j de droit, en prend 25, le 31-05 on bascule
        // les 5 restants au CET (sous le plafond 10).
        await using var db = NewContext("scenario-cycle");

        // 1. Setup employé + site + paramètres CET
        db.Employes.Add(new Employe
        {
            Empcod = Emp, Soccod = Soc, Sitcod = Sit,
            Empemb = new DateTime(2020, 1, 1),
            Empreg = "M", Caltype = Caltype,
        });
        db.Sites.Add(new Site { Sitcod = Sit, Soccod = Soc, Sitconge = 30f });
        db.Parametres.Add(new Parametre { Soccod = Soc, Parcetdatelim = "31-05", Parcetmaxjours = 10f });
        // Solde initial : 30 alloués, 25 pris (il reste 5).
        db.Soldes.Add(new Solde { Soccod = Soc, Empcod = Emp, Annee = "2026", Conge = 30f, Empconge = 25f, Cetjours = 0f });
        await db.SaveChangesAsync();

        // 2. Apply CET → on doit transférer 5 j (sous le cap 10), et ne PAS perdre.
        var cetCtrl = new CetController(db);
        var apply = ((await cetCtrl.Apply(Soc, "2026")) as OkObjectResult)!.Value as CetController.CetTransferResult;

        // 3. Vérifications
        apply!.EmployesTraites.Should().Be(1);
        apply.TotalJoursTransferes.Should().Be(5f);

        var solde = await db.Soldes.FirstAsync();
        solde.Cetjours.Should().Be(5f, "5 j transférés au CET");
        solde.Conge.Should().Be(25f, "Conge ramené au pris → solde restant 0");

        // 4. Invariant : aucun jour perdu (alloué = pris + CET).
        var totalConserve = solde.Empconge + solde.Cetjours;
        totalConserve.Should().Be(30f, "tout le droit est conservé (pris ou CET)");
    }

    // ─── Scénario 2 : Solde dépasse plafond → perte ────────────────────────

    [Fact]
    public async Task Scenario_SoldeExceedsCap_ExcessIsLost()
    {
        // Salarié paresseux : 30 alloués, 5 pris, reste 25. Plafond CET 10 → 10 au CET,
        // 15 PERDUS. C'est la règle française : "ce qui n'est ni pris ni transféré tombe".
        await using var db = NewContext("scenario-loss");
        db.Parametres.Add(new Parametre { Soccod = Soc, Parcetmaxjours = 10f });
        db.Soldes.Add(new Solde { Soccod = Soc, Empcod = Emp, Annee = "2026", Conge = 30f, Empconge = 5f, Cetjours = 0f });
        await db.SaveChangesAsync();

        var cetCtrl = new CetController(db);
        var apply = ((await cetCtrl.Apply(Soc, "2026")) as OkObjectResult)!.Value as CetController.CetTransferResult;

        apply!.TotalJoursTransferes.Should().Be(10f);

        var solde = await db.Soldes.FirstAsync();
        solde.Cetjours.Should().Be(10f);
        solde.Conge.Should().Be(5f); // ramené au pris

        // Invariant : 30 alloués, 5 pris, 10 au CET, 15 perdus (non tracés explicitement
        // mais déductibles : 30 - 5 - 10 = 15).
        var perdus = 30f - solde.Empconge - solde.Cetjours;
        perdus.Should().Be(15f, "règle française classique : surplus au-delà du plafond perdu");
    }

    // ─── Scénario 3 : Multi-tenants isolés ─────────────────────────────────

    [Fact]
    public async Task Scenario_MultiTenant_IsolationBetweenSocietes()
    {
        // Deux sociétés sur la même base. L'apply CET sur S1 ne doit RIEN faire à S2.
        // C'est l'invariant numéro 1 du multi-tenancy.
        await using var db = NewContext("scenario-multi-tenant");
        db.Parametres.AddRange(
            new Parametre { Soccod = "S1", Parcetmaxjours = 10f },
            new Parametre { Soccod = "S2", Parcetmaxjours = 10f }
        );
        db.Soldes.AddRange(
            new Solde { Soccod = "S1", Empcod = "E1", Annee = "2026", Conge = 30, Empconge = 5, Cetjours = 0 },
            new Solde { Soccod = "S1", Empcod = "E2", Annee = "2026", Conge = 30, Empconge = 20, Cetjours = 0 },
            new Solde { Soccod = "S2", Empcod = "E1", Annee = "2026", Conge = 30, Empconge = 5, Cetjours = 0 },
            new Solde { Soccod = "S2", Empcod = "E2", Annee = "2026", Conge = 30, Empconge = 20, Cetjours = 0 }
        );
        await db.SaveChangesAsync();

        var cetCtrl = new CetController(db);
        await cetCtrl.Apply("S1", "2026");

        // S1 : modifié.
        var s1e1 = await db.Soldes.FirstAsync(s => s.Soccod == "S1" && s.Empcod == "E1");
        s1e1.Cetjours.Should().Be(10f);

        // S2 : intact.
        var s2 = await db.Soldes.Where(s => s.Soccod == "S2").ToListAsync();
        s2.Should().AllSatisfy(s =>
        {
            s.Cetjours.Should().Be(0f, "S2 n'était pas la cible → INTACT");
            s.Conge.Should().Be(30f);
        });
    }

    // ─── Scénario 4 : Idempotence du PUT paramètres ────────────────────────

    [Fact]
    public async Task Scenario_PutCetParametersTwice_IsIdempotent()
    {
        // Cas réel : l'admin clique 2× sur "Enregistrer" → on ne doit pas créer 2 lignes
        // Parametre, ni planter sur la clé unique.
        await using var db = NewContext("scenario-idempotent");
        var ctrl = new CetController(db);

        await ctrl.UpdateParametres(new CetController.CetParametersDto { Soccod = Soc, Datelim = "31-05", Maxjours = 10f });
        await ctrl.UpdateParametres(new CetController.CetParametersDto { Soccod = Soc, Datelim = "15-06", Maxjours = 20f });

        (await db.Parametres.CountAsync(p => p.Soccod == Soc)).Should().Be(1,
            "PUT doit upsert, pas créer de doublon");
        var p = await db.Parametres.FirstAsync();
        p.Parcetdatelim.Should().Be("15-06");
        p.Parcetmaxjours.Should().Be(20f);
    }

    // ─── Scénario 5 : Preview puis Apply cohérents ─────────────────────────

    [Fact]
    public async Task Scenario_PreviewMatchesApplyResult()
    {
        // L'admin vérifie le preview avant d'appliquer. Le total annoncé en preview
        // DOIT correspondre exactement au total appliqué (UX critique : pas de surprise).
        await using var db = NewContext("scenario-preview");
        db.Parametres.Add(new Parametre { Soccod = Soc, Parcetmaxjours = 10f });
        db.Soldes.AddRange(
            new Solde { Soccod = Soc, Empcod = "A", Annee = "2026", Conge = 25, Empconge = 20, Cetjours = 0 },
            new Solde { Soccod = Soc, Empcod = "B", Annee = "2026", Conge = 25, Empconge = 5, Cetjours = 0 },
            new Solde { Soccod = Soc, Empcod = "C", Annee = "2026", Conge = 30, Empconge = 30, Cetjours = 0 }
        );
        await db.SaveChangesAsync();

        var ctrl = new CetController(db);
        var preview = ((await ctrl.Preview(Soc, "2026")) as OkObjectResult)!.Value as CetController.CetTransferResult;
        var apply = ((await ctrl.Apply(Soc, "2026")) as OkObjectResult)!.Value as CetController.CetTransferResult;

        apply!.TotalJoursTransferes.Should().Be(preview!.TotalJoursTransferes);
        apply.EmployesTraites.Should().Be(preview.EmployesTraites);
    }

    // ─── Scénario 6 : Calcul solde dynamique + RTT (vue front "Mon Solde") ─

    [Fact]
    public async Task Scenario_GetSoldeCalculated_PrendCongeFromCalculAndRttFromService()
    {
        // L'écran "Solde de l'employé" appelle SoldeCongeRepository.GetByEmpCalculatedAsync.
        // Ce repo NE LIT PAS la table solde directement : il appelle les 2 services
        // de calcul. Cohérence end-to-end vérifiée ici.
        var mockCnj = new Mock<ICongeCalculationService>();
        var mockRtt = new Mock<ABRPOINT.Server.CalculService.Rtt.IRttCalculationService>();
        mockCnj.Setup(x => x.GetEmpEtatCongeAsync(Soc, Emp, "01", It.IsAny<string>(), It.IsAny<string>()))
               .ReturnsAsync(new ABRPOINT.Server.Dtaos.EmpEtatConge(2.5, 8, 32, 17));
        mockRtt.Setup(x => x.GetRttSoldeAsync(Soc, Emp))
               .ReturnsAsync(new ABRPOINT.Server.CalculService.Rtt.RttSoldeDto
               {
                   DroitAnnuel = 11f, Pris = 4f, Methode = "J",
               });

        await using var db = NewContext("scenario-solde-calc");
        var repo = new ABRPOINT.Server.Repository.SoldeCongeRepository(db, mockCnj.Object, mockRtt.Object);

        var solde = await repo.GetByEmpCalculatedAsync(Soc, Emp);

        solde!.Conge.Should().Be(32f);
        solde.Empconge.Should().Be(17f);
        solde.RttJours.Should().Be(11f);
        solde.RttUtilises.Should().Be(4f);
    }
}
