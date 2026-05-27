using BenchmarkDotNet.Running;

namespace ABRPOINT.Server.Benchmarks;

/// <summary>
/// Entry point BenchmarkDotNet. Lance via :
///   <code>dotnet run -c Release --project ABRPOINT.Server.Benchmarks</code>
///
/// Sans argument : exécute toutes les classes [MemoryDiagnoser] du projet.
/// Avec filter : <c>dotnet run -c Release -- --filter *PlanCatalog*</c>
///
/// BenchmarkDotNet :
///   • Force la Release config et IL trimming pour mesures représentatives prod.
///   • Boucle de warmup + cycles de mesure pour stabiliser le JIT.
///   • Stats : Mean, Error, StdDev, P95, allocations GC, Gen0/Gen1/Gen2 collections.
///   • Output : BenchmarkDotNet.Artifacts/results/*.md (lisible en code-review).
///
/// Cette suite NE DOIT PAS être lancée dans le pipeline CI standard (trop lent) ;
/// elle sert au profiling local. Pour les garde-fous CI rapides, voir
/// <c>ABRPOINT.Server.Tests/Performance/HotPathPerformanceTests.cs</c>.
/// </summary>
public static class Program
{
    public static void Main(string[] args) =>
        BenchmarkSwitcher.FromAssembly(typeof(Program).Assembly).Run(args);
}
