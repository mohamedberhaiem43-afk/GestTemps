using System.Reflection;
using ABRPOINT.Server.Provisioning;
using ABRPOINT.Server.Tenancy;
using FluentAssertions;
using Xunit;

namespace ABRPOINT.Server.Tests.Provisioning;

/// <summary>
/// Tests des helpers critiques de <see cref="ProvisioningService"/> :
///   • <c>ValidateDbName</c> — gate anti-injection SQL (le nom de DB ne peut pas
///     être paramétré, donc on whitelist strictement).
///   • <c>QuoteIdent</c> — défense en profondeur si la validation est assouplie.
///   • <c>Truncate</c> — borne la taille des champs avant INSERT (évite "value too
///     long" qui ferait planter le seed entier d'un tenant).
///
/// Ces méthodes sont privées mais critiques sécurité — on les invoque par réflexion.
/// Bouclier multi-couches : si quelqu'un retire la whitelist, on doit le détecter
/// AVANT prod via un test rouge.
///
/// Inclut aussi les invariants de conventions du seed (Soccod="01", Sitcod="01",
/// AdminCode="AD") versus les limites annoncées de chaque pack — la cohérence
/// entre ce qui est seedé et ce qui est facturé doit tenir.
/// </summary>
public class ProvisioningServiceTests
{
    private static readonly MethodInfo ValidateDbNameMethod = typeof(ProvisioningService)
        .GetMethod("ValidateDbName", BindingFlags.NonPublic | BindingFlags.Static)!;

    private static readonly MethodInfo QuoteIdentMethod = typeof(ProvisioningService)
        .GetMethod("QuoteIdent", BindingFlags.NonPublic | BindingFlags.Static)!;

    private static readonly MethodInfo TruncateMethod = typeof(ProvisioningService)
        .GetMethod("Truncate", BindingFlags.NonPublic | BindingFlags.Static)!;

    private static void ValidateDbName(string? name)
    {
        try { ValidateDbNameMethod.Invoke(null, new object?[] { name }); }
        catch (TargetInvocationException ex) when (ex.InnerException is not null) { throw ex.InnerException; }
    }

    private static string QuoteIdent(string ident)
    {
        try { return (string)QuoteIdentMethod.Invoke(null, new object?[] { ident })!; }
        catch (TargetInvocationException ex) when (ex.InnerException is not null) { throw ex.InnerException; }
    }

    private static string Truncate(string? input, int max)
        => (string)TruncateMethod.Invoke(null, new object?[] { input, max })!;

    // ─── ValidateDbName : whitelist stricte ────────────────────────────────

    [Theory]
    [InlineData("tenant_acme_a1b2c3d4")]
    [InlineData("abrpoint_master")]
    [InlineData("test123")]
    [InlineData("a")] // 1 caractère = OK (regex {1,63})
    [InlineData("ABC")]
    public void ValidateDbName_ValidNames_DoesNotThrow(string name)
    {
        var act = () => ValidateDbName(name);
        act.Should().NotThrow();
    }

    [Theory]
    [InlineData("")]
    [InlineData("   ")]
    [InlineData(null)]
    public void ValidateDbName_NullOrWhitespace_Throws(string? name)
    {
        var act = () => ValidateDbName(name);
        act.Should().Throw<ArgumentException>();
    }

    [Theory]
    [InlineData("tenant; DROP DATABASE postgres;")] // injection classique
    [InlineData("a\"b")]                            // quote injection
    [InlineData("a'b")]                             // single quote
    [InlineData("a-b")]                             // tiret pas autorisé
    [InlineData("a b")]                             // espace
    [InlineData("a/b")]                             // slash
    [InlineData("test$")]                           // caractère spécial
    [InlineData("test.db")]                         // point
    [InlineData("résumé")]                          // accent
    [InlineData("公司")]                             // unicode
    public void ValidateDbName_InjectionAttempt_Throws(string evilName)
    {
        var act = () => ValidateDbName(evilName);
        act.Should().Throw<ArgumentException>(
            $"« {evilName} » contient des caractères hors whitelist [A-Za-z0-9_] — doit être rejeté");
    }

    [Fact]
    public void ValidateDbName_64Characters_Rejected()
    {
        // Limite stricte 63 (NAMEDATALEN par défaut de PostgreSQL).
        var name = new string('a', 64);
        var act = () => ValidateDbName(name);
        act.Should().Throw<ArgumentException>("PostgreSQL tronque silencieusement à 63 chars");
    }

    [Fact]
    public void ValidateDbName_63Characters_Accepted()
    {
        var name = new string('a', 63);
        var act = () => ValidateDbName(name);
        act.Should().NotThrow();
    }

    // ─── QuoteIdent : double protection ────────────────────────────────────

    [Fact]
    public void QuoteIdent_ValidName_WrapsInDoubleQuotes()
    {
        QuoteIdent("tenant_test").Should().Be("\"tenant_test\"");
    }

    [Fact]
    public void QuoteIdent_InvalidName_StillThrows()
    {
        // Même via QuoteIdent (qui appelle ValidateDbName) une injection est bloquée.
        var act = () => QuoteIdent("a\"; DROP TABLE x; --");
        act.Should().Throw<ArgumentException>();
    }

    // ─── Truncate : borne longueur ─────────────────────────────────────────

    [Theory]
    [InlineData(null, 10, "")]
    [InlineData("", 10, "")]
    [InlineData("abc", 10, "abc")]                          // sous la limite
    [InlineData("abcdefghij", 10, "abcdefghij")]            // exactement à la limite
    [InlineData("abcdefghijklmno", 10, "abcdefghij")]       // au-dessus → tronqué
    [InlineData("Société Très Longue qui dépasse 30", 30, "Société Très Longue qui dépass")]
    public void Truncate_RespectsMaxLength(string? input, int max, string expected)
    {
        Truncate(input, max).Should().Be(expected);
    }

    // ─── Invariants pack ↔ seed ────────────────────────────────────────────

    [Fact]
    public void SeedConventions_OneSiteOneSociety_AreCompatibleWithStarterLimits()
    {
        // Le seed crée 1 Société (Soccod="01") et 1 Site (Sitcod="01"). Ces nombres
        // DOIVENT être ≤ aux limites du pack le PLUS RESTRICTIF (Starter), sinon
        // un client qui ne souscrit que Starter aura déjà dépassé les limites au
        // premier login. C'est un invariant produit.
        PlanCatalog.Starter.MaxSites.Should().BeGreaterThanOrEqualTo(1,
            "le seed crée 1 site → Starter doit pouvoir en accueillir au moins 1");
        PlanCatalog.Starter.MaxSocietes.Should().BeGreaterThanOrEqualTo(1,
            "le seed crée 1 société → Starter doit pouvoir en accueillir au moins 1");
        PlanCatalog.Starter.IncludedAdmins.Should().BeGreaterThanOrEqualTo(1,
            "le seed crée 1 admin (Uticod=AD) → Starter doit l'inclure dans son quota");
    }

    [Fact]
    public void AllPacks_AcceptInitialSeed_NoOverageAtSignup()
    {
        // Pour CHAQUE pack, vérifier qu'un tenant fraîchement seedé (0 salarié)
        // n'est PAS au-dessus du quota inclus. Sinon, un nouveau client serait
        // immédiatement facturé en overage au premier login → friction UX critique.
        foreach (var pack in PlanCatalog.All)
        {
            PlanCatalog.IsOverIncludedCapacity(pack, currentActiveCount: 0)
                       .Should().BeFalse($"Pack {pack.Code} ne doit PAS déclencher l'overage à 0 salarié");
            PlanCatalog.ComputeSupplementaryCount(pack, 0)
                       .Should().Be(0, $"Pack {pack.Code} : aucun overage attendu à 0 salarié");
        }
    }

    [Fact]
    public void GetEffectiveFeatures_FreshTenantStarter_HasLeaveManagementForBaseSeedToWork()
    {
        // Le seed crée des catégories, services, etc. Si LeaveManagement était false
        // sur Starter mais que le seed créait des Conges, l'admin aurait des données
        // invisibles. Garantie : Starter inclut LeaveManagement DÈS le 1er login.
        var f = PlanCatalog.GetEffectiveFeatures("Starter", null);
        f.LeaveManagement.Should().BeTrue();
        f.AuthorizationManagement.Should().BeTrue();
        f.MobileApp.Should().BeTrue("Starter inclut pointage mobile depuis le repositionnement 2026-05");
    }

    [Fact]
    public void StorageQuota_StarterIsLessThanStandardIsLessThanPremium()
    {
        // Garde-fou tarifaire : si quelqu'un inverse les quotas par erreur, le test casse.
        var starterQ = PlanCatalog.GetStorageQuotaMb("Starter");
        var standardQ = PlanCatalog.GetStorageQuotaMb("Standard");
        var premiumQ = PlanCatalog.GetStorageQuotaMb("Premium");

        starterQ.Should().BeLessThan(standardQ);
        standardQ.Should().BeLessThan(premiumQ);
    }
}
