using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Xunit;
using ABRPOINT.Server.Authorization;
using ABRPOINT.Server.Data;
using ABRPOINT.Server.Helpers;
using ABRPOINT.Server.Models;

namespace ABRPOINT.Server.Tests.Authorization;

/// <summary>
/// Tests du runtime PermissionChecker (la résolution role+module→autorisation
/// qui sert toutes les routes annotées avec <c>[PermissionAttribute(...)]</c>).
///
/// Couvre :
///   • L'override « Admin » (Utiadm="1") qui by-pass la matrice — toute requête
///     d'un admin doit passer, indépendamment de la matrice RolePermissions.
///   • Le mapping code interne → libellé module (« employe » → « Gestion Employés »).
///   • Les 4 verbes CAMD (consult/add/modify/delete) résolus depuis la colonne
///     correspondante de RolePermissions.
///   • Les chemins de rejet : utilisateur inconnu, rôle vide, module sans entrée.
///
/// On utilise EF Core InMemory : pas besoin de Postgres local pour CI, et la
/// surface testée n'utilise pas de fonctions SQL spécifiques (juste Where + Include).
/// Chaque test crée son propre contexte (DbName unique) pour éviter les contaminations.
/// </summary>
public class PermissionCheckerTests
{
    private static ApplicationDbContext NewContext()
    {
        // DbName unique par test : sans ça, deux tests parallèles partageraient l'état
        // (InMemory est process-wide quand le nom est identique).
        var options = new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseInMemoryDatabase(databaseName: $"perm-check-{Guid.NewGuid()}")
            .Options;
        return new ApplicationDbContext(options);
    }

    private static async Task SeedRoleWithPermissionAsync(
        ApplicationDbContext db,
        string roleName,
        string moduleLabel,
        string consult = "0", string add = "0", string modify = "0", string delete = "0")
    {
        var role = new Role { RoleName = roleName };
        db.Roles.Add(role);
        await db.SaveChangesAsync();
        db.RolePermissions.Add(new RolePermission
        {
            RpRoleId = role.RoleId,
            Role = role,
            RpModule = moduleLabel,
            RpConsult = consult,
            RpAdd = add,
            RpModify = modify,
            RpDelete = delete,
        });
        await db.SaveChangesAsync();
    }

    private static async Task SeedUserAsync(
        ApplicationDbContext db,
        string uticod,
        string? role = null,
        string utiadm = "0")
    {
        db.Utilisateurs.Add(new Utilisateur
        {
            Uticod = uticod,
            Utirole = role,
            Utiadm = utiadm,
        });
        await db.SaveChangesAsync();
    }

    // ─── Garde-fous entrée ──────────────────────────────────────────────────

    [Fact]
    public async Task HasPermissionAsync_EmptyUticod_ReturnsFalse()
    {
        await using var db = NewContext();
        var result = await PermissionChecker.HasPermissionAsync(db, string.Empty, "employe", "Consult");
        result.Should().BeFalse();
    }

    [Fact]
    public async Task HasPermissionAsync_UnknownUser_ReturnsFalse()
    {
        await using var db = NewContext();
        var result = await PermissionChecker.HasPermissionAsync(db, "DOES_NOT_EXIST", "employe", "Consult");
        result.Should().BeFalse();
    }

    [Fact]
    public async Task HasPermissionAsync_UserWithNoRole_ReturnsFalse()
    {
        // Tenant nouvellement provisionné : un utilisateur peut exister avant
        // qu'un rôle ne lui soit assigné. On doit refuser, pas planter.
        await using var db = NewContext();
        await SeedUserAsync(db, "U001", role: null);
        var result = await PermissionChecker.HasPermissionAsync(db, "U001", "employe", "Consult");
        result.Should().BeFalse();
    }

    // ─── Bypass admin ───────────────────────────────────────────────────────

    [Fact]
    public async Task HasPermissionAsync_AdminFlag_BypassesMatrix_EvenWithoutRolePermissionRows()
    {
        // Garantie critique : un Utiadm="1" doit pouvoir tout faire, MÊME si aucune
        // ligne n'existe dans RolePermissions (par exemple sur un tenant fraîchement
        // migré, avant le seed). Sans ce bypass, l'admin se retrouve verrouillé.
        await using var db = NewContext();
        await SeedUserAsync(db, "ADMIN", role: PermissionCatalog.Roles.Administrator, utiadm: "1");

        var consult = await PermissionChecker.HasPermissionAsync(db, "ADMIN", "employe", "Consult");
        var add = await PermissionChecker.HasPermissionAsync(db, "ADMIN", "employe", "Add");
        var modify = await PermissionChecker.HasPermissionAsync(db, "ADMIN", "employe", "Modify");
        var delete = await PermissionChecker.HasPermissionAsync(db, "ADMIN", "employe", "Delete");

        consult.Should().BeTrue();
        add.Should().BeTrue();
        modify.Should().BeTrue();
        delete.Should().BeTrue();
    }

    // ─── Vérité de la matrice CAMD ──────────────────────────────────────────

    [Theory]
    [InlineData("Consult", true)]
    [InlineData("Add", false)]
    [InlineData("Modify", false)]
    [InlineData("Delete", false)]
    public async Task HasPermissionAsync_GranularBitOnly_GrantsTheMatchingAction(
        string action, bool expected)
    {
        // Profil testé : RpConsult="1" seulement → on doit avoir TRUE sur Consult
        // et FALSE sur les 3 autres.
        await using var db = NewContext();
        await SeedRoleWithPermissionAsync(db, "ReadOnly", PermissionCatalog.Modules.GestionEmployes,
            consult: "1");
        await SeedUserAsync(db, "U001", role: "ReadOnly");

        var result = await PermissionChecker.HasPermissionAsync(db, "U001", "employe", action);
        result.Should().Be(expected);
    }

    [Fact]
    public async Task HasPermissionAsync_FullCrudRole_AllowsAllFourActions()
    {
        await using var db = NewContext();
        await SeedRoleWithPermissionAsync(db, "FullCrud", PermissionCatalog.Modules.GestionEmployes,
            consult: "1", add: "1", modify: "1", delete: "1");
        await SeedUserAsync(db, "U001", role: "FullCrud");

        (await PermissionChecker.HasPermissionAsync(db, "U001", "employe", "Consult")).Should().BeTrue();
        (await PermissionChecker.HasPermissionAsync(db, "U001", "employe", "Add")).Should().BeTrue();
        (await PermissionChecker.HasPermissionAsync(db, "U001", "employe", "Modify")).Should().BeTrue();
        (await PermissionChecker.HasPermissionAsync(db, "U001", "employe", "Delete")).Should().BeTrue();
    }

    [Fact]
    public async Task HasPermissionAsync_ActionCheck_IsCaseInsensitive()
    {
        // Le checker utilise action.ToLower() en interne — on s'assure que les
        // contrôleurs peuvent passer "Add", "ADD" ou "add" sans surprise.
        await using var db = NewContext();
        await SeedRoleWithPermissionAsync(db, "AddOnly", PermissionCatalog.Modules.GestionEmployes,
            add: "1");
        await SeedUserAsync(db, "U001", role: "AddOnly");

        (await PermissionChecker.HasPermissionAsync(db, "U001", "employe", "Add")).Should().BeTrue();
        (await PermissionChecker.HasPermissionAsync(db, "U001", "employe", "ADD")).Should().BeTrue();
        (await PermissionChecker.HasPermissionAsync(db, "U001", "employe", "add")).Should().BeTrue();
    }

    [Fact]
    public async Task HasPermissionAsync_UnknownAction_ReturnsFalse()
    {
        // Sécurité par défaut : tout verbe inconnu (ex: faute de frappe « Approve »)
        // doit être refusé sans rien laisser passer.
        await using var db = NewContext();
        await SeedRoleWithPermissionAsync(db, "FullCrud", PermissionCatalog.Modules.GestionEmployes,
            consult: "1", add: "1", modify: "1", delete: "1");
        await SeedUserAsync(db, "U001", role: "FullCrud");

        var result = await PermissionChecker.HasPermissionAsync(db, "U001", "employe", "Approve");
        result.Should().BeFalse();
    }

    // ─── Mapping code interne → libellé module ──────────────────────────────

    [Theory]
    [InlineData("employe", "Gestion Employés")]
    [InlineData("emp_allait", "Gestion Employés")]
    [InlineData("absence", "Absences et Sanctions")]
    [InlineData("pointeuse", "Pointage et Temps")]
    [InlineData("contrat", "Contrats et Avenants")]
    [InlineData("conge", "Gestion des Congés")]
    [InlineData("paie", "Paie et Rémunération")]
    [InlineData("base", "Données de Base")]
    [InlineData("param", "Paramètres de Temps")]
    [InlineData("rapport", "Rapports et Statistiques")]
    [InlineData("admin", "Administration")]
    public async Task HasPermissionAsync_CodeIsMappedToCorrectModuleLabel(
        string code, string expectedModuleLabel)
    {
        // On crée la permission sous le LIBELLÉ canonique (côté DB) et on requête
        // avec le CODE INTERNE utilisé par les attributs custom (« employe »,
        // « base », etc.). Si le mapping casse, le test échoue.
        await using var db = NewContext();
        await SeedRoleWithPermissionAsync(db, "ConsultOnly", expectedModuleLabel, consult: "1");
        await SeedUserAsync(db, "U001", role: "ConsultOnly");

        var result = await PermissionChecker.HasPermissionAsync(db, "U001", code, "Consult");
        result.Should().BeTrue($"code « {code} » doit être mappé vers « {expectedModuleLabel} »");
    }

    [Fact]
    public async Task HasPermissionAsync_NoMatrixForModule_ReturnsFalse()
    {
        // Le rôle existe mais n'a aucune ligne pour le module demandé : refus par
        // défaut (sécurité « default-deny »).
        await using var db = NewContext();
        await SeedRoleWithPermissionAsync(db, "Limited", PermissionCatalog.Modules.PointageTemps,
            consult: "1");
        await SeedUserAsync(db, "U001", role: "Limited");

        // Le rôle « Limited » n'a aucune entrée pour « Gestion Employés ».
        var result = await PermissionChecker.HasPermissionAsync(db, "U001", "employe", "Consult");
        result.Should().BeFalse();
    }
}
