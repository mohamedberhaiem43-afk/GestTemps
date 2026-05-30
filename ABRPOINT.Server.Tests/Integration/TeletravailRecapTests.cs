using System.Security.Claims;
using ABRPOINT.Server.Controllers;
using ABRPOINT.Server.Data;
using ABRPOINT.Server.Models;
using FluentAssertions;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using Xunit;

namespace ABRPOINT.Server.Tests.Integration;

/// <summary>
/// Récapitulatif paie télétravail (axes D/E) : vérifie que l'endpoint Recap
/// compte les jours OUVRÉS effectivement couverts par les demandes APPROUVÉES sur
/// la fenêtre demandée et applique l'indemnité forfaitaire société.
/// </summary>
public class TeletravailRecapTests
{
    private const string Soc = "S1";

    private static ApplicationDbContext NewContext()
        => new(new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseInMemoryDatabase($"tt-recap-{Guid.NewGuid()}").Options);

    private static TeletravailController NewCtrlAsAdmin(ApplicationDbContext db, string uticod)
    {
        var ctrl = new TeletravailController(db, NullLogger<TeletravailController>.Instance);
        var principal = new ClaimsPrincipal(new ClaimsIdentity(new[]
        {
            new Claim(ClaimTypes.NameIdentifier, uticod),
        }, "Test"));
        ctrl.ControllerContext = new ControllerContext { HttpContext = new DefaultHttpContext { User = principal } };
        return ctrl;
    }

    [Fact]
    public async Task Recap_CountsBusinessDays_AndAppliesIndemnite()
    {
        await using var db = NewContext();
        // Admin qui consulte le récap.
        db.Utilisateurs.Add(new Utilisateur { Uticod = "ADM", Utiadm = "1" });
        // Indemnité forfaitaire = 10 €/jour TT.
        db.Parametres.Add(new Parametre { Soccod = Soc, Parttindemnite = 10f });
        db.Employes.Add(new Employe { Soccod = Soc, Empcod = "E001", Sitcod = "01", Emplib = "Alice" });
        db.Employes.Add(new Employe { Soccod = Soc, Empcod = "E002", Sitcod = "01", Emplib = "Bob" });
        // 7 jours calendaires consécutifs contiennent exactement 5 jours ouvrés,
        // quel que soit le jour de départ → 5 jours TT pour Alice.
        db.Teletravails.Add(new Teletravail
        {
            Soccod = Soc, Empcod = "E001", Status = "Approved",
            StartDate = new DateTime(2026, 6, 1), EndDate = new DateTime(2026, 6, 7),
        });
        // Bob : demande encore Pending → ne doit PAS apparaître dans le récap.
        db.Teletravails.Add(new Teletravail
        {
            Soccod = Soc, Empcod = "E002", Status = "Pending",
            StartDate = new DateTime(2026, 6, 1), EndDate = new DateTime(2026, 6, 7),
        });
        await db.SaveChangesAsync();

        var ctrl = NewCtrlAsAdmin(db, "ADM");
        var res = await ctrl.Recap(Soc, "2026-06-01", "2026-06-30", default);

        var ok = res.Should().BeOfType<OkObjectResult>().Subject;
        // Anonymous DTO → on relit via reflection pour rester découplé du type interne.
        var payload = ok.Value!;
        var rowsObj = payload.GetType().GetProperty("rows")!.GetValue(payload)!;
        var rows = ((System.Collections.IEnumerable)rowsObj).Cast<object>().ToList();

        rows.Should().HaveCount(1, "seules les demandes Approved comptent");
        var row = rows[0];
        float jours = (float)row.GetType().GetProperty("JoursTeletravail")!.GetValue(row)!;
        float montant = (float)row.GetType().GetProperty("MontantIndemnite")!.GetValue(row)!;
        jours.Should().Be(5f);
        montant.Should().Be(50f);
    }

    [Fact]
    public async Task Recap_ClampsToRequestedWindow()
    {
        await using var db = NewContext();
        db.Utilisateurs.Add(new Utilisateur { Uticod = "ADM", Utiadm = "1" });
        db.Parametres.Add(new Parametre { Soccod = Soc, Parttindemnite = 0f });
        db.Employes.Add(new Employe { Soccod = Soc, Empcod = "E001", Sitcod = "01", Emplib = "Alice" });
        // Demande à cheval sur deux mois : du 29/06 au 03/07. La fenêtre demandée
        // s'arrête au 30/06 → seuls les jours ouvrés ≤ 30/06 doivent compter.
        db.Teletravails.Add(new Teletravail
        {
            Soccod = Soc, Empcod = "E001", Status = "Approved",
            StartDate = new DateTime(2026, 6, 29), EndDate = new DateTime(2026, 7, 3),
        });
        await db.SaveChangesAsync();

        var ctrl = NewCtrlAsAdmin(db, "ADM");
        var res = await ctrl.Recap(Soc, "2026-06-01", "2026-06-30", default);
        var ok = res.Should().BeOfType<OkObjectResult>().Subject;
        var payload = ok.Value!;
        var rowsObj = payload.GetType().GetProperty("rows")!.GetValue(payload)!;
        var rows = ((System.Collections.IEnumerable)rowsObj).Cast<object>().ToList();
        var row = rows.Single();
        float jours = (float)row.GetType().GetProperty("JoursTeletravail")!.GetValue(row)!;
        // 29/06 (lun) et 30/06 (mar) sont ouvrés et dans la fenêtre ; 01-03/07 hors fenêtre.
        jours.Should().Be(2f);
    }
}
