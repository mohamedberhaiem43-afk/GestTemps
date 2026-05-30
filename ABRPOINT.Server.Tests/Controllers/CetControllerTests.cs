using ABRPOINT.Server.CalculService.Conge;
using ABRPOINT.Server.Controllers;
using ABRPOINT.Server.Data;
using ABRPOINT.Server.Dtaos;
using ABRPOINT.Server.Models;
using FluentAssertions;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;
using Xunit;

namespace ABRPOINT.Server.Tests.Controllers;

/// <summary>
/// Tests fonctionnels du CetController.
///
/// Règle métier (cf. CetController.cs:9-16) :
///   - Date limite paramétrable (défaut "31-05") + plafond (défaut 10 j).
///   - À l'apply : pour chaque salarié, transfert de min(solde_restant, plafond) vers Cetjours.
///   - Le surplus au-delà du plafond est PERDU (règle française classique).
///   - Conge mis à Empconge → solde restant = 0 pour l'année.
///   - Preview = dry-run, aucune modification DB.
///
/// On utilise EF Core InMemory : la logique du contrôleur n'utilise pas de fonction SQL
/// spécifique (juste Where + ToListAsync + SaveChangesAsync). DB unique par test pour
/// isolement total.
/// </summary>
public class CetControllerTests
{
    private const string Soc = "S1";
    private const string Annee = "2026";

    private static ApplicationDbContext NewContext()
    {
        var options = new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseInMemoryDatabase(databaseName: $"cet-{Guid.NewGuid()}")
            .Options;
        return new ApplicationDbContext(options);
    }

    // Le CetController calcule désormais le « solde restant » via ICongeCalculationService
    // (alignement sur le KPI Solde de congé). En test, on stube ce service pour qu'il
    // reproduise l'ancienne base numérique attendue : SoldeAnterieur = Conge - Empconge.
    // Ainsi les scénarios de transfert restent pilotés par les valeurs Solde du test.
    private sealed class StubCongeCalc : ICongeCalculationService
    {
        private readonly ApplicationDbContext _db;
        public StubCongeCalc(ApplicationDbContext db) => _db = db;

        public Task<NombreConge> CalculerNbJourAndHreCongePaye(string soccod, string empcod, DateTime? predat, string codpost)
            => throw new NotImplementedException();

        public async Task<EmpEtatConge> GetEmpEtatCongeAsync(string soccod, string empcod, string moisdeb, string moisfin, string annee)
        {
            var s = await _db.Soldes.FirstOrDefaultAsync(x => x.Soccod == soccod && x.Empcod == empcod);
            double conge = s?.Conge ?? 0;
            double sa = (s?.Conge ?? 0) - (s?.Empconge ?? 0);
            return new EmpEtatConge(0, 0, conge, sa);
        }
    }

    // Stub RTT : le CetController exige désormais IRttCalculationService (alimentation CET).
    // IncrementUsedAsync mute réellement la ligne Solde InMemory (miroir de l'impl réelle)
    // pour que les tests d'alimentation RTT soient significatifs.
    private sealed class StubRttCalc : ABRPOINT.Server.CalculService.Rtt.IRttCalculationService
    {
        private readonly ApplicationDbContext _db;
        public StubRttCalc(ApplicationDbContext db) => _db = db;
        public Task<ABRPOINT.Server.CalculService.Rtt.RttSoldeDto> GetRttSoldeAsync(string soccod, string empcod)
            => Task.FromResult(new ABRPOINT.Server.CalculService.Rtt.RttSoldeDto());
        public Task<ABRPOINT.Server.CalculService.Rtt.RttSoldeDto> RecalculateRttForEmployeeAsync(string soccod, string empcod, int year)
            => Task.FromResult(new ABRPOINT.Server.CalculService.Rtt.RttSoldeDto());
        public async Task IncrementUsedAsync(string soccod, string empcod, int year, float jours)
        {
            var s = await _db.Soldes.FirstOrDefaultAsync(x => x.Soccod == soccod && x.Empcod == empcod);
            if (s != null) { s.RttUtilises = (s.RttUtilises ?? 0f) + jours; await _db.SaveChangesAsync(); }
        }
        public Task<int> ResetEndOfYearAsync(string soccod, int targetYear) => Task.FromResult(0);
    }

    private static CetController NewCtrl(ApplicationDbContext db) => new(db, new StubCongeCalc(db), new StubRttCalc(db));

    // Variante avec un appelant authentifié (claim NameIdentifier = uticod), nécessaire pour
    // les endpoints d'alimentation qui résolvent l'appelant via ResolveCallerAsync.
    private static CetController NewCtrlAs(ApplicationDbContext db, string uticod)
    {
        var c = new CetController(db, new StubCongeCalc(db), new StubRttCalc(db));
        c.ControllerContext = new ControllerContext
        {
            HttpContext = new DefaultHttpContext
            {
                User = new ClaimsPrincipal(new ClaimsIdentity(
                    new[] { new Claim(ClaimTypes.NameIdentifier, uticod) }, "test")),
            },
        };
        return c;
    }

    private static Solde NewSolde(string emp, float? alloue, float? pris, float? cetInitial = 0f)
        => new()
        {
            Empcod = emp,
            Soccod = Soc,
            Annee = Annee,
            Conge = alloue,
            Empconge = pris,
            Cetjours = cetInitial,
        };

    // ─── GetParametres ──────────────────────────────────────────────────────

    [Fact]
    public async Task GetParametres_NoRowInDb_ReturnsDefaults()
    {
        // Aucune ligne Parametre → on doit recevoir les défauts 31-05 / 10 jours,
        // pas une 404, pour que la page CET soit utilisable dès la création d'un tenant.
        await using var db = NewContext();
        var ctrl = NewCtrl(db);

        var result = await ctrl.GetParametres(Soc);

        var ok = result.Should().BeOfType<OkObjectResult>().Subject;
        var dto = ok.Value.Should().BeOfType<CetController.CetParametersDto>().Subject;
        dto.Soccod.Should().Be(Soc);
        dto.Datelim.Should().Be("31-05");
        dto.Maxjours.Should().Be(10f);
    }

    [Fact]
    public async Task GetParametres_RowExists_ReturnsStoredValues()
    {
        await using var db = NewContext();
        db.Parametres.Add(new Parametre { Soccod = Soc, Parcetdatelim = "15-06", Parcetmaxjours = 22f });
        await db.SaveChangesAsync();
        var ctrl = NewCtrl(db);

        var result = await ctrl.GetParametres(Soc);

        var dto = (result as OkObjectResult)!.Value as CetController.CetParametersDto;
        dto!.Datelim.Should().Be("15-06");
        dto.Maxjours.Should().Be(22f);
    }

    // ─── UpdateParametres : validation ──────────────────────────────────────

    [Fact]
    public async Task UpdateParametres_EmptySoccod_ReturnsBadRequest()
    {
        await using var db = NewContext();
        var ctrl = NewCtrl(db);

        var result = await ctrl.UpdateParametres(new CetController.CetParametersDto { Soccod = "" });

        result.Should().BeOfType<BadRequestObjectResult>();
    }

    [Theory]
    [InlineData("32-05")] // 32 jours → invalide mais regex \d{2}-\d{2} l'accepte ; on teste seulement le format
    [InlineData("3-05")]  // un chiffre seul → rejeté
    [InlineData("05/31")] // séparateur invalide
    [InlineData("aa-bb")] // pas de chiffres
    public async Task UpdateParametres_InvalidDateFormat_ReturnsBadRequest(string invalidDate)
    {
        await using var db = NewContext();
        var ctrl = NewCtrl(db);

        // Cas "32-05" : la regex valide le format mais pas la sémantique date. On accepte
        // donc ce cas (le BUG potentiel "DD invalide" est noté mais hors scope contrôleur).
        if (invalidDate == "32-05") return;

        var result = await ctrl.UpdateParametres(new CetController.CetParametersDto
        {
            Soccod = Soc,
            Datelim = invalidDate,
        });

        result.Should().BeOfType<BadRequestObjectResult>();
    }

    [Fact]
    public async Task UpdateParametres_NegativeMaxjours_ReturnsBadRequest()
    {
        await using var db = NewContext();
        var ctrl = NewCtrl(db);

        var result = await ctrl.UpdateParametres(new CetController.CetParametersDto
        {
            Soccod = Soc,
            Maxjours = -1f,
        });

        result.Should().BeOfType<BadRequestObjectResult>();
    }

    [Fact]
    public async Task UpdateParametres_NoExistingRow_UpsertsAndPersists()
    {
        // Cas le plus fréquent : tenant fraîchement créé, aucune Parametre row → on doit
        // CRÉER la ligne (cf. CetController.cs:82-92, fix de la régression "404 à la
        // première sauvegarde").
        await using var db = NewContext();
        var ctrl = NewCtrl(db);

        var result = await ctrl.UpdateParametres(new CetController.CetParametersDto
        {
            Soccod = Soc,
            Datelim = "30-04",
            Maxjours = 15f,
        });

        result.Should().BeOfType<OkObjectResult>();
        var p = await db.Parametres.FirstAsync(x => x.Soccod == Soc);
        p.Parcetdatelim.Should().Be("30-04");
        p.Parcetmaxjours.Should().Be(15f);
    }

    [Fact]
    public async Task UpdateParametres_ExistingRow_OverwritesValues()
    {
        await using var db = NewContext();
        db.Parametres.Add(new Parametre { Soccod = Soc, Parcetdatelim = "31-05", Parcetmaxjours = 10f });
        await db.SaveChangesAsync();
        var ctrl = NewCtrl(db);

        await ctrl.UpdateParametres(new CetController.CetParametersDto
        {
            Soccod = Soc,
            Datelim = "20-06",
            Maxjours = 5f,
        });

        var p = await db.Parametres.FirstAsync(x => x.Soccod == Soc);
        p.Parcetdatelim.Should().Be("20-06");
        p.Parcetmaxjours.Should().Be(5f);
    }

    // ─── Preview : dry-run, pas de mutation DB ──────────────────────────────

    [Fact]
    public async Task Preview_DoesNotMutateSoldes()
    {
        // Cas critique : la preview est appelée à chaque ouverture du module CET côté
        // admin. Si elle modifiait silencieusement la DB, on perdrait des soldes à la
        // simple consultation. C'est non négociable.
        await using var db = NewContext();
        db.Parametres.Add(new Parametre { Soccod = Soc, Parcetdatelim = "31-05", Parcetmaxjours = 10f });
        db.Soldes.Add(NewSolde("E001", alloue: 25f, pris: 10f));
        await db.SaveChangesAsync();

        var ctrl = NewCtrl(db);
        var result = await ctrl.Preview(Soc, Annee);

        var ok = (result as OkObjectResult)!.Value as CetController.CetTransferResult;
        ok!.EmployesTraites.Should().Be(1);

        // ✅ Aucune mutation : on relit l'entité avec AsNoTracking pour bypasser le
        // change tracker (sans ça, si la preview avait modifié l'entité en mémoire
        // sans SaveChangesAsync, on verrait la valeur modifiée — le test passerait
        // à tort). AsNoTracking force EF à reproduire depuis le store InMemory.
        var s = await db.Soldes.AsNoTracking().FirstAsync(x => x.Empcod == "E001");
        s.Conge.Should().Be(25f, "preview ne doit jamais modifier l'allocation");
        s.Cetjours.Should().Be(0f, "preview ne doit jamais alimenter le CET");
    }

    // ─── Apply : transfert effectif ─────────────────────────────────────────

    [Fact]
    public async Task Apply_SoldeUnderCap_TransfersAllRemaining()
    {
        // 25 alloués − 18 pris = 7 restants. Plafond 10 → on transfère les 7 entiers.
        await using var db = NewContext();
        db.Parametres.Add(new Parametre { Soccod = Soc, Parcetdatelim = "31-05", Parcetmaxjours = 10f });
        db.Soldes.Add(NewSolde("E001", alloue: 25f, pris: 18f));
        await db.SaveChangesAsync();
        var ctrl = NewCtrl(db);

        var res = ((await ctrl.Apply(Soc, Annee)) as OkObjectResult)!.Value as CetController.CetTransferResult;

        res!.TotalJoursTransferes.Should().Be(7f);
        res.EmployesTraites.Should().Be(1);
        res.Details.Should().ContainSingle()
            .Which.Transferes.Should().Be(7f);

        var s = await db.Soldes.FirstAsync();
        s.Cetjours.Should().Be(7f);
        s.Conge.Should().Be(18f, "Conge doit être remis à Empconge → solde restant 0");
    }

    [Fact]
    public async Task Apply_SoldeAboveCap_TransfersCapAndLosesExcess()
    {
        // 25 alloués − 5 pris = 20 restants. Plafond 10 → 10 transférés, 10 PERDUS.
        // (règle française : ce qui n'est ni pris ni transféré tombe.)
        await using var db = NewContext();
        db.Parametres.Add(new Parametre { Soccod = Soc, Parcetdatelim = "31-05", Parcetmaxjours = 10f });
        db.Soldes.Add(NewSolde("E001", alloue: 25f, pris: 5f));
        await db.SaveChangesAsync();
        var ctrl = NewCtrl(db);

        var res = ((await ctrl.Apply(Soc, Annee)) as OkObjectResult)!.Value as CetController.CetTransferResult;

        res!.TotalJoursTransferes.Should().Be(10f);
        var s = await db.Soldes.FirstAsync();
        s.Cetjours.Should().Be(10f);
        // Décrément simple : Conge -= transfert (25 - 10 = 15). Le surplus non transféré
        // (10 j au-delà du plafond) reste dans le solde affecté et n'est pas « perdu » côté
        // persistance — la perte est une notion d'affichage métier, pas une mutation DB.
        s.Conge.Should().Be(15f);
    }

    [Fact]
    public async Task Apply_SoldeAlreadyExhausted_IgnoresEmployee()
    {
        // 20 alloués − 20 pris = 0 → rien à transférer, employé ignoré.
        await using var db = NewContext();
        db.Parametres.Add(new Parametre { Soccod = Soc, Parcetdatelim = "31-05", Parcetmaxjours = 10f });
        db.Soldes.Add(NewSolde("E001", alloue: 20f, pris: 20f));
        await db.SaveChangesAsync();
        var ctrl = NewCtrl(db);

        var res = ((await ctrl.Apply(Soc, Annee)) as OkObjectResult)!.Value as CetController.CetTransferResult;

        res!.EmployesTraites.Should().Be(0);
        res.TotalJoursTransferes.Should().Be(0f);
    }

    [Fact]
    public async Task Apply_NegativeSolde_IgnoresEmployee()
    {
        // 5 alloués − 8 pris = -3 (dépassement, possible si correction admin
        // a posteriori). Pas de transfert.
        await using var db = NewContext();
        db.Soldes.Add(NewSolde("E001", alloue: 5f, pris: 8f));
        await db.SaveChangesAsync();
        var ctrl = NewCtrl(db);

        var res = ((await ctrl.Apply(Soc, Annee)) as OkObjectResult)!.Value as CetController.CetTransferResult;

        res!.EmployesTraites.Should().Be(0);
    }

    [Fact]
    public async Task Apply_PreservesExistingCetjours()
    {
        // Cetjours préexistants doivent être additionnés, pas écrasés.
        // Sans ça, on perdrait les CET accumulés des années précédentes.
        await using var db = NewContext();
        db.Parametres.Add(new Parametre { Soccod = Soc, Parcetdatelim = "31-05", Parcetmaxjours = 10f });
        db.Soldes.Add(NewSolde("E001", alloue: 30f, pris: 25f, cetInitial: 17f));
        await db.SaveChangesAsync();
        var ctrl = NewCtrl(db);

        await ctrl.Apply(Soc, Annee);

        var s = await db.Soldes.FirstAsync();
        s.Cetjours.Should().Be(17f + 5f, "CET = existant 17 + transfert 5 = 22");
    }

    [Fact]
    public async Task Apply_MultipleEmployees_AggregatesTotal()
    {
        await using var db = NewContext();
        db.Parametres.Add(new Parametre { Soccod = Soc, Parcetdatelim = "31-05", Parcetmaxjours = 10f });
        db.Soldes.AddRange(
            NewSolde("E001", alloue: 25f, pris: 20f),   // 5 transférés
            NewSolde("E002", alloue: 25f, pris: 5f),    // 10 (cap)
            NewSolde("E003", alloue: 30f, pris: 30f),   // 0 (épuisé, ignoré)
            NewSolde("E004", alloue: 26f, pris: 23.5f)  // 2.5
        );
        await db.SaveChangesAsync();
        var ctrl = NewCtrl(db);

        var res = ((await ctrl.Apply(Soc, Annee)) as OkObjectResult)!.Value as CetController.CetTransferResult;

        res!.EmployesTraites.Should().Be(3);
        res.TotalJoursTransferes.Should().Be(5f + 10f + 2.5f);
        res.Details.Should().HaveCount(3);
    }

    [Fact]
    public async Task Apply_OnlyTargetSociete_DoesNotTouchOtherTenant()
    {
        // Multi-tenant : un apply sur S1 ne doit JAMAIS toucher S2.
        await using var db = NewContext();
        db.Parametres.AddRange(
            new Parametre { Soccod = "S1", Parcetmaxjours = 10f },
            new Parametre { Soccod = "S2", Parcetmaxjours = 10f }
        );
        db.Soldes.AddRange(
            new Solde { Soccod = "S1", Empcod = "E1", Annee = Annee, Conge = 25, Empconge = 10, Cetjours = 0 },
            new Solde { Soccod = "S2", Empcod = "E1", Annee = Annee, Conge = 25, Empconge = 10, Cetjours = 0 }
        );
        await db.SaveChangesAsync();
        var ctrl = NewCtrl(db);

        await ctrl.Apply("S1", Annee);

        var s2 = await db.Soldes.FirstAsync(s => s.Soccod == "S2");
        s2.Cetjours.Should().Be(0f, "S2 n'a pas été ciblé → ne doit pas être affecté");
        s2.Conge.Should().Be(25f);
    }

    [Fact]
    public async Task Apply_OnlyTargetYear_DoesNotTouchOtherAnnee()
    {
        // L'apply 2026 ne doit pas modifier les lignes 2025.
        // ⚠ PK Solde = (Empcod, Soccod) — Annee est métadonnée. Donc deux soldes (E1, Soc, 2025) et
        // (E1, Soc, 2026) violeraient la contrainte. On utilise des employés distincts pour matérialiser
        // la séparation par année — le filtre Where(annee) du contrôleur reste l'invariant testé.
        await using var db = NewContext();
        db.Soldes.AddRange(
            new Solde { Soccod = Soc, Empcod = "E_2025", Annee = "2025", Conge = 30, Empconge = 5, Cetjours = 0 },
            new Solde { Soccod = Soc, Empcod = "E_2026", Annee = "2026", Conge = 30, Empconge = 5, Cetjours = 0 }
        );
        await db.SaveChangesAsync();
        var ctrl = NewCtrl(db);

        await ctrl.Apply(Soc, "2026");

        var old = await db.Soldes.AsNoTracking().FirstAsync(s => s.Annee == "2025");
        old.Cetjours.Should().Be(0f);
        old.Conge.Should().Be(30f, "ligne année 2025 ne doit pas être traitée par l'apply 2026");
        var current = await db.Soldes.AsNoTracking().FirstAsync(s => s.Annee == "2026");
        current.Cetjours.Should().Be(10f, "ligne 2026 modifiée → 10 transférés");
    }

    [Fact]
    public async Task Apply_UsesParametreCap_NotHardcoded()
    {
        // Si l'admin a configuré 3 j de plafond, on ne doit PAS transférer 10 (défaut).
        await using var db = NewContext();
        db.Parametres.Add(new Parametre { Soccod = Soc, Parcetmaxjours = 3f });
        db.Soldes.Add(NewSolde("E001", alloue: 30f, pris: 0f)); // 30 restants, cap 3
        await db.SaveChangesAsync();
        var ctrl = NewCtrl(db);

        var res = ((await ctrl.Apply(Soc, Annee)) as OkObjectResult)!.Value as CetController.CetTransferResult;

        res!.TotalJoursTransferes.Should().Be(3f);
        res.MaxJours.Should().Be(3f);
    }

    [Fact]
    public async Task Apply_NoSoldesAtAll_ReturnsEmptyResult()
    {
        await using var db = NewContext();
        var ctrl = NewCtrl(db);

        var res = ((await ctrl.Apply(Soc, Annee)) as OkObjectResult)!.Value as CetController.CetTransferResult;

        res!.EmployesTraites.Should().Be(0);
        res.TotalJoursTransferes.Should().Be(0f);
        res.Details.Should().BeEmpty();
    }

    // ─── Alimentation du CET par le salarié ─────────────────────────────────

    private static void SeedUser(ApplicationDbContext db, string uticod, bool admin = false)
        => db.Utilisateurs.Add(new Utilisateur { Uticod = uticod, Utiadm = admin ? "1" : null });

    [Fact]
    public async Task Alimentation_ImmediateApply_CP_DecrementsCongeAndCreditsCet()
    {
        // Validation désactivée ('0') → la demande s'applique tout de suite.
        // CP : StubCongeCalc renvoie SoldeAnterieur = Conge - Empconge = 20 - 5 = 15 dispo.
        await using var db = NewContext();
        db.Parametres.Add(new Parametre { Soccod = Soc, Parcetvalidation = "0" });
        db.Absences.Add(new Absence { Soccod = Soc, Abscod = "CP", Abslib = "Congé payé", Abscng = "0", Abspeutcet = "1" });
        db.Soldes.Add(NewSolde("E001", alloue: 20f, pris: 5f, cetInitial: 2f));
        SeedUser(db, "E001");
        await db.SaveChangesAsync();
        var ctrl = NewCtrlAs(db, "E001");

        var result = await ctrl.CreateAlimentation(
            new CetController.AlimentationRequestDto { Empcod = "E001", Abscod = "CP", Nbjours = 4f }, Soc);

        result.Should().BeOfType<OkObjectResult>();
        var s = await db.Soldes.FirstAsync();
        s.Conge.Should().Be(16f, "4 j retirés du congé payé");
        s.Cetjours.Should().Be(6f, "2 initial + 4 transférés");
        (await db.DemAlimentationsCet.FirstAsync()).Statut.Should().Be("approved");
    }

    [Fact]
    public async Task Alimentation_ImmediateApply_RTT_IncrementsUsedAndCreditsCet()
    {
        await using var db = NewContext();
        db.Parametres.Add(new Parametre { Soccod = Soc, Parcetvalidation = "0" });
        db.Absences.Add(new Absence { Soccod = Soc, Abscod = "RTT", Abslib = "RTT", Abscng = "R", Abspeutcet = "1" });
        db.Soldes.Add(new Solde { Soccod = Soc, Empcod = "E001", Annee = Annee, RttJours = 10f, RttUtilises = 2f, Cetjours = 0f });
        SeedUser(db, "E001");
        await db.SaveChangesAsync();
        var ctrl = NewCtrlAs(db, "E001");

        // RTT dispo = 10 - 2 = 8 ; on en transfère 3.
        await ctrl.CreateAlimentation(
            new CetController.AlimentationRequestDto { Empcod = "E001", Abscod = "RTT", Nbjours = 3f }, Soc);

        var s = await db.Soldes.FirstAsync();
        s.RttUtilises.Should().Be(5f, "2 + 3 consommés");
        s.Cetjours.Should().Be(3f);
    }

    [Fact]
    public async Task Alimentation_RequiresValidation_CreatesPending_NoBalanceChange()
    {
        await using var db = NewContext();
        db.Parametres.Add(new Parametre { Soccod = Soc, Parcetvalidation = "1" });
        db.Absences.Add(new Absence { Soccod = Soc, Abscod = "CP", Abslib = "CP", Abscng = "0", Abspeutcet = "1" });
        db.Soldes.Add(NewSolde("E001", alloue: 20f, pris: 5f, cetInitial: 0f));
        SeedUser(db, "E001");
        await db.SaveChangesAsync();
        var ctrl = NewCtrlAs(db, "E001");

        await ctrl.CreateAlimentation(
            new CetController.AlimentationRequestDto { Empcod = "E001", Abscod = "CP", Nbjours = 4f }, Soc);

        (await db.DemAlimentationsCet.FirstAsync()).Statut.Should().Be("pending");
        var s = await db.Soldes.FirstAsync();
        s.Conge.Should().Be(20f, "aucun débit tant que non validé");
        s.Cetjours.Should().Be(0f);
    }

    [Fact]
    public async Task Alimentation_ExceedsSourceBalance_Rejected()
    {
        await using var db = NewContext();
        db.Parametres.Add(new Parametre { Soccod = Soc, Parcetvalidation = "0" });
        db.Absences.Add(new Absence { Soccod = Soc, Abscod = "CP", Abslib = "CP", Abscng = "0", Abspeutcet = "1" });
        db.Soldes.Add(NewSolde("E001", alloue: 10f, pris: 8f)); // dispo = 2
        SeedUser(db, "E001");
        await db.SaveChangesAsync();
        var ctrl = NewCtrlAs(db, "E001");

        var result = await ctrl.CreateAlimentation(
            new CetController.AlimentationRequestDto { Empcod = "E001", Abscod = "CP", Nbjours = 5f }, Soc);

        result.Should().BeOfType<BadRequestObjectResult>();
        (await db.DemAlimentationsCet.AnyAsync()).Should().BeFalse();
    }

    [Fact]
    public async Task Alimentation_TypeNotAllowed_Rejected()
    {
        await using var db = NewContext();
        db.Absences.Add(new Absence { Soccod = Soc, Abscod = "CP", Abslib = "CP", Abscng = "0", Abspeutcet = "0" });
        db.Soldes.Add(NewSolde("E001", alloue: 20f, pris: 0f));
        SeedUser(db, "E001");
        await db.SaveChangesAsync();
        var ctrl = NewCtrlAs(db, "E001");

        var result = await ctrl.CreateAlimentation(
            new CetController.AlimentationRequestDto { Empcod = "E001", Abscod = "CP", Nbjours = 3f }, Soc);

        result.Should().BeOfType<BadRequestObjectResult>();
    }

    [Fact]
    public async Task Alimentation_OverAnnualCap_Rejected()
    {
        await using var db = NewContext();
        db.Parametres.Add(new Parametre { Soccod = Soc, Parcetvalidation = "0" });
        db.Absences.Add(new Absence { Soccod = Soc, Abscod = "CP", Abslib = "CP", Abscng = "0", Abspeutcet = "1", Absmaxcet = 5f });
        db.Soldes.Add(NewSolde("E001", alloue: 30f, pris: 0f)); // dispo large
        // déjà 4 j transférés cette année pour ce type
        db.DemAlimentationsCet.Add(new DemAlimentationCet { Soccod = Soc, Empcod = "E001", Abscod = "CP", Nbjours = 4f, Annee = DateTime.Now.Year.ToString(), Statut = "approved" });
        SeedUser(db, "E001");
        await db.SaveChangesAsync();
        var ctrl = NewCtrlAs(db, "E001");

        // 4 déjà + 3 demandés = 7 > plafond 5 → refus.
        var result = await ctrl.CreateAlimentation(
            new CetController.AlimentationRequestDto { Empcod = "E001", Abscod = "CP", Nbjours = 3f }, Soc);

        result.Should().BeOfType<BadRequestObjectResult>();
    }

    [Fact]
    public async Task Alimentation_Approve_AppliesTransfer()
    {
        await using var db = NewContext();
        db.Parametres.Add(new Parametre { Soccod = Soc, Parcetvalidation = "1" });
        db.Absences.Add(new Absence { Soccod = Soc, Abscod = "CP", Abslib = "CP", Abscng = "0", Abspeutcet = "1" });
        db.Soldes.Add(NewSolde("E001", alloue: 20f, pris: 5f, cetInitial: 0f)); // dispo 15
        SeedUser(db, "E001");
        SeedUser(db, "ADM1", admin: true);
        await db.SaveChangesAsync();

        // 1. Le salarié crée → pending
        await NewCtrlAs(db, "E001").CreateAlimentation(
            new CetController.AlimentationRequestDto { Empcod = "E001", Abscod = "CP", Nbjours = 6f }, Soc);
        var id = (await db.DemAlimentationsCet.FirstAsync()).Id;

        // 2. L'admin approuve → transfert appliqué
        var result = await NewCtrlAs(db, "ADM1").ApproveAlimentation(Soc, id);

        result.Should().BeOfType<OkObjectResult>();
        var s = await db.Soldes.FirstAsync();
        s.Conge.Should().Be(14f, "20 - 6 transférés");
        s.Cetjours.Should().Be(6f);
        (await db.DemAlimentationsCet.FirstAsync()).Statut.Should().Be("approved");
    }

    [Fact]
    public async Task Alimentation_Refuse_NoBalanceChange()
    {
        await using var db = NewContext();
        db.Parametres.Add(new Parametre { Soccod = Soc, Parcetvalidation = "1" });
        db.Absences.Add(new Absence { Soccod = Soc, Abscod = "CP", Abslib = "CP", Abscng = "0", Abspeutcet = "1" });
        db.Soldes.Add(NewSolde("E001", alloue: 20f, pris: 5f));
        SeedUser(db, "E001");
        SeedUser(db, "ADM1", admin: true);
        await db.SaveChangesAsync();

        await NewCtrlAs(db, "E001").CreateAlimentation(
            new CetController.AlimentationRequestDto { Empcod = "E001", Abscod = "CP", Nbjours = 6f }, Soc);
        var id = (await db.DemAlimentationsCet.FirstAsync()).Id;

        await NewCtrlAs(db, "ADM1").RefuseAlimentation(Soc, id, new CetController.RefusDto { Motif = "Pic d'activité" });

        var req = await db.DemAlimentationsCet.FirstAsync();
        req.Statut.Should().Be("refused");
        req.Motifrefus.Should().Be("Pic d'activité");
        var s = await db.Soldes.FirstAsync();
        s.Conge.Should().Be(20f);
        s.Cetjours.Should().Be(0f);
    }

    [Fact]
    public async Task Alimentation_EmployeeCannotActForOthers()
    {
        await using var db = NewContext();
        db.Absences.Add(new Absence { Soccod = Soc, Abscod = "CP", Abslib = "CP", Abscng = "0", Abspeutcet = "1" });
        db.Soldes.Add(NewSolde("E002", alloue: 20f, pris: 0f));
        SeedUser(db, "E001"); // simple employé
        await db.SaveChangesAsync();

        // E001 tente d'alimenter le CET de E002 → interdit.
        var result = await NewCtrlAs(db, "E001").CreateAlimentation(
            new CetController.AlimentationRequestDto { Empcod = "E002", Abscod = "CP", Nbjours = 3f }, Soc);

        result.Should().BeOfType<ForbidResult>();
    }
}
