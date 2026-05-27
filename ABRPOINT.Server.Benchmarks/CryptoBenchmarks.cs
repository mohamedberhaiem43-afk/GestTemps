using BenchmarkDotNet.Attributes;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Configuration;
using ABRPOINT.Server.Services;

namespace ABRPOINT.Server.Benchmarks;

/// <summary>
/// Benchmarks BenchmarkDotNet pour les primitives crypto chemin chaud :
///   • RefreshTokenHasher.Hash : SHA-256 sur chaque refresh JWT.
///   • SuspiciousLoginTokenService.Generate/Validate : HMAC-SHA256 sur
///     génération + vérification des liens "Ce n'était pas moi".
///
/// Ciblage : Hash ≈ 5-10 µs, HMAC round-trip ≈ 15-30 µs. Tout drift au-dessus
/// d'un ordre de grandeur signale un changement d'algo accidentel (ex : Argon2
/// par erreur, ou base64 multi-passes ajouté dans la pipeline).
/// </summary>
[MemoryDiagnoser]
[ShortRunJob]
public class CryptoBenchmarks
{
    private SuspiciousLoginTokenService _svc = null!;
    private string _preGeneratedToken = null!;
    private const string SampleToken = "test-refresh-token-with-realistic-length-base64-encoded-xxxxxxxxxxxxxxxx";

    [GlobalSetup]
    public void Setup()
    {
        var cfg = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?> { ["Jwt:Key"] = "bench-secret-key-with-enough-entropy" })
            .Build();
        _svc = new SuspiciousLoginTokenService(cfg, new MemoryCache(new MemoryCacheOptions()));
        _preGeneratedToken = _svc.Generate("bench-tenant", "U001");
    }

    [Benchmark]
    public string RefreshTokenHasher_Hash() => RefreshTokenHasher.Hash(SampleToken);

    [Benchmark]
    public string SuspiciousLogin_Generate() => _svc.Generate("tenant", "U001");

    [Benchmark]
    public bool SuspiciousLogin_Validate()
        => _svc.TryValidate(_preGeneratedToken, out _, out _);
}
