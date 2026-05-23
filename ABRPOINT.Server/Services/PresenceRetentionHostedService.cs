using ABRPOINT.Server.Data;
using ABRPOINT.Server.Tenancy;
using Microsoft.EntityFrameworkCore;

namespace ABRPOINT.Server.Services;

/// <summary>
/// RGPD Art. 5.1.e (limitation de la conservation) appliqué aux données de
/// pointage de la table <c>presence</c>. Clause 13.3 du contrat éditeur : le
/// client peut paramétrer ces durées via l'UI Admin → Rétention RGPD.
///
/// Deux étapes successives par tenant :
///
///   1) ANONYMISATION (par défaut > 365 j) — on vide les seuls champs libre
///      texte saisis par l'utilisateur (<c>preobs</c>) qui peuvent contenir
///      des notes nominatives ou contextuelles personnelles. Les agrégats
///      horaires (tothre, tothsup, tothnuit, totret) restent en base parce
///      qu'ils sont nécessaires à la paie, à l'historique d'analyse et aux
///      états légaux. La géolocalisation n'est PAS persistée en base (cf.
///      PresencesController : seul un LogInformation côté serveur).
///
///   2) SUPPRESSION DÉFINITIVE (par défaut > 1 825 j = 5 ans) — hard delete
///      des lignes au-delà de la durée légale de conservation des relevés
///      d'heures (article L3171-3 Code du travail français).
///
/// Multi-tenant : itère les tenants Active/Trialing depuis la master et
/// applique la politique du tenant (table retention_policy). Une base
/// indisponible est loggée mais ne bloque pas les autres.
/// </summary>
public sealed class PresenceRetentionHostedService : BackgroundService
{
    private static readonly TimeSpan Interval = TimeSpan.FromHours(24);

    // Planchers absolus, défense en profondeur : même si la table retention_policy
    // est corrompue ou contient des valeurs aberrantes, on ne descend jamais
    // en-dessous. 90 j = 1 cycle paie complet + retraitement ; 180 j = 6 mois
    // suffisants pour qu'un contrôle URSSAF/inspection puisse remonter à l'origine.
    private const int MinAnonymizeDays = 90;
    private const int MinDeleteDays = 180;

    private const int DefaultAnonymizeDays = 365;
    private const int DefaultDeleteDays = 1825;

    private readonly IServiceScopeFactory _scopeFactory;
    private readonly IConfiguration _cfg;
    private readonly ILogger<PresenceRetentionHostedService> _log;

    public PresenceRetentionHostedService(
        IServiceScopeFactory scopeFactory,
        IConfiguration cfg,
        ILogger<PresenceRetentionHostedService> log)
    {
        _scopeFactory = scopeFactory;
        _cfg = cfg;
        _log = log;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        try { await Task.Delay(TimeSpan.FromMinutes(3), stoppingToken); }
        catch (TaskCanceledException) { return; }

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                var summary = await PurgeAllTenantsAsync(stoppingToken);
                if (summary.Anonymized > 0 || summary.Deleted > 0)
                    _log.LogInformation(
                        "Presence retention: anonymisées={Anon} supprimées={Del} sur {Tenants} tenant(s).",
                        summary.Anonymized, summary.Deleted, summary.Tenants);
            }
            catch (OperationCanceledException) { break; }
            catch (Exception ex)
            {
                _log.LogError(ex, "Presence retention sweep failed.");
            }

            try { await Task.Delay(Interval, stoppingToken); }
            catch (TaskCanceledException) { break; }
        }
    }

    private async Task<Summary> PurgeAllTenantsAsync(CancellationToken ct)
    {
        var template = _cfg.GetConnectionString("TenantTemplate");
        var masterConnection = _cfg.GetConnectionString("MasterConnection");
        var defaultConn = _cfg.GetConnectionString("DefaultConnection");
        var summary = new Summary();

        if (!string.IsNullOrWhiteSpace(masterConnection) && !string.IsNullOrWhiteSpace(template))
        {
            using var scope = _scopeFactory.CreateScope();
            var masterFactory = scope.ServiceProvider.GetService<IDbContextFactory<MasterDbContext>>();
            if (masterFactory is null) return summary;
            await using var master = await masterFactory.CreateDbContextAsync(ct);
            var tenants = await master.Tenants
                .AsNoTracking()
                .Where(t => t.Status == "Active" || t.Status == "Trialing")
                .ToListAsync(ct);

            foreach (var t in tenants)
            {
                try
                {
                    var cs = template.Replace("{DbName}", t.DbName);
                    var partial = await PurgeOneAsync(cs, ct);
                    summary.Anonymized += partial.Anonymized;
                    summary.Deleted += partial.Deleted;
                    summary.Tenants++;
                }
                catch (Exception ex)
                {
                    _log.LogWarning(ex, "Presence retention tenant {Slug} échoué", t.Slug);
                }
            }
        }
        else if (!string.IsNullOrWhiteSpace(defaultConn))
        {
            var partial = await PurgeOneAsync(defaultConn, ct);
            summary.Anonymized = partial.Anonymized;
            summary.Deleted = partial.Deleted;
            summary.Tenants = 1;
        }

        return summary;
    }

    private async Task<Summary> PurgeOneAsync(string connStr, CancellationToken ct)
    {
        var options = new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseNpgsql(connStr, npg => npg.EnableRetryOnFailure())
            .Options;
        await using var db = new ApplicationDbContext(options);

        // Lecture des seuils paramétrés par le tenant. Fallback sur défauts si la
        // table n'existe pas encore ou si les valeurs stockées sont sous plancher.
        int anonymizeDays = DefaultAnonymizeDays;
        int deleteDays = DefaultDeleteDays;
        try
        {
            var p = await db.RetentionPolicies.AsNoTracking().FirstOrDefaultAsync(ct);
            if (p != null)
            {
                if (p.PresenceAnonymizeDays >= MinAnonymizeDays) anonymizeDays = p.PresenceAnonymizeDays;
                if (p.PresenceDeleteDays >= MinDeleteDays) deleteDays = p.PresenceDeleteDays;
            }
        }
        catch
        {
            // Table absente → fallbacks.
        }

        // Cohérence : la suppression doit venir après l'anonymisation. Si l'admin
        // a saisi un delete < anonymize (théoriquement bloqué par le controller),
        // on aligne defensively.
        if (deleteDays < anonymizeDays) deleteDays = anonymizeDays;

        var now = DateTime.UtcNow;
        var anonymizeCutoff = now.AddDays(-anonymizeDays);
        var deleteCutoff = now.AddDays(-deleteDays);

        // 1) Hard delete d'abord (sinon les lignes à supprimer seraient d'abord
        //    anonymisées en pure perte de I/O).
        var deleted = await db.Presences
            .Where(p => p.Predat != null && p.Predat < deleteCutoff)
            .ExecuteDeleteAsync(ct);

        // 2) Anonymisation : on cible les lignes entre anonymizeCutoff et
        //    deleteCutoff dont Preobs n'est pas encore vide. ExecuteUpdateAsync
        //    fait le SET ... WHERE ... côté serveur, sans charger les lignes.
        var anonymized = await db.Presences
            .Where(p => p.Predat != null
                     && p.Predat < anonymizeCutoff
                     && p.Predat >= deleteCutoff
                     && p.Preobs != null
                     && p.Preobs != "")
            .ExecuteUpdateAsync(s => s.SetProperty(p => p.Preobs, _ => null), ct);

        return new Summary { Anonymized = anonymized, Deleted = deleted };
    }

    private sealed class Summary
    {
        public int Tenants;
        public int Anonymized;
        public int Deleted;
    }
}
