using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace ABRPOINT.Server.Helpers;

/// <summary>
/// Audit S2 — vérifie au démarrage que les secrets critiques ne sont pas restés sur leurs
/// valeurs de placeholder. En production l'application <b>refuse de démarrer</b> si une
/// faiblesse est détectée ; en dev on log un avertissement structuré pour ne pas bloquer
/// les contributeurs locaux.
///
/// Convention .NET : tout `Section:Key` peut être surchargé via la variable d'environnement
/// `Section__Key` (double underscore). Le déploiement prod doit donc poser `Jwt__Key`,
/// `Stripe__SecretKey`, `Stripe__WebhookSecret`, `Gemini__ApiKey`, `OpenRouter__ApiKey`,
/// `Encryption__AesKey`, `Smtp__Password` (ou les valeurs équivalentes via vault).
/// </summary>
public static class SecretsValidator
{
    private record Secret(string Path, string DisplayName, string[] WeakValues, int MinLength);

    private static readonly Secret[] CriticalSecrets = new[]
    {
        new Secret("Jwt:Key", "JWT signing key", new[]
        {
            "This is a sample secret key - please don't use in production environment.'",
            "your-secret-key", "secret", "changeme", "todo",
        }, 32),
        new Secret("Encryption:AesKey", "AES encryption key", new[]
        {
            "G3stT3mps@2024!S3cur3K3y#Encr1pt10n",
        }, 16),
        new Secret("Stripe:SecretKey", "Stripe secret key", Array.Empty<string>(), 16),
        new Secret("Stripe:WebhookSecret", "Stripe webhook secret", Array.Empty<string>(), 16),
        new Secret("Gemini:ApiKey", "Gemini API key", Array.Empty<string>(), 8),
        new Secret("OpenRouter:ApiKey", "OpenRouter API key", Array.Empty<string>(), 8),
        new Secret("Smtp:Password", "SMTP password", new[] { "Concorde@2026!" }, 8),
    };

    public static void ValidateOrThrow(IConfiguration configuration, IHostEnvironment environment, ILogger logger)
    {
        var problems = new List<string>();

        foreach (var s in CriticalSecrets)
        {
            var value = configuration[s.Path];

            // Stripe en mode 'sk_test_' n'est pas critique en dev mais ne doit pas atterrir en prod.
            if (s.Path == "Stripe:SecretKey" && !string.IsNullOrEmpty(value) && value.StartsWith("sk_test_"))
            {
                if (environment.IsProduction())
                    problems.Add($"{s.DisplayName} : clé de TEST détectée en production ({s.Path}=sk_test_...).");
                else
                    logger.LogInformation("{Name} : clé de test (sk_test_) — OK en environnement {Env}.", s.DisplayName, environment.EnvironmentName);
                continue;
            }

            if (string.IsNullOrWhiteSpace(value))
            {
                if (environment.IsProduction())
                    problems.Add($"{s.DisplayName} ({s.Path}) est vide.");
                continue;
            }

            // SEC — Placeholders génériques (REPLACE_*, CHANGEME_*, TODO, etc.) :
            // n'importe quelle valeur de cette forme indique un secret non configuré.
            // Détection au-delà des WeakValues explicites du record.
            if (value.StartsWith("REPLACE_", StringComparison.OrdinalIgnoreCase)
                || value.StartsWith("CHANGEME", StringComparison.OrdinalIgnoreCase)
                || value.Equals("TODO", StringComparison.OrdinalIgnoreCase)
                || value.Equals("changeme", StringComparison.OrdinalIgnoreCase))
            {
                problems.Add($"{s.DisplayName} ({s.Path}) utilise un placeholder générique ({value.Substring(0, Math.Min(value.Length, 32))}...).");
                continue;
            }

            if (s.WeakValues.Any(w => string.Equals(w, value, StringComparison.Ordinal)))
            {
                problems.Add($"{s.DisplayName} ({s.Path}) utilise une valeur de placeholder connue.");
            }
            else if (value.Length < s.MinLength)
            {
                problems.Add($"{s.DisplayName} ({s.Path}) est trop court ({value.Length} caractères, minimum {s.MinLength}).");
            }
        }

        if (problems.Count == 0)
        {
            logger.LogInformation("Secrets validation OK ({Count} secrets vérifiés).", CriticalSecrets.Length);
            return;
        }

        if (environment.IsProduction())
        {
            // Fail-fast : on n'accepte pas qu'un déploiement prod parte avec des secrets faibles.
            // Le message liste tout ce qui est cassé pour qu'un seul redémarrage suffise à corriger.
            var combined = "Démarrage prod refusé : secrets faibles ou manquants détectés.\n  - "
                           + string.Join("\n  - ", problems)
                           + "\nDéfinissez les variables d'environnement correspondantes (ex: `Jwt__Key=...`).";
            logger.LogCritical(combined);
            throw new InvalidOperationException(combined);
        }

        // Dev : on n'interrompt pas le boot mais on rend les problèmes visibles.
        foreach (var p in problems)
            logger.LogWarning("[Secrets] {Problem}", p);
        logger.LogWarning(
            "[Secrets] {Count} secret(s) faible(s) tolérés en environnement '{Env}'. Définissez `Jwt__Key`, `Encryption__AesKey`, `Stripe__SecretKey`, etc. via env vars en production.",
            problems.Count, environment.EnvironmentName);
    }
}
