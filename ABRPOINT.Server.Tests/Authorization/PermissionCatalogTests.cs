using FluentAssertions;
using Xunit;
using ABRPOINT.Server.Authorization;

namespace ABRPOINT.Server.Tests.Authorization;

/// <summary>
/// Tests du catalogue statique des rôles + permissions. Pas de DB ni mock requis :
/// on valide uniquement que :
///   • la liste des modules est exhaustive et stable (toute évolution doit être
///     consciente — un test cassé force la mise à jour du provisioning et du frontend),
///   • les 4 rôles système (<see cref="PermissionCatalog.Roles"/>) existent dans
///     <see cref="PermissionCatalog.SystemRoles"/> avec une matrice couvrant
///     l'intégralité des modules,
///   • la matrice « CAMD » (4 caractères '1'/'0') respecte la convention
///     Consult/Add/Modify/Delete documentée dans le record SystemRoleSpec,
///   • les invariants commerciaux clés ne dérivent pas silencieusement
///     (ex: Administrator a TOUT, Employee n'a aucun droit Admin module).
///
/// Garde-fou contre les régressions qui changeraient discrètement les droits
/// après un refactor sans mettre à jour le seed / le frontend en miroir.
/// </summary>
public class PermissionCatalogTests
{
    // ─── Modules ────────────────────────────────────────────────────────────

    [Fact]
    public void Modules_All_ContainsExactlyTheExpectedLabels()
    {
        // On vérifie le set complet plutôt que la longueur seule : un futur refactor
        // qui renommerait un module sans toucher au compte total resterait silencieux.
        // 2026-05-31 : ajout de « Note de Frais » et « Demande de Congé » (alignement avec
        // l'écran Droit d'accès côté front + contrôle backend).
        PermissionCatalog.Modules.All.Should().BeEquivalentTo(new[]
        {
            "Absences et Sanctions",
            "Pointage et Temps",
            "Gestion Employés",
            "Contrats et Avenants",
            "Paie et Rémunération",
            "Note de Frais",
            "Demande de Congé",
            "Gestion des Congés",
            "Données de Base",
            "Paramètres de Temps",
            "Rapports et Statistiques",
            "Administration",
        });
    }

    [Fact]
    public void Modules_All_HasNoDuplicates()
    {
        // Doublon = surface d'erreur (matrice de rôle qui appliquerait 2x la même
        // ligne, désynchro avec /Utilisateurs/me côté front).
        PermissionCatalog.Modules.All.Should().OnlyHaveUniqueItems();
    }

    // ─── Rôles ──────────────────────────────────────────────────────────────

    [Theory]
    [InlineData("Administrator")]
    [InlineData("ResponsableRH")]
    [InlineData("Manager")]
    [InlineData("Employee")]
    public void SystemRoles_ContainsExpectedRole(string roleName)
    {
        PermissionCatalog.SystemRoles.Should().Contain(r => r.Name == roleName,
            $"le rôle système « {roleName} » doit être livré à chaque tenant via le provisioning");
    }

    [Fact]
    public void SystemRoles_HasExactlyFourRoles()
    {
        // Garde-fou : ajouter un 5e rôle système est une décision produit. Le test
        // casse délibérément pour forcer la mise à jour du frontend (Roles.tsx) +
        // du seed ProvisioningService et de l'attente UX.
        PermissionCatalog.SystemRoles.Should().HaveCount(4);
    }

    [Fact]
    public void IsAdminRole_RecognizesAdministrator_CaseInsensitive()
    {
        PermissionCatalog.IsAdminRole("Administrator").Should().BeTrue();
        PermissionCatalog.IsAdminRole("ADMINISTRATOR").Should().BeTrue();
        PermissionCatalog.IsAdminRole("administrator").Should().BeTrue();
    }

    [Theory]
    [InlineData("Manager")]
    [InlineData("ResponsableRH")]
    [InlineData("Employee")]
    [InlineData("")]
    [InlineData(null)]
    public void IsAdminRole_RejectsNonAdministratorRoles(string? role)
    {
        PermissionCatalog.IsAdminRole(role).Should().BeFalse();
    }

    // ─── Matrice CAMD : forme ───────────────────────────────────────────────

    [Fact]
    public void EverySystemRole_HasMatrixCoveringAllModules()
    {
        // Chaque rôle DOIT déclarer une entrée pour chaque module ; sans ça, le
        // PermissionChecker retournerait false silencieusement sur une cellule
        // manquante au lieu de remonter une erreur de configuration.
        foreach (var role in PermissionCatalog.SystemRoles)
        {
            role.Matrix.Keys.Should().BeEquivalentTo(PermissionCatalog.Modules.All,
                $"le rôle « {role.Name} » doit avoir une ligne pour chacun des {PermissionCatalog.Modules.All.Length} modules");
        }
    }

    [Fact]
    public void EveryMatrixCell_IsExactlyFourBinaryDigits()
    {
        foreach (var role in PermissionCatalog.SystemRoles)
        {
            foreach (var (module, mask) in role.Matrix)
            {
                mask.Should().HaveLength(4, $"[{role.Name}][{module}] doit suivre la convention CAMD à 4 caractères");
                mask.Should().MatchRegex("^[01]{4}$", $"[{role.Name}][{module}] = « {mask} » doit n'utiliser que '0' et '1'");
            }
        }
    }

    // ─── Matrice CAMD : invariants métier ────────────────────────────────────

    [Fact]
    public void Administrator_HasFullAccess_OnEveryModule()
    {
        // Le rôle Administrator est, par contrat (cf. AdminAttribute + PermissionChecker
        // line 17 « Admin has all permissions »), l'autorité supreme. Toute cellule
        // doit être "1111", sinon une page admin pourrait se retrouver bloquée.
        var admin = PermissionCatalog.SystemRoles.Single(r => r.Name == PermissionCatalog.Roles.Administrator);
        admin.Matrix.Values.Should().AllBe("1111");
    }

    [Fact]
    public void Employee_HasNoAccess_OnAdministrationModule()
    {
        // Invariant sécurité : un employé standard ne doit JAMAIS pouvoir interagir
        // avec le module Administration (gestion utilisateurs, rôles, configuration).
        var employee = PermissionCatalog.SystemRoles.Single(r => r.Name == PermissionCatalog.Roles.Employee);
        employee.Matrix[PermissionCatalog.Modules.Administration].Should().Be("0000");
    }

    [Fact]
    public void Manager_HasNoDeleteAccess_OnGestionEmployes()
    {
        // Décision produit : un manager peut consulter + ajouter + modifier ses
        // employés mais PAS les supprimer (action réservée au RH / Admin pour éviter
        // les pertes accidentelles d'historique).
        var manager = PermissionCatalog.SystemRoles.Single(r => r.Name == PermissionCatalog.Roles.Manager);
        var mask = manager.Matrix[PermissionCatalog.Modules.GestionEmployes];
        // CAMD → on prend le 4ᵉ caractère (Delete).
        mask[3].Should().Be('0', "le Manager ne doit pas pouvoir supprimer un employé");
    }

    [Fact]
    public void Employee_HasNoAccess_OnPaieRemuneration()
    {
        // RGPD / confidentialité : la paie est strictement réservée RH+Admin.
        var employee = PermissionCatalog.SystemRoles.Single(r => r.Name == PermissionCatalog.Roles.Employee);
        employee.Matrix[PermissionCatalog.Modules.PaieRemuneration].Should().Be("0000");
    }

    [Fact]
    public void ResponsableRH_HasNoAccess_OnAdministrationModule()
    {
        // ResponsableRH = gestion métier complète mais pas administration système
        // (cf. commentaire en tête de SystemRoleSpec[ResponsableRH]).
        var rh = PermissionCatalog.SystemRoles.Single(r => r.Name == PermissionCatalog.Roles.ResponsableRH);
        rh.Matrix[PermissionCatalog.Modules.Administration].Should().Be("0000");
    }
}
