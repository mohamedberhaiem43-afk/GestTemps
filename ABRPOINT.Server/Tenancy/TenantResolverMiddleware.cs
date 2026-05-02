using ABRPOINT.Server.Services;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using System.Collections.Concurrent;

namespace ABRPOINT.Server.Tenancy;

/// <summary>
/// Résout le tenant pour la requête courante.
/// Source du slug, par ordre :
///   1. Header `X-Tenant-Slug` (utilisé en DEV pour tester sans configurer DNS local).
///   2. Sous-domaine du Host (acme.concorde.com → "acme").
///
/// Routes ignorées (control plane) : /api/signup, /api/stripe/webhook, /api/health, /api/master/*.
/// </summary>
public sealed class TenantResolverMiddleware
{
    private readonly RequestDelegate _next;
    private readonly ILogger<TenantResolverMiddleware> _log;

    public TenantResolverMiddleware(RequestDelegate next, ILogger<TenantResolverMiddleware> log)
    {
        _next = next;
        _log = log;
    }

    // Cache des tenants déjà migrés (in-place schema migrations) pour éviter de relancer
    // le check à chaque requête. Reset au redémarrage du process — acceptable car les
    // ALTER TABLE sont idempotents (vérifient sys.columns avant action).
    private static readonly ConcurrentDictionary<string, byte> _migratedTenants = new();

    private static readonly string[] BypassPrefixes = new[]
    {
        "/api/signup",
        "/api/stripe/webhook",
        "/api/health",
        "/api/master",
        "/api/auth",
        "/api/contact",
        "/swagger",
        "/api/uploads",
    };

    private static readonly string[] ReservedSubdomains = new[]
    {
        "www", "app", "api", "admin", "mail", "support", "billing", "status",
    };

    public async Task Invoke(HttpContext ctx, ITenantStore store, ICurrentTenant current, IConfiguration cfg, ITenantDbContextFactory dbFactory)
    {
        var path = ctx.Request.Path.Value ?? string.Empty;
        if (BypassPrefixes.Any(p => path.StartsWith(p, StringComparison.OrdinalIgnoreCase)))
        {
            await _next(ctx);
            return;
        }

        var slug = ResolveSlug(ctx, cfg);
        if (string.IsNullOrEmpty(slug) || ReservedSubdomains.Contains(slug))
        {
            // Pure-SaaS : tout /api/* hors bypass exige un tenant. Sans tenant, on rejette
            // ici plutôt que de laisser un controller résoudre ApplicationDbContext et
            // taper la base legacy 'ABRPOINT' (qui n'existe pas en mode SaaS).
            if (path.StartsWith("/api/", StringComparison.OrdinalIgnoreCase))
            {
                ctx.Response.StatusCode = StatusCodes.Status400BadRequest;
                await ctx.Response.WriteAsync("Tenant introuvable : sous-domaine ou en-tête X-Tenant-Slug requis.");
                return;
            }
            // Hors API (SPA, pages publiques) : on laisse passer.
            await _next(ctx);
            return;
        }

        var tenant = await store.FindBySlugAsync(slug, ctx.RequestAborted);
        if (tenant is null)
        {
            ctx.Response.StatusCode = StatusCodes.Status404NotFound;
            await ctx.Response.WriteAsync($"Tenant '{slug}' introuvable.");
            return;
        }

        // Tenant désactivé → bloquer l'accès aux endpoints applicatifs (sauf /api/billing/*).
        if (tenant.Status is "Suspended" or "Cancelled" or "Failed")
        {
            ctx.Response.StatusCode = StatusCodes.Status402PaymentRequired;
            await ctx.Response.WriteAsync($"Tenant '{slug}' désactivé (status={tenant.Status}).");
            return;
        }

        // Tenant inscrit avec un plan payant non confirmé : seul /api/billing/* est autorisé
        // pour permettre à l'utilisateur de finaliser le paiement Stripe. Sans ce garde-fou,
        // le cookie JWT posé au signup laisserait entrer dans /api/* avant tout encaissement.
        if (string.Equals(tenant.Status, "PendingPayment", StringComparison.OrdinalIgnoreCase)
            && path.StartsWith("/api/", StringComparison.OrdinalIgnoreCase)
            && !path.StartsWith("/api/billing/", StringComparison.OrdinalIgnoreCase))
        {
            ctx.Response.StatusCode = StatusCodes.Status402PaymentRequired;
            await ctx.Response.WriteAsync("Paiement requis. Finalisez votre abonnement avant d'accéder à l'application.");
            return;
        }

        // Si un JWT est présent et porte un claim tenant_slug, il doit matcher le subdomain courant.
        var claimSlug = ctx.User?.FindFirst("tenant_slug")?.Value;
        if (!string.IsNullOrEmpty(claimSlug) && !string.Equals(claimSlug, slug, StringComparison.OrdinalIgnoreCase))
        {
            _log.LogWarning("JWT tenant_slug={ClaimSlug} != subdomain={UrlSlug} → reject.", claimSlug, slug);
            ctx.Response.StatusCode = StatusCodes.Status401Unauthorized;
            return;
        }

        current.Set(tenant);
        try
        {
            // Migrations de schéma idempotentes (ajout de colonnes type parmodemp, expand vilcod/villib)
            // exécutées une fois par tenant et par process. Évite l'exception "Invalid column name"
            // sur les bases déployées avant l'ajout de la colonne.
            if (_migratedTenants.TryAdd(tenant.Slug, 1))
            {
                try
                {
                    await using var db = dbFactory.Create();
                    await BaseDataSchemaMigrator.MigrateAsync(db, ctx.RequestAborted);
                }
                catch (Exception migEx)
                {
                    // Ne bloque jamais la requête. On retire le slug du cache pour réessayer
                    // à la requête suivante si la migration a échoué (ex: race au boot).
                    _migratedTenants.TryRemove(tenant.Slug, out _);
                    _log.LogWarning(migEx, "Schema migration ignorée pour tenant {Slug} : {Msg}", tenant.Slug, migEx.Message);
                }
            }

            await _next(ctx);
        }
        finally
        {
            current.Clear();
        }
    }

    private static string? ResolveSlug(HttpContext ctx, IConfiguration cfg)
    {
        // 1. Header explicite (DEV / mobile / tests automatisés)
        if (ctx.Request.Headers.TryGetValue("X-Tenant-Slug", out var headerVal))
        {
            var v = headerVal.ToString().Trim().ToLowerInvariant();
            if (!string.IsNullOrEmpty(v)) return v;
        }

        // 2. Sous-domaine
        var rootDomain = cfg["Hosting:RootDomain"] ?? "concorde.com";
        var host = ctx.Request.Host.Host?.ToLowerInvariant() ?? string.Empty;
        if (host.EndsWith("." + rootDomain))
        {
            var slug = host.Substring(0, host.Length - rootDomain.Length - 1);
            // Ne pas autoriser les slugs multi-niveaux (ex: "foo.bar")
            return slug.Contains('.') ? null : slug;
        }
        return null;
    }
}
