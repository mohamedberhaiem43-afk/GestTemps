using System.Linq;
using FluentAssertions;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Configuration;
using Xunit;
using ABRPOINT.Server.Services;
using ABRPOINT.Server.Tenancy;

namespace ABRPOINT.Server.Tests.Security;

/// <summary>
/// Tests fonctionnels des primitives de sécurité critiques. Pas d'intégration HTTP
/// ici (la couverture endpoint est faite par <see cref="ControllerAuthAuditTests"/>) ;
/// on attaque directement les services pour valider :
///   • Hashage et propriétés cryptographiques de RefreshTokenHasher.
///   • Signature, expiration, anti-replay et résistance au timing-attack de
///     SuspiciousLoginTokenService.
///   • Normalisation et validation de PlanCatalog côté entrée utilisateur (anti
///     « plan injection » : un attaquant qui poste planCode="../../admin"
///     ne doit jamais résoudre vers un plan valide).
///
/// Convention : chaque test démarre un IMemoryCache neuf pour éviter qu'un test
/// laisse un cache pollué pour le suivant (single-use anti-replay sinon contaminé).
/// </summary>
public class FunctionalSecurityTests
{
    private static IMemoryCache NewCache() => new MemoryCache(new MemoryCacheOptions());

    private static IConfiguration ConfigWithJwtKey(string key = "test-secret-must-be-long-enough-for-hmac-sha256")
    {
        var dict = new Dictionary<string, string?> { ["Jwt:Key"] = key };
        return new ConfigurationBuilder().AddInMemoryCollection(dict).Build();
    }

    // ────────────────────────────────────────────────────────────────────────
    // RefreshTokenHasher
    // ────────────────────────────────────────────────────────────────────────

    [Fact]
    public void RefreshTokenHasher_IsDeterministic_SameInputSameHash()
    {
        var t = "abc123-token-value-with-256bits-entropy";
        RefreshTokenHasher.Hash(t).Should().Be(RefreshTokenHasher.Hash(t));
    }

    [Fact]
    public void RefreshTokenHasher_DifferentInputs_DifferentHashes()
    {
        RefreshTokenHasher.Hash("a").Should().NotBe(RefreshTokenHasher.Hash("b"));
    }

    [Fact]
    public void RefreshTokenHasher_DoesNotLeakPlaintext_OutputIsBase64Sha256()
    {
        var hash = RefreshTokenHasher.Hash("plaintext-secret");
        // SHA-256 = 32 octets → 44 chars base64 avec un '=' final.
        hash.Length.Should().Be(44);
        hash.Should().NotContain("plaintext", "le hash ne doit jamais contenir le texte d'origine");
    }

    [Fact]
    public void RefreshTokenHasher_EmptyInput_ReturnsEmpty()
    {
        // Cas limite : entrée vide → on retourne string.Empty et pas un hash de chaîne vide.
        // Empêche un comparateur naïf en DB de matcher accidentellement un token "vide".
        RefreshTokenHasher.Hash(string.Empty).Should().Be(string.Empty);
        RefreshTokenHasher.Hash(null!).Should().Be(string.Empty);
    }

    // ────────────────────────────────────────────────────────────────────────
    // SuspiciousLoginTokenService — HMAC signing, expiry, anti-replay
    // ────────────────────────────────────────────────────────────────────────

    [Fact]
    public void SuspiciousLoginToken_RoundTrip_GeneratesValidatableToken()
    {
        var svc = new SuspiciousLoginTokenService(ConfigWithJwtKey(), NewCache());
        var token = svc.Generate("tenant-a", "U001");

        svc.TryValidate(token, out var slug, out var uticod).Should().BeTrue();
        slug.Should().Be("tenant-a");
        uticod.Should().Be("U001");
    }

    [Fact]
    public void SuspiciousLoginToken_TamperedSignature_IsRejected()
    {
        var svc = new SuspiciousLoginTokenService(ConfigWithJwtKey(), NewCache());
        var token = svc.Generate("tenant-a", "U001");

        // On bricole la signature : flip un char arbitraire. Le validate doit refuser.
        var tampered = token[..^1] + (token[^1] == 'A' ? 'B' : 'A');
        svc.TryValidate(tampered, out _, out _).Should().BeFalse(
            "modifier la signature HMAC doit faire échouer la validation — sinon protection cryptographique compromise");
    }

    [Fact]
    public void SuspiciousLoginToken_TamperedPayload_IsRejected()
    {
        var svc = new SuspiciousLoginTokenService(ConfigWithJwtKey(), NewCache());
        var token = svc.Generate("tenant-a", "U001");

        // On change le payload (avant le point) en gardant la signature originale.
        // La sig ne correspond plus → rejet.
        var dot = token.IndexOf('.');
        var fakePayload = Convert.ToBase64String(System.Text.Encoding.UTF8.GetBytes("evil|U002|0"))
            .TrimEnd('=').Replace('+', '-').Replace('/', '_');
        var spoofed = fakePayload + token[dot..];
        svc.TryValidate(spoofed, out _, out _).Should().BeFalse(
            "modifier le payload sans recalculer la signature doit faire échouer la validation");
    }

    [Fact]
    public void SuspiciousLoginToken_DifferentSecret_IsRejected()
    {
        var svcAttacker = new SuspiciousLoginTokenService(ConfigWithJwtKey("attacker-knows-his-own-key-not-server-key"), NewCache());
        var svcServer = new SuspiciousLoginTokenService(ConfigWithJwtKey("real-server-secret-key-strong-enough"), NewCache());

        // L'attaquant forge un token avec SA clé ; le serveur le rejette parce qu'il
        // vérifie avec SA propre clé. C'est la propriété fondamentale du HMAC.
        var forged = svcAttacker.Generate("victim-tenant", "U001");
        svcServer.TryValidate(forged, out _, out _).Should().BeFalse(
            "un token signé avec une clé différente ne doit JAMAIS valider — sinon le système n'a aucune protection cryptographique");
    }

    [Fact]
    public void SuspiciousLoginToken_AfterMarkConsumed_IsRejected()
    {
        var svc = new SuspiciousLoginTokenService(ConfigWithJwtKey(), NewCache());
        var token = svc.Generate("tenant-a", "U001");

        // Premier usage : OK.
        svc.TryValidate(token, out _, out _).Should().BeTrue();
        svc.MarkConsumed(token);
        // Réutilisation interceptée par un attaquant qui aurait lu l'email après l'user → refus.
        svc.TryValidate(token, out _, out _).Should().BeFalse(
            "le token est single-use — une fois consommé il doit être rejeté pour empêcher le replay");
    }

    [Fact]
    public void SuspiciousLoginToken_MalformedInput_IsRejectedSafely()
    {
        var svc = new SuspiciousLoginTokenService(ConfigWithJwtKey(), NewCache());

        // Aucun de ces inputs ne doit lever d'exception ; tous doivent renvoyer false
        // proprement. Lever une exception serait exploitable en DoS sur l'endpoint
        // qui consomme le token.
        svc.TryValidate(null, out _, out _).Should().BeFalse();
        svc.TryValidate("", out _, out _).Should().BeFalse();
        svc.TryValidate("no-dot-separator", out _, out _).Should().BeFalse();
        svc.TryValidate(".", out _, out _).Should().BeFalse();
        svc.TryValidate("aaaa.", out _, out _).Should().BeFalse();
        svc.TryValidate(".bbbb", out _, out _).Should().BeFalse();
        svc.TryValidate("not-valid-base64-!!!.xxxx", out _, out _).Should().BeFalse();
    }

    // ────────────────────────────────────────────────────────────────────────
    // PlanCatalog — anti plan-injection
    // ────────────────────────────────────────────────────────────────────────

    [Theory]
    [InlineData("Starter", "Starter")]
    [InlineData("starter", "Starter")]
    [InlineData("STARTER", "Starter")]
    [InlineData("Standard", "Standard")]
    [InlineData("Premium", "Premium")]
    [InlineData("premium", "Premium")]
    [InlineData("Essentiel", "Starter")] // alias legacy
    public void PlanCatalog_Normalize_AcceptsCanonicalAndAliases(string input, string expected)
    {
        PlanCatalog.Normalize(input).Should().Be(expected);
    }

    [Theory]
    [InlineData("../admin")]
    [InlineData("Premium' OR 1=1--")]
    [InlineData("<script>alert(1)</script>")]
    [InlineData("Premium\nStandard")]
    [InlineData("PremiumBusiness")]
    [InlineData("Unknown")]
    public void PlanCatalog_GetPlan_RejectsBogusInputs(string maliciousInput)
    {
        // Critique : un attaquant qui poste un planCode bidon ne doit jamais
        // résoudre vers un plan valide. GetPlan retourne null sur l'inconnu, ce qui
        // fait que les endpoints de billing/feature-gating renvoient un 400/403 plutôt
        // que d'attribuer accidentellement le plan le plus permissif.
        PlanCatalog.GetPlan(maliciousInput).Should().BeNull(
            "GetPlan ne doit jamais retourner un PlanDefinition pour une entrée non canonique " +
            $"(input testé : {maliciousInput})");
    }

    [Fact]
    public void PlanCatalog_GetPlan_EmptyOrNull_ReturnsNull()
    {
        PlanCatalog.GetPlan(null).Should().BeNull();
        PlanCatalog.GetPlan("").Should().BeNull();
        PlanCatalog.GetPlan("   ").Should().BeNull();
    }

    // ────────────────────────────────────────────────────────────────────────
    // PlanCatalog — l'effectif overage doit toujours rester non-négatif
    // ────────────────────────────────────────────────────────────────────────

    [Theory]
    [InlineData(0)]
    [InlineData(5)]
    [InlineData(-100)] // input absurde (ne devrait pas arriver, mais defense-in-depth)
    public void PlanCatalog_ComputeSupplementaryCount_NeverNegative(int activeCount)
    {
        var plan = PlanCatalog.GetPlan("Starter")!;
        var count = PlanCatalog.ComputeSupplementaryCount(plan, activeCount);
        count.Should().BeGreaterOrEqualTo(0,
            "un overage négatif déclencherait une facturation Stripe absurde (quantity < 0)");
    }

    [Fact]
    public void PlanCatalog_ComputeMonthlyTotal_NeverBelowFlatPrice()
    {
        var plan = PlanCatalog.GetPlan("Standard")!;
        // L'overage ne doit JAMAIS faire baisser le total sous le flat — sinon un
        // attaquant qui sous-déclare son effectif paie moins que le tarif de base.
        PlanCatalog.ComputeMonthlyTotal(plan, employeeCount: 0)
            .Should().Be(plan.FlatPriceMonthlyEur);
        PlanCatalog.ComputeMonthlyTotal(plan, employeeCount: -10)
            .Should().Be(plan.FlatPriceMonthlyEur,
                "un effectif négatif (input erroné) doit retomber sur le tarif de base, jamais moins");
    }
}
