using ABRPOINT.Server.Tenancy;
using FluentAssertions;
using Xunit;

namespace ABRPOINT.Server.Tests.Tenancy;

/// <summary>
/// Tests intensifs du <see cref="PlanCatalog"/> — la source de vérité unique pour
/// la matrice plan × fonctionnalité, la tarification flat + overage, et les addons.
///
/// Pourquoi tester ça aussi sérieusement ? C'est ce qui gate TOUT l'accès aux modules :
///   • Les routes API utilisent [RequirePlanFeature(nameof(PlanFeatures.X))] qui lit
///     ces flags. Une régression silencieuse = un client qui voit son module
///     disparaître (ou pire : un client Starter qui accède à un module Business).
///   • La page MonAbonnement affiche les modules actifs : faux flags = facture en
///     décalage avec ce que voit l'utilisateur.
///   • Les addons sont facturés via Stripe : si le cascade signatureElectronique
///     → DigitalVault casse, le client paie un module invisible (cf. commentaire
///     PlanCatalog.cs:412-417 : "addon mort").
///
/// Tous les flags critiques sont testés explicitement par pack.
/// </summary>
public class PlanCatalogTests
{
    // ─── Normalize : codes legacy ──────────────────────────────────────────

    [Theory]
    [InlineData("Essentiel", "Starter")]   // legacy → starter (rétrocompat critique)
    [InlineData("essentiel", "Starter")]   // casing toléré
    [InlineData("  Essentiel  ", "Starter")] // trim toléré
    [InlineData("Starter", "Starter")]
    [InlineData("STANDARD", "Standard")]
    [InlineData("premium", "Premium")]
    [InlineData("Unknown", "Unknown")]     // inconnu : laissé tel quel (traçabilité)
    [InlineData("", "")]                   // vide → vide
    public void Normalize_HandlesLegacyAndCasing(string input, string expected)
    {
        PlanCatalog.Normalize(input).Should().Be(expected);
    }

    [Fact]
    public void Normalize_NullInput_ReturnsEmpty()
    {
        PlanCatalog.Normalize(null).Should().Be("");
    }

    // ─── GetPlan : résolution + fallback null ──────────────────────────────

    [Theory]
    [InlineData("Starter")]
    [InlineData("Essentiel")]   // legacy
    [InlineData("starter")]
    public void GetPlan_StarterAliases_ReturnsStarter(string code)
    {
        var plan = PlanCatalog.GetPlan(code);
        plan.Should().NotBeNull();
        plan!.Code.Should().Be(PlanCatalog.StarterCode);
    }

    [Fact]
    public void GetPlan_UnknownCode_ReturnsNull()
    {
        PlanCatalog.GetPlan("Enterprise").Should().BeNull();
    }

    [Fact]
    public void GetPlan_Null_ReturnsNull()
    {
        PlanCatalog.GetPlan(null).Should().BeNull();
    }

    // ─── Matrice features par pack — INVARIANTS COMMERCIAUX ─────────────────

    [Fact]
    public void Starter_DoesNotIncludeGeolocation()
    {
        // Le positionnement Starter : pointage simple, pas de géoloc. Une régression
        // ici exposerait Geofence+LivePosition à des clients qui n'ont pas payé pour.
        PlanCatalog.Starter.Features.Geolocation.Should().BeFalse();
    }

    [Fact]
    public void Starter_DoesNotIncludeDigitalVaultOrElectronicSignature()
    {
        PlanCatalog.Starter.Features.DigitalVault.Should().BeFalse();
        PlanCatalog.Starter.Features.ElectronicSignature.Should().BeFalse();
    }

    [Fact]
    public void Starter_IncludesMobileAppAndLeaveManagement()
    {
        // Repositionnement commercial 2026-05 : pointage MOBILE inclus dès Starter.
        PlanCatalog.Starter.Features.MobileApp.Should().BeTrue();
        PlanCatalog.Starter.Features.LeaveManagement.Should().BeTrue();
        PlanCatalog.Starter.Features.AuthorizationManagement.Should().BeTrue();
    }

    [Fact]
    public void Starter_ExcludesAdvancedBusinessModules()
    {
        var f = PlanCatalog.Starter.Features;
        f.ExpenseReports.Should().BeFalse();
        f.BreastfeedingManagement.Should().BeFalse();
        f.ContractManagement.Should().BeFalse();
        f.DocumentScanOcr.Should().BeFalse();
        f.BulkImport.Should().BeFalse();
        f.Missions.Should().BeFalse();
        f.AdvancedAuditLogs.Should().BeFalse();
        f.RagAi.Should().BeFalse();
        f.MultiSite.Should().BeFalse();
        f.MultiSociete.Should().BeFalse();
    }

    [Fact]
    public void Standard_IncludesAllBusinessModulesExceptRagAndAudit()
    {
        var f = PlanCatalog.Standard.Features;
        f.Geolocation.Should().BeTrue();
        f.DigitalVault.Should().BeTrue();
        f.ElectronicSignature.Should().BeTrue();
        f.MultiSite.Should().BeTrue();
        f.MultiSociete.Should().BeFalse("Standard = 1 société, multi-sites jusqu'à 5");
        f.ExpenseReports.Should().BeTrue();
        f.ContractManagement.Should().BeTrue();
        f.Missions.Should().BeTrue();
        // Spécificités Standard exclues (différenciateurs Business)
        f.RagAi.Should().BeFalse("RAG AI réservé Business");
        f.AdvancedAuditLogs.Should().BeFalse("Audit logs réservés Business (cf. PlanCatalog.cs:222-227)");
    }

    [Fact]
    public void Premium_HasAllFeaturesExceptAddonOnly()
    {
        var f = PlanCatalog.Premium.Features;
        f.Geolocation.Should().BeTrue();
        f.DigitalVault.Should().BeTrue();
        f.ElectronicSignature.Should().BeTrue();
        f.MultiSite.Should().BeTrue();
        f.MultiSociete.Should().BeTrue();
        f.RagAi.Should().BeTrue();
        f.AdvancedAuditLogs.Should().BeTrue();
        f.CustomBranding.Should().BeTrue();
        f.DeviceTrustEnforced.Should().BeTrue();
        // Addon-only : non inclus même sur Premium (le client doit explicitement souscrire)
        f.ApiAccess.Should().BeFalse("ApiAccess est addon-only, pas inclus par défaut");
        f.PrioritySupport.Should().BeFalse("PrioritySupport est addon-only");
    }

    // ─── Limites employés / sites / sociétés ────────────────────────────────

    [Fact]
    public void Starter_IncludesTenEmployeesOneSiteOneSocietyOneAdmin()
    {
        PlanCatalog.Starter.IncludedEmployees.Should().Be(10);
        PlanCatalog.Starter.MaxSites.Should().Be(1);
        PlanCatalog.Starter.MaxSocietes.Should().Be(1);
        PlanCatalog.Starter.IncludedAdmins.Should().Be(1);
    }

    [Fact]
    public void Standard_IncludesTwentyFiveEmployeesFiveSitesThreeAdmins()
    {
        PlanCatalog.Standard.IncludedEmployees.Should().Be(25);
        PlanCatalog.Standard.MaxSites.Should().Be(5);
        PlanCatalog.Standard.MaxSocietes.Should().Be(1);
        PlanCatalog.Standard.IncludedAdmins.Should().Be(3);
    }

    [Fact]
    public void Premium_HasUnlimitedSitesSocieteAndAdmins()
    {
        PlanCatalog.Premium.MaxSites.Should().BeNull();
        PlanCatalog.Premium.MaxSocietes.Should().BeNull();
        PlanCatalog.Premium.IncludedAdmins.Should().BeNull();
    }

    [Fact]
    public void AllPacks_MaxEmployees_IsNull_NoHardCap()
    {
        // Décision 2026-05-23 : plus de plafond sur aucun pack (overage facturé sans limite).
        PlanCatalog.Starter.MaxEmployees.Should().BeNull();
        PlanCatalog.Standard.MaxEmployees.Should().BeNull();
        PlanCatalog.Premium.MaxEmployees.Should().BeNull();
    }

    // ─── Tarification & overage ────────────────────────────────────────────

    [Fact]
    public void ComputeMonthlyTotal_UnderIncluded_ReturnsFlatPrice()
    {
        // 5 salariés sur Starter (inclus = 10) → juste 99€.
        PlanCatalog.ComputeMonthlyTotal(PlanCatalog.Starter, 5).Should().Be(99m);
    }

    [Fact]
    public void ComputeMonthlyTotal_OverIncluded_AddsOveragePerEmployee()
    {
        // 13 salariés sur Starter = 99 + 3 × 4.90 = 113.70
        PlanCatalog.ComputeMonthlyTotal(PlanCatalog.Starter, 13).Should().Be(99m + 3 * 4.90m);
    }

    [Fact]
    public void ComputeMonthlyTotal_OnlyOverage_OnPremium()
    {
        // 60 salariés sur Premium (50 inclus) = 449 + 10 × 9.90 = 548
        PlanCatalog.ComputeMonthlyTotal(PlanCatalog.Premium, 60).Should().Be(449m + 10 * 9.90m);
    }

    [Theory]
    [InlineData(0, 0)]
    [InlineData(10, 0)]
    [InlineData(11, 1)]
    [InlineData(50, 40)]
    public void ComputeSupplementaryCount_OnlyAboveIncluded(int activeCount, int expected)
    {
        PlanCatalog.ComputeSupplementaryCount(PlanCatalog.Starter, activeCount).Should().Be(expected);
    }

    [Theory]
    [InlineData(0, false)]   // 0 < 10 → pas en dépassement
    [InlineData(9, false)]   // 9 < 10
    [InlineData(10, true)]   // au seuil = on est À CAPACITÉ → confirmOverage requis pour le 11e
    [InlineData(11, true)]
    public void IsOverIncludedCapacity_TriggersAtThreshold(int count, bool expected)
    {
        PlanCatalog.IsOverIncludedCapacity(PlanCatalog.Starter, count).Should().Be(expected);
    }

    [Fact]
    public void WouldExceedPlanMax_AlwaysFalseSinceMaxEmployeesIsNull()
    {
        // Décision produit 2026-05-23 : plafond absolu supprimé.
        PlanCatalog.WouldExceedPlanMax(PlanCatalog.Starter, 999).Should().BeFalse();
        PlanCatalog.WouldExceedPlanMax(PlanCatalog.Standard, 9999).Should().BeFalse();
    }

    // ─── Stockage ──────────────────────────────────────────────────────────

    [Theory]
    [InlineData("Starter", 10L * 1024)]
    [InlineData("Standard", 50L * 1024)]
    [InlineData("Premium", 200L * 1024)]
    [InlineData("Essentiel", 10L * 1024)] // legacy alias → Starter quota
    [InlineData("Inconnu", 10L * 1024)]   // fallback Starter (le plus restrictif)
    [InlineData(null, 10L * 1024)]        // null → Starter
    public void GetStorageQuotaMb_ReturnsExpectedQuotaWithStarterFallback(string? code, long expectedMb)
    {
        PlanCatalog.GetStorageQuotaMb(code).Should().Be(expectedMb);
    }

    // ─── ParseAddons ───────────────────────────────────────────────────────

    [Fact]
    public void ParseAddons_NullOrEmpty_ReturnsEmptySet()
    {
        PlanCatalog.ParseAddons(null).Should().BeEmpty();
        PlanCatalog.ParseAddons("").Should().BeEmpty();
        PlanCatalog.ParseAddons("   ").Should().BeEmpty();
    }

    [Theory]
    [InlineData("signatureElectronique", new[] { "signatureElectronique" })]
    [InlineData("aiAssistantRh,apiAvancee", new[] { "aiAssistantRh", "apiAvancee" })]
    [InlineData("  signatureElectronique  ,  apiAvancee  ", new[] { "signatureElectronique", "apiAvancee" })]
    [InlineData("aiAssistantRh;supportPrioritaire", new[] { "aiAssistantRh", "supportPrioritaire" })] // ; aussi
    public void ParseAddons_ParsesValidKeys(string csv, string[] expected)
    {
        var result = PlanCatalog.ParseAddons(csv);
        result.Should().BeEquivalentTo(expected);
    }

    [Theory]
    [InlineData("AIASSISTANTRH", "aiAssistantRh")]
    [InlineData("SignatureElectronique", "signatureElectronique")]
    [InlineData("apIAvancee", "apiAvancee")]
    public void ParseAddons_CasingInvariant_StillRecognizedAsValidKey(string input, string canonical)
    {
        // L'implémentation utilise un HashSet OrdinalIgnoreCase pour le contains, mais
        // garde la chaîne entrante. Donc "AIASSISTANTRH" est reconnu comme valide → il
        // est inclus dans le résultat. La comparaison côté GetEffectiveFeatures se fait
        // ensuite avec Contains qui est lui aussi case-insensitive (cf. ligne 395).
        // On vérifie ici que la clé EST acceptée (présente dans le résultat, peu importe la casse).
        var result = PlanCatalog.ParseAddons(input);
        result.Should().ContainSingle();
        result.Should().Contain(input, "ParseAddons préserve la casse entrante");
        // Et la cascade côté GetEffectiveFeatures fonctionne malgré la casse :
        var features = PlanCatalog.GetEffectiveFeatures("Starter", input);
        var canonicalFeatures = PlanCatalog.GetEffectiveFeatures("Starter", canonical);
        features.Should().BeEquivalentTo(canonicalFeatures);
    }

    [Fact]
    public void ParseAddons_UnknownKeys_AreSilentlyIgnored()
    {
        // Protection contre les keys parasites en base (ancien addon retiré, faute de frappe).
        var result = PlanCatalog.ParseAddons("signatureElectronique,unknownAddon,apiAvancee");
        result.Should().BeEquivalentTo(new[] { "signatureElectronique", "apiAvancee" });
    }

    [Fact]
    public void ParseAddons_DuplicateKeys_AreDeduplicated()
    {
        var result = PlanCatalog.ParseAddons("signatureElectronique,signatureElectronique");
        result.Should().HaveCount(1);
    }

    // ─── GetEffectiveFeatures : cascade addons ─────────────────────────────

    [Fact]
    public void GetEffectiveFeatures_NoAddons_ReturnsBasePackFeatures()
    {
        var f = PlanCatalog.GetEffectiveFeatures("Starter", null);
        f.Should().BeEquivalentTo(PlanCatalog.Starter.Features);
    }

    [Fact]
    public void GetEffectiveFeatures_UnknownPack_FallsBackToStarter()
    {
        var f = PlanCatalog.GetEffectiveFeatures("Inconnu", null);
        f.Should().BeEquivalentTo(PlanCatalog.Starter.Features);
    }

    [Fact]
    public void GetEffectiveFeatures_StarterWithSignatureAddon_CascadesToBothESignAndVault()
    {
        // RÉGRESSION CRITIQUE (cf. PlanCatalog.cs:440-444) : sans le cascade,
        // signatureElectronique sur Starter activait ElectronicSignature mais pas
        // DigitalVault → le bouton "Signer" restait inaccessible (gate combinée
        // dans VaultController). Le client payait un addon mort.
        var f = PlanCatalog.GetEffectiveFeatures("Starter", "signatureElectronique");

        f.ElectronicSignature.Should().BeTrue();
        f.DigitalVault.Should().BeTrue("cascade obligatoire — sans coffre on ne peut signer nulle part");
    }

    [Fact]
    public void GetEffectiveFeatures_AiAssistantAddon_EnablesRagAiOnStarter()
    {
        var f = PlanCatalog.GetEffectiveFeatures("Starter", "aiAssistantRh");
        f.RagAi.Should().BeTrue();
    }

    [Fact]
    public void GetEffectiveFeatures_IaDocumentaireAddon_AlsoEnablesRagAi()
    {
        // Les deux addons IA pointent vers le même flag.
        var f = PlanCatalog.GetEffectiveFeatures("Starter", "iaDocumentaireAvancee");
        f.RagAi.Should().BeTrue();
    }

    [Fact]
    public void GetEffectiveFeatures_ApiAndSupportAddons_EnableRespectiveFlags()
    {
        var f = PlanCatalog.GetEffectiveFeatures("Starter", "apiAvancee,supportPrioritaire");
        f.ApiAccess.Should().BeTrue();
        f.PrioritySupport.Should().BeTrue();
    }

    [Fact]
    public void GetEffectiveFeatures_AddonsNeverRemoveBaseFeatures()
    {
        // OR-merge strict : les addons N'ENLÈVENT JAMAIS une feature pack (ils ne font
        // qu'ajouter). Test : Premium déjà Geolocation=true, on ajoute un addon non
        // lié → Geolocation reste true.
        var f = PlanCatalog.GetEffectiveFeatures("Premium", "apiAvancee");
        f.Geolocation.Should().BeTrue();
        f.RagAi.Should().BeTrue("Premium a déjà RagAi=true, addon ne doit pas l'éteindre");
    }

    [Fact]
    public void GetEffectiveFeatures_AllAddonsTogether_OnStarter()
    {
        // Cas réel : un client TPE Starter qui souscrit TOUS les addons en signup.
        var f = PlanCatalog.GetEffectiveFeatures("Starter",
            "aiAssistantRh,iaDocumentaireAvancee,signatureElectronique,apiAvancee,supportPrioritaire");

        f.RagAi.Should().BeTrue();
        f.ElectronicSignature.Should().BeTrue();
        f.DigitalVault.Should().BeTrue();
        f.ApiAccess.Should().BeTrue();
        f.PrioritySupport.Should().BeTrue();

        // Mais ce qui n'est PAS un addon ne se débloque PAS — un client Starter, même
        // avec tous les addons, n'accède PAS à la géoloc ou au multi-sites.
        f.Geolocation.Should().BeFalse();
        f.MultiSite.Should().BeFalse();
        f.AdvancedAuditLogs.Should().BeFalse();
    }

    [Fact]
    public void GetEffectiveFeatures_NullPlanCode_FallsBackToStarter()
    {
        // Trial sans plan choisi → traité comme Starter (le plus restrictif).
        var f = PlanCatalog.GetEffectiveFeatures(null, null);
        f.Should().BeEquivalentTo(PlanCatalog.Starter.Features);
    }

    // ─── Catalogue All : invariants commerciaux ────────────────────────────

    [Fact]
    public void All_ContainsExactlyThreePlansInPriceOrder()
    {
        PlanCatalog.All.Should().HaveCount(3);
        PlanCatalog.All[0].Code.Should().Be("Starter");
        PlanCatalog.All[1].Code.Should().Be("Standard");
        PlanCatalog.All[2].Code.Should().Be("Premium");
    }

    [Fact]
    public void All_PricesAreStrictlyAscending()
    {
        // Garde-fou : si un jour quelqu'un inverse les prix par erreur, le test casse.
        for (int i = 0; i < PlanCatalog.All.Count - 1; i++)
        {
            PlanCatalog.All[i].FlatPriceMonthlyEur.Should().BeLessThan(PlanCatalog.All[i + 1].FlatPriceMonthlyEur);
        }
    }

    [Fact]
    public void All_IncludedEmployeesAreStrictlyAscending()
    {
        for (int i = 0; i < PlanCatalog.All.Count - 1; i++)
        {
            PlanCatalog.All[i].IncludedEmployees.Should().BeLessThan(PlanCatalog.All[i + 1].IncludedEmployees);
        }
    }

    [Fact]
    public void All_StorageQuotasAreStrictlyAscending()
    {
        for (int i = 0; i < PlanCatalog.All.Count - 1; i++)
        {
            PlanCatalog.All[i].StorageQuotaMb.Should().BeLessThan(PlanCatalog.All[i + 1].StorageQuotaMb);
        }
    }
}
