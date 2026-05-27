using System.Diagnostics;
using FluentAssertions;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Configuration;
using Xunit;
using Xunit.Abstractions;
using ABRPOINT.Server.Services;
using ABRPOINT.Server.Tenancy;

namespace ABRPOINT.Server.Tests.Performance;

/// <summary>
/// Tests de garde-fou performance — exécutables en CI normale (pas BenchmarkDotNet).
///
/// Objectif : DÉTECTER les régressions visibles à l'œil nu (×10 lent) sur les chemins
/// hot, sans chercher la précision microbenchmark. Pour profiling rigoureux, voir
/// le projet séparé ABRPOINT.Server.Benchmarks (BenchmarkDotNet).
///
/// Méthodologie :
///   1. Warmup : un appel non chronométré pour amortir JIT + alloc initiale.
///   2. Mesure : N appels en boucle tight, mesurés via <see cref="Stopwatch"/>.
///   3. Assertion : durée totale &lt; seuil RAISONNABLE (et large) calibré sur une
///      machine de CI standard.
///
/// Si un test fail ici, c'est probablement parce qu'un appel synchrone DB,
/// un Convert.FromBase64String dans une boucle, ou un appel HTTP fraîchement
/// introduit dans un chemin pur-CPU. Diff le service concerné en priorité.
///
/// Les seuils sont volontairement larges (×5-10 fois la perf nominale mesurée
/// localement) pour éviter le flake sur runners CI lents — un fail signifie
/// donc une vraie régression, pas du bruit.
/// </summary>
public class HotPathPerformanceTests
{
    private readonly ITestOutputHelper _output;
    public HotPathPerformanceTests(ITestOutputHelper output) => _output = output;

    /// <summary>
    /// PlanCatalog.ComputeMonthlyTotal est appelé sur chaque page d'abonnement, chaque
    /// signup, chaque preview de changement de plan. Doit rester sub-µs.
    /// </summary>
    [Fact]
    public void PlanCatalog_ComputeMonthlyTotal_StaysFastOnHotPath()
    {
        var plan = PlanCatalog.GetPlan("Standard")!;
        const int iterations = 1_000_000;
        const int budgetMs = 500; // 500 ns/call max sur runner CI ; nominal ≈ 50 ns.

        // Warmup
        for (int i = 0; i < 1000; i++) _ = PlanCatalog.ComputeMonthlyTotal(plan, 30);

        var sw = Stopwatch.StartNew();
        decimal acc = 0;
        for (int i = 0; i < iterations; i++)
        {
            acc += PlanCatalog.ComputeMonthlyTotal(plan, 30);
        }
        sw.Stop();

        _output.WriteLine($"ComputeMonthlyTotal: {iterations} iter en {sw.ElapsedMilliseconds} ms ({(double)sw.ElapsedMilliseconds * 1000 / iterations:F2} µs/call, acc={acc})");
        sw.ElapsedMilliseconds.Should().BeLessThan(budgetMs,
            $"ComputeMonthlyTotal doit rester un calcul pur-CPU (<{budgetMs}ms pour {iterations} appels). " +
            "Si ce test fail, vérifier qu'aucun appel DB / I/O n'a été introduit dans le chemin.");
    }

    /// <summary>
    /// PlanCatalog.Normalize est appelé à chaque résolution de plan (auth, billing,
    /// gating). Surface d'attaque : un attaquant peut faire des appels rapides avec
    /// des inputs aberrants — la normalisation ne doit pas devenir un DoS.
    /// </summary>
    [Fact]
    public void PlanCatalog_Normalize_StaysFastOnAbusiveInputs()
    {
        var inputs = new[] { "Starter", "premium", "STANDARD", "../admin", "<script>alert(1)</script>", "Unknown", "Essentiel", "" };
        const int iterations = 100_000;
        const int budgetMs = 500;

        // Warmup
        foreach (var s in inputs) _ = PlanCatalog.Normalize(s);

        var sw = Stopwatch.StartNew();
        for (int i = 0; i < iterations; i++)
        {
            _ = PlanCatalog.Normalize(inputs[i % inputs.Length]);
        }
        sw.Stop();

        _output.WriteLine($"Normalize: {iterations} iter en {sw.ElapsedMilliseconds} ms");
        sw.ElapsedMilliseconds.Should().BeLessThan(budgetMs,
            "Normalize doit traiter même les inputs aberrants en O(1) — si lent, vérifier qu'aucune regex / parsing complexe n'a été introduit");
    }

    /// <summary>
    /// RefreshTokenHasher est appelé à chaque refresh (~1 fois par tab toutes les
    /// 15 minutes). 10k hashes ≈ pic d'usage sur le plus gros tenant. Budget large
    /// pour éviter le flake CI.
    /// </summary>
    [Fact]
    public void RefreshTokenHasher_HandlesHighThroughput()
    {
        const int iterations = 10_000;
        const int budgetMs = 1500; // 150 µs / hash max — SHA-256 + base64 nominalement ~5-10 µs.

        var token = "test-refresh-token-with-realistic-length-base64-encoded-xxxxxxxxxxxxxxxx";

        // Warmup
        for (int i = 0; i < 100; i++) _ = RefreshTokenHasher.Hash(token);

        var sw = Stopwatch.StartNew();
        for (int i = 0; i < iterations; i++)
        {
            _ = RefreshTokenHasher.Hash(token);
        }
        sw.Stop();

        _output.WriteLine($"RefreshTokenHasher.Hash: {iterations} iter en {sw.ElapsedMilliseconds} ms ({(double)sw.ElapsedMilliseconds * 1000 / iterations:F2} µs/call)");
        sw.ElapsedMilliseconds.Should().BeLessThan(budgetMs);
    }

    /// <summary>
    /// SuspiciousLoginToken : génération + validation HMAC. Budget calibré pour un
    /// déploiement où des milliers d'emails « tentative de connexion » peuvent
    /// déclencher des clicks rapides successifs.
    /// </summary>
    [Fact]
    public void SuspiciousLoginToken_RoundTrip_HandlesHighThroughput()
    {
        var cfg = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?> { ["Jwt:Key"] = "test-secret-key-with-enough-entropy" })
            .Build();
        var cache = new MemoryCache(new MemoryCacheOptions());
        var svc = new SuspiciousLoginTokenService(cfg, cache);

        const int iterations = 5_000;
        const int budgetMs = 2000; // 400 µs / round-trip max ; nominal ~30 µs.

        // Warmup
        for (int i = 0; i < 100; i++)
        {
            var t = svc.Generate("tenant", "U0");
            svc.TryValidate(t, out _, out _);
        }

        var sw = Stopwatch.StartNew();
        for (int i = 0; i < iterations; i++)
        {
            // Slug/uticod variés pour éviter la coalescence d'une éventuelle optimisation
            // de mémorisation (ce qui fausserait la mesure réelle).
            var token = svc.Generate($"tenant-{i % 100}", $"U{i:D5}");
            svc.TryValidate(token, out _, out _).Should().BeTrue();
        }
        sw.Stop();

        _output.WriteLine($"SuspiciousLoginToken generate+validate: {iterations} iter en {sw.ElapsedMilliseconds} ms ({(double)sw.ElapsedMilliseconds * 1000 / iterations:F2} µs/round-trip)");
        sw.ElapsedMilliseconds.Should().BeLessThan(budgetMs);
    }

    /// <summary>
    /// ComputeSupplementaryCount est lu par EmployeeBillingSyncService toutes les
    /// 24h sur N tenants. Calcul trivial — un O(N²) accidentel serait un drame.
    /// </summary>
    [Fact]
    public void PlanCatalog_ComputeSupplementaryCount_StaysConstantTime()
    {
        var plan = PlanCatalog.GetPlan("Premium")!;
        const int iterations = 1_000_000;
        const int budgetMs = 300;

        var sw = Stopwatch.StartNew();
        long acc = 0;
        for (int i = 0; i < iterations; i++)
        {
            acc += PlanCatalog.ComputeSupplementaryCount(plan, i % 1000);
        }
        sw.Stop();

        _output.WriteLine($"ComputeSupplementaryCount: {iterations} iter en {sw.ElapsedMilliseconds} ms (acc={acc})");
        sw.ElapsedMilliseconds.Should().BeLessThan(budgetMs);
    }
}
