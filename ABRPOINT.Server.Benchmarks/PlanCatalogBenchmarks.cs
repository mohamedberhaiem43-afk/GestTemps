using BenchmarkDotNet.Attributes;
using ABRPOINT.Server.Tenancy;

namespace ABRPOINT.Server.Benchmarks;

/// <summary>
/// Benchmarks BenchmarkDotNet pour les calculs PlanCatalog. Cible : <100 ns / call
/// pour toutes ces méthodes (calcul scalaire pur, pas d'allocation attendue).
/// </summary>
[MemoryDiagnoser]
[ShortRunJob] // 3 warmup × 5 measurement — assez précis sans bloquer 5 min
public class PlanCatalogBenchmarks
{
    private PlanDefinition _starter = null!;
    private PlanDefinition _standard = null!;
    private PlanDefinition _premium = null!;

    [GlobalSetup]
    public void Setup()
    {
        _starter = PlanCatalog.GetPlan("Starter")!;
        _standard = PlanCatalog.GetPlan("Standard")!;
        _premium = PlanCatalog.GetPlan("Premium")!;
    }

    [Benchmark]
    public string NormalizeCanonical() => PlanCatalog.Normalize("Premium");

    [Benchmark]
    public string NormalizeAlias() => PlanCatalog.Normalize("Essentiel");

    [Benchmark]
    public string NormalizeCaseSensitive() => PlanCatalog.Normalize("STANDARD");

    [Benchmark]
    public PlanDefinition? GetPlanKnown() => PlanCatalog.GetPlan("Standard");

    [Benchmark]
    public PlanDefinition? GetPlanUnknown() => PlanCatalog.GetPlan("DoesNotExist");

    [Benchmark]
    public decimal ComputeMonthlyTotal_NoOverage()
        => PlanCatalog.ComputeMonthlyTotal(_standard, employeeCount: 10);

    [Benchmark]
    public decimal ComputeMonthlyTotal_WithOverage()
        => PlanCatalog.ComputeMonthlyTotal(_standard, employeeCount: 50);

    [Benchmark]
    public int ComputeSupplementaryCount_Over()
        => PlanCatalog.ComputeSupplementaryCount(_premium, currentActiveCount: 200);

    [Benchmark]
    public int ComputeSupplementaryCount_Under()
        => PlanCatalog.ComputeSupplementaryCount(_premium, currentActiveCount: 5);
}
