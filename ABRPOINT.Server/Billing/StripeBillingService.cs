using ABRPOINT.Server.Services;
using ABRPOINT.Server.Tenancy;
using Microsoft.EntityFrameworkCore;
using Stripe;

namespace ABRPOINT.Server.Billing;

public sealed class StripeBillingService : IBillingService
{
    private readonly IDbContextFactory<MasterDbContext> _masterFactory;
    private readonly ITenantStore _store;
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly StripeOptions _opts;
    private readonly ILogger<StripeBillingService> _log;
    private readonly CustomerService _customers;
    private readonly SubscriptionService _subscriptions;

    public StripeBillingService(
        IDbContextFactory<MasterDbContext> masterFactory,
        ITenantStore store,
        IServiceScopeFactory scopeFactory,
        IConfiguration cfg,
        ILogger<StripeBillingService> log)
    {
        _masterFactory = masterFactory;
        _store = store;
        _scopeFactory = scopeFactory;
        _log = log;
        _opts = StripeOptions.Read(cfg);

        // Configure la clé secrète Stripe globalement pour les services SDK.
        if (!string.IsNullOrWhiteSpace(_opts.SecretKey))
            StripeConfiguration.ApiKey = _opts.SecretKey;

        _customers = new CustomerService();
        _subscriptions = new SubscriptionService();
    }

    public async Task<BillingProvisionResult> CreateCustomerAndTrialAsync(
        Tenant tenant,
        string? planCode,
        string? billingCycle,
        CancellationToken ct = default)
    {
        if (!_opts.IsConfigured)
        {
            _log.LogWarning("Stripe non configuré (clé manquante). Provisioning Stripe sauté pour tenant {Slug}.", tenant.Slug);
            return new BillingProvisionResult(null, null, tenant.TrialEndsAt, Skipped: true, SkipReason: "Stripe key missing");
        }

        // Idempotence : si le tenant a déjà un customer + subscription, on ne rejoue pas.
        if (!string.IsNullOrEmpty(tenant.StripeCustomerId) && !string.IsNullOrEmpty(tenant.StripeSubscriptionId))
        {
            return new BillingProvisionResult(tenant.StripeCustomerId, tenant.StripeSubscriptionId, tenant.TrialEndsAt, Skipped: true, SkipReason: "Already provisioned");
        }

        var customer = await _customers.CreateAsync(new CustomerCreateOptions
        {
            Email = tenant.AdminEmail,
            Name = tenant.CompanyName,
            Description = $"Tenant {tenant.Slug} ({tenant.Region})",
            Metadata = new Dictionary<string, string>
            {
                ["tenant_id"] = tenant.Id.ToString(),
                ["tenant_slug"] = tenant.Slug,
                ["tenant_db"] = tenant.DbName,
            }
        }, cancellationToken: ct);

        // Modèle V2 : 2 items par souscription — un forfait (base) + un seat metered (overage).
        // L'item seat est créé avec quantité 0 au signup (les premiers IncludedEmployees salariés
        // sont couverts par le forfait) et incrémenté plus tard par EmployeeBillingSync quand le
        // tenant dépasse l'inclus.
        var canonical = ABRPOINT.Server.Tenancy.PlanCatalog.Normalize(planCode);
        var basePriceId = ResolvePriceId(canonical, "base", billingCycle);
        var seatPriceId = ResolvePriceId(canonical, "seat", billingCycle);
        Subscription? subscription = null;
        if (!string.IsNullOrEmpty(basePriceId))
        {
            var items = new List<SubscriptionItemOptions> { new() { Price = basePriceId, Quantity = 1 } };
            if (!string.IsNullOrEmpty(seatPriceId))
            {
                items.Add(new SubscriptionItemOptions { Price = seatPriceId, Quantity = 0 });
            }
            subscription = await _subscriptions.CreateAsync(new SubscriptionCreateOptions
            {
                Customer = customer.Id,
                Items = items,
                TrialPeriodDays = _opts.TrialDays,
                PaymentBehavior = "default_incomplete",
                PaymentSettings = new SubscriptionPaymentSettingsOptions
                {
                    SaveDefaultPaymentMethod = "on_subscription",
                },
                Metadata = new Dictionary<string, string>
                {
                    ["tenant_slug"] = tenant.Slug,
                    ["plan"] = planCode ?? "Essentiel",
                    ["cycle"] = billingCycle ?? "monthly",
                }
            }, cancellationToken: ct);
        }
        else
        {
            _log.LogWarning("Aucun price_id Stripe résolu pour plan={Plan}/cycle={Cycle}. Subscription non créée.", planCode, billingCycle);
        }

        // Persiste les ids dans la master DB.
        await using var master = await _masterFactory.CreateDbContextAsync(ct);
        var managed = await master.Tenants.FirstOrDefaultAsync(t => t.Id == tenant.Id, ct);
        if (managed != null)
        {
            managed.StripeCustomerId = customer.Id;
            managed.StripeSubscriptionId = subscription?.Id;
            await master.SaveChangesAsync(ct);
            _store.Invalidate(managed.Slug);
        }

        return new BillingProvisionResult(customer.Id, subscription?.Id, tenant.TrialEndsAt, Skipped: false, SkipReason: null);
    }

    public async Task MarkActiveAsync(string stripeCustomerId, CancellationToken ct = default)
        => await UpdateStatusByCustomerIdAsync(stripeCustomerId, "Active", ct);

    public async Task MarkPastDueAsync(string stripeCustomerId, CancellationToken ct = default)
        => await UpdateStatusByCustomerIdAsync(stripeCustomerId, "PastDue", ct);

    public async Task SuspendAsync(string stripeCustomerId, CancellationToken ct = default)
        => await UpdateStatusByCustomerIdAsync(stripeCustomerId, "Suspended", ct);

    public async Task SendSubscriptionRenewalRemindersAsync(int daysBeforeEnd = 7, CancellationToken ct = default)
    {
        // Cherche les tenants Active (i.e. abonnement payant en cours) dont la fin de
        // période de facturation Stripe (CurrentPeriodEndsAt, alimenté par le webhook
        // customer.subscription.updated) tombe dans [J-daysBeforeEnd-1 .. J-daysBeforeEnd]
        // jours à partir de maintenant. Skip ceux qui ont déjà demandé la résiliation
        // (CancelAtPeriodEnd=true) — leur envoyer un rappel "paiement imminent" serait
        // contre-productif.
        //
        // Anti-doublon par CYCLE : on filtre les tenants dont SubscriptionRenewalReminderSentAt
        // est null OU clairement antérieur à la période courante. La règle "antérieur"
        // = sent < (CurrentPeriodEndsAt - 15j) capture le cas où le rappel a été envoyé
        // au cycle précédent (la période courante est nouvelle).
        var now = DateTime.UtcNow;
        var windowStart = now.AddDays(daysBeforeEnd - 1);
        var windowEnd = now.AddDays(daysBeforeEnd);

        await using var master = await _masterFactory.CreateDbContextAsync(ct);
        var candidates = await master.Tenants
            .Where(t => t.Status == "Active"
                        && t.CancelAtPeriodEnd != true
                        && t.CurrentPeriodEndsAt != null
                        && t.CurrentPeriodEndsAt >= windowStart
                        && t.CurrentPeriodEndsAt <= windowEnd
                        && (t.SubscriptionRenewalReminderSentAt == null
                            || t.SubscriptionRenewalReminderSentAt < t.CurrentPeriodEndsAt!.Value.AddDays(-15)))
            .ToListAsync(ct);

        if (candidates.Count == 0) return;

        foreach (var tenant in candidates)
        {
            try
            {
                await SendRenewalReminderForOneTenantAsync(tenant, daysBeforeEnd, ct);
                tenant.SubscriptionRenewalReminderSentAt = DateTime.UtcNow;
            }
            catch (Exception ex)
            {
                _log.LogWarning(ex, "Subscription renewal reminder failed for tenant {Slug}.", tenant.Slug);
            }
        }
        await master.SaveChangesAsync(ct);
        _log.LogInformation("SendSubscriptionRenewalReminders : {Count} tenant(s) notifié(s) (J-{Days}).", candidates.Count, daysBeforeEnd);
    }

    private async Task SendRenewalReminderForOneTenantAsync(Tenant tenant, int daysBeforeEnd, CancellationToken ct)
    {
        using var scope = _scopeFactory.CreateScope();
        var current = scope.ServiceProvider.GetService<ICurrentTenant>();
        if (current is null)
        {
            _log.LogWarning("ICurrentTenant indisponible : renewal reminder ignoré pour {Slug}.", tenant.Slug);
            return;
        }
        current.Set(tenant);

        var daysLabel = daysBeforeEnd == 1 ? "1 jour" : $"{daysBeforeEnd} jours";
        var title = "💳 Renouvellement de votre abonnement imminent";
        var body = $"Votre abonnement Concorde Workforce sera automatiquement reconduit dans {daysLabel}. " +
                   "Vérifiez que votre moyen de paiement est à jour pour éviter toute interruption.";
        var payload = new
        {
            type = "subscription_renewal",
            daysRemaining = daysBeforeEnd,
            currentPeriodEndsAt = tenant.CurrentPeriodEndsAt,
            planCode = tenant.PlanCode,
        };

        var notify = scope.ServiceProvider.GetService<IUserNotificationService>();
        if (notify is not null)
        {
            await notify.NotifyAdminsAsync(title, body, payload, ct);
            await notify.NotifyManagersAsync(title, body, payload, ct);
        }

        try
        {
            await SendRenewalReminderEmailAsync(scope, tenant, daysBeforeEnd, ct);
        }
        catch (Exception ex)
        {
            _log.LogWarning(ex, "Envoi email rappel renouvellement échoué pour {Slug} (best-effort).", tenant.Slug);
        }
    }

    private async Task SendRenewalReminderEmailAsync(IServiceScope scope, Tenant tenant, int daysBeforeEnd, CancellationToken ct)
    {
        var email = scope.ServiceProvider.GetService<Interfaces.IEmailService>();
        if (email is null) return;

        // Collecte recipients : même logique que SendTrialReminderEmailAsync.
        var recipients = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        if (!string.IsNullOrWhiteSpace(tenant.AdminEmail))
            recipients.Add(tenant.AdminEmail.Trim());

        try
        {
            var db = scope.ServiceProvider.GetService<Data.ApplicationDbContext>();
            if (db is not null)
            {
                var adminCode = ABRPOINT.Server.Authorization.PermissionCatalog.Roles.Administrator;
                var managerCode = ABRPOINT.Server.Authorization.PermissionCatalog.Roles.Manager;
                var staffEmails = await db.Utilisateurs.AsNoTracking()
                    .Where(u => !string.IsNullOrEmpty(u.Utimail)
                                && (u.Utiactif == null || (u.Utiactif != "0" && u.Utiactif != "Non"))
                                && (u.Utiadm == "1"
                                    || u.Utirole == adminCode
                                    || u.Utirole == managerCode
                                    || (u.Utirole != null && EF.Functions.ILike(u.Utirole, "%manager%"))))
                    .Select(u => u.Utimail!)
                    .ToListAsync(ct);
                foreach (var e in staffEmails)
                    if (!string.IsNullOrWhiteSpace(e)) recipients.Add(e.Trim());
            }
        }
        catch (Exception ex)
        {
            _log.LogWarning(ex, "Lecture emails admin/manager DB tenant échouée pour {Slug}.", tenant.Slug);
        }

        if (recipients.Count == 0)
        {
            _log.LogInformation("Aucun email admin/manager trouvé pour {Slug} — rappel renouvellement non envoyé.", tenant.Slug);
            return;
        }

        var endDateLabel = tenant.CurrentPeriodEndsAt?.ToString("dd MMMM yyyy",
            new System.Globalization.CultureInfo("fr-FR")) ?? "(date inconnue)";
        var subject = $"💳 Votre abonnement Concorde Workforce sera reconduit dans {daysBeforeEnd} jours";
        var bodyHtml = $@"<html><body style=""font-family:Segoe UI,Helvetica,Arial,sans-serif;color:#0f172a;line-height:1.6;max-width:600px;margin:0 auto;padding:24px"">
<h2 style=""color:#0040a1;margin:0 0 16px"">Bonjour,</h2>
<p>Votre abonnement <strong>Concorde Workforce</strong> sera automatiquement reconduit dans
<strong style=""color:#0040a1"">{daysBeforeEnd} jours</strong> (échéance le <strong>{endDateLabel}</strong>).</p>
<p>Pour que la reconduction se passe sans encombre, assurez-vous que votre moyen de paiement
est valide et que la limite carte est suffisante. En cas de défaillance, votre compte basculera
en <strong>PastDue</strong> et l'accès sera suspendu jusqu'à régularisation.</p>
<p style=""text-align:center;margin:24px 0"">
  <a href=""https://concorde-work-force.com/dashboard/mon-abonnement""
     style=""background:#0040a1;color:#fff;padding:12px 28px;border-radius:10px;text-decoration:none;font-weight:700;display:inline-block"">
    Gérer mon abonnement
  </a>
</p>
<p style=""background:#eff6ff;border:1px solid #bfdbfe;border-radius:10px;padding:14px;color:#1e3a8a;font-size:14px"">
  <strong>Vous ne souhaitez plus continuer ?</strong> Vous pouvez résilier depuis votre espace
  <em>Mon abonnement</em> avant la date d'échéance — l'accès reste actif jusqu'à la fin de la
  période en cours, aucun nouveau prélèvement ne sera effectué.
</p>
<p style=""color:#475569;font-size:14px"">Pack actuel : <strong>{System.Net.WebUtility.HtmlEncode(tenant.PlanCode ?? "—")}</strong> ·
Société : <strong>{System.Net.WebUtility.HtmlEncode(tenant.CompanyName ?? "—")}</strong></p>
<p style=""color:#94a3b8;font-size:12px;border-top:1px solid #e2e8f0;padding-top:16px;margin-top:24px"">
  Email automatique envoyé par Concorde Workforce. Pour toute question, répondez à cet email
  ou contactez le support.
</p>
</body></html>";

        foreach (var recipient in recipients)
        {
            try
            {
                await email.SendEmailAsync(recipient, subject, bodyHtml);
            }
            catch (Exception ex)
            {
                _log.LogWarning(ex, "Envoi renewal reminder à {Recipient} échoué pour {Slug}.", recipient, tenant.Slug);
            }
        }
    }

    public async Task SendTrialExpiryRemindersAsync(int daysBeforeEnd = 4, CancellationToken ct = default)
    {
        // Rappels fin d'essai à J-4, J-2 puis le jour J (J-0) : on cible les tenants
        // Trialing dont la fin d'essai tombe le JOUR CALENDAIRE « aujourd'hui + daysBeforeEnd ».
        //
        // Anti-doublon par JOUR (et non « une seule fois ») : l'ancien flag `== null`
        // n'autorisait qu'un seul rappel sur toute la durée de l'essai → impossible
        // d'enchaîner J-4 / J-2 / J-0. On ré-arme chaque jour via `TrialReminderSentAt < today`.
        // Comme les 3 offsets tombent sur 3 jours distincts, chacun part une fois ; et au
        // sein d'une même journée le sweep horaire ne renvoie pas (flag posé à aujourd'hui).
        // Avantage : aucune nouvelle colonne master DB nécessaire.
        var today = DateTime.UtcNow.Date;
        var targetDay = today.AddDays(daysBeforeEnd);
        var nextDay = targetDay.AddDays(1);

        await using var master = await _masterFactory.CreateDbContextAsync(ct);
        var candidates = await master.Tenants
            .Where(t => t.Status == "Trialing"
                        && t.TrialEndsAt != null
                        && t.TrialEndsAt >= targetDay
                        && t.TrialEndsAt < nextDay
                        && (t.TrialReminderSentAt == null || t.TrialReminderSentAt < today))
            .ToListAsync(ct);

        if (candidates.Count == 0) return;

        foreach (var tenant in candidates)
        {
            try
            {
                await SendReminderForOneTenantAsync(tenant, daysBeforeEnd, ct);
                tenant.TrialReminderSentAt = DateTime.UtcNow;
            }
            catch (Exception ex)
            {
                // Échec isolé d'un tenant ne doit pas bloquer le sweep. On laisse le flag
                // null pour retenter au prochain passage horaire (au pire on aura quelques
                // ré-essais avant que la fenêtre se referme).
                _log.LogWarning(ex, "Trial reminder failed for tenant {Slug}.", tenant.Slug);
            }
        }
        await master.SaveChangesAsync(ct);
        _log.LogInformation("SendTrialExpiryReminders : {Count} tenant(s) notifié(s) (J-{Days}).", candidates.Count, daysBeforeEnd);
    }

    /// <summary>
    /// Envoie le rappel "fin d'essai imminente" à tous les admins + managers d'un tenant.
    /// Triple canal :
    ///   1. Push mobile + in-app via <see cref="IUserNotificationService"/> (best-effort).
    ///   2. Email transactionnel explicite via <see cref="Interfaces.IEmailService"/> (garanti,
    ///      lit directement les Utimail des admins/managers dans la base tenant + l'AdminEmail
    ///      du tenant). Ajouté pour le J-10 où l'utilisateur peut être déconnecté de l'app et
    ///      ne pas voir le push — le mail reste l'unique canal fiable de notification.
    /// On bascule le tenant courant via <see cref="ICurrentTenant"/> avant de créer le scope DI
    /// pour que l'<c>ApplicationDbContext</c> pointe sur la bonne base.
    /// </summary>
    private async Task SendReminderForOneTenantAsync(Tenant tenant, int daysBeforeEnd, CancellationToken ct)
    {
        using var scope = _scopeFactory.CreateScope();
        var current = scope.ServiceProvider.GetService<ICurrentTenant>();
        if (current is null)
        {
            _log.LogWarning("ICurrentTenant indisponible : reminder ignoré pour {Slug}.", tenant.Slug);
            return;
        }
        current.Set(tenant);

        var whenLabel = daysBeforeEnd == 0 ? "aujourd'hui"
                      : daysBeforeEnd == 1 ? "dans 1 jour"
                      : $"dans {daysBeforeEnd} jours";
        var title = daysBeforeEnd == 0 ? "⏰ Votre essai se termine aujourd'hui" : "⏰ Fin d'essai imminente";
        var body = $"Votre période d'essai gratuite Concorde Workforce se termine {whenLabel}. " +
                   "Finalisez votre paiement Stripe pour continuer sans interruption.";
        var payload = new
        {
            type = "trial_expiry",
            daysRemaining = daysBeforeEnd,
            trialEndsAt = tenant.TrialEndsAt,
            planCode = tenant.PlanCode,
        };

        // 1) Canal push + in-app (best-effort).
        var notify = scope.ServiceProvider.GetService<IUserNotificationService>();
        if (notify is not null)
        {
            await notify.NotifyAdminsAsync(title, body, payload, ct);
            await notify.NotifyManagersAsync(title, body, payload, ct);
        }

        // 2) Canal email explicite (garanti) — collecte de tous les emails admin/manager
        //    de la base tenant + AdminEmail master.
        try
        {
            await SendTrialReminderEmailAsync(scope, tenant, daysBeforeEnd, ct);
        }
        catch (Exception ex)
        {
            _log.LogWarning(ex, "Envoi email rappel fin d'essai échoué pour {Slug} (best-effort).", tenant.Slug);
        }
    }

    /// <summary>
    /// Envoie un email transactionnel à TOUS les admins + managers du tenant pour annoncer
    /// la fin d'essai imminente. Recipients :
    ///   - tenant.AdminEmail (déclaré au signup, stocké en master DB)
    ///   - Tous les Utilisateurs.Utimail dont le rôle est Admin/Manager dans la base tenant
    /// Doublons supprimés. Si aucun email n'est trouvé, log et abandon silencieux.
    /// </summary>
    private async Task SendTrialReminderEmailAsync(IServiceScope scope, Tenant tenant, int daysBeforeEnd, CancellationToken ct)
    {
        var email = scope.ServiceProvider.GetService<Interfaces.IEmailService>();
        if (email is null) return;

        var recipients = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        if (!string.IsNullOrWhiteSpace(tenant.AdminEmail))
            recipients.Add(tenant.AdminEmail.Trim());

        // Collecte les emails admin/manager côté tenant DB. ApplicationDbContext est scoped
        // et résolu via le tenant courant qu'on vient de Set() (cf. SendReminderForOneTenantAsync).
        try
        {
            var db = scope.ServiceProvider.GetService<Data.ApplicationDbContext>();
            if (db is not null)
            {
                var adminCode = ABRPOINT.Server.Authorization.PermissionCatalog.Roles.Administrator;
                var managerCode = ABRPOINT.Server.Authorization.PermissionCatalog.Roles.Manager;
                var staffEmails = await db.Utilisateurs.AsNoTracking()
                    .Where(u => !string.IsNullOrEmpty(u.Utimail)
                                && (u.Utiactif == null || (u.Utiactif != "0" && u.Utiactif != "Non"))
                                && (u.Utiadm == "1"
                                    || u.Utirole == adminCode
                                    || u.Utirole == managerCode
                                    || (u.Utirole != null && EF.Functions.ILike(u.Utirole, "%manager%"))))
                    .Select(u => u.Utimail!)
                    .ToListAsync(ct);
                foreach (var e in staffEmails)
                    if (!string.IsNullOrWhiteSpace(e)) recipients.Add(e.Trim());
            }
        }
        catch (Exception ex)
        {
            // Si la base tenant n'est pas accessible (ex: tenant tout juste provisionné), on
            // continue avec l'AdminEmail uniquement — c'est l'unique recipient garanti côté master.
            _log.LogWarning(ex, "Lecture emails admin/manager DB tenant échouée pour {Slug}.", tenant.Slug);
        }

        if (recipients.Count == 0)
        {
            _log.LogInformation("Aucun email admin/manager trouvé pour {Slug} — rappel email non envoyé.", tenant.Slug);
            return;
        }

        var endDateLabel = tenant.TrialEndsAt?.ToString("dd MMMM yyyy",
            new System.Globalization.CultureInfo("fr-FR")) ?? "(date inconnue)";
        var whenText = daysBeforeEnd == 0 ? "aujourd'hui"
                     : daysBeforeEnd == 1 ? "dans 1 jour"
                     : $"dans {daysBeforeEnd} jours";
        var subject = daysBeforeEnd == 0
            ? "⏰ Votre essai Concorde Workforce se termine aujourd'hui"
            : $"⏰ Votre essai Concorde Workforce se termine dans {daysBeforeEnd} jours";
        var bodyHtml = $@"<html><body style=""font-family:Segoe UI,Helvetica,Arial,sans-serif;color:#0f172a;line-height:1.6;max-width:600px;margin:0 auto;padding:24px"">
<h2 style=""color:#0040a1;margin:0 0 16px"">Bonjour,</h2>
<p>Votre période d'essai gratuite de <strong>Concorde Workforce</strong> arrive à son terme
<strong style=""color:#dc2626"">{whenText}</strong> (fin prévue le <strong>{endDateLabel}</strong>).</p>
<p>Pour <strong>conserver vos données</strong> (employés, pointages, contrats, documents du coffre-fort…)
et continuer à utiliser la plateforme sans interruption, finalisez dès maintenant votre abonnement :</p>
<p style=""text-align:center;margin:24px 0"">
  <a href=""https://concorde-work-force.com/dashboard/mon-abonnement""
     style=""background:#0040a1;color:#fff;padding:12px 28px;border-radius:10px;text-decoration:none;font-weight:700;display:inline-block"">
    Finaliser mon abonnement
  </a>
</p>
<p style=""background:#fef2f2;border:1px solid #fecaca;border-radius:10px;padding:14px;color:#7f1d1d;font-size:14px"">
  <strong>⚠ Attention :</strong> à la fin de l'essai, sans paiement, votre compte sera suspendu.
  <strong>Toutes vos données seront définitivement supprimées</strong> 90 jours après la résiliation,
  conformément à notre politique de rétention RGPD.
</p>
<p style=""color:#475569;font-size:14px"">Pack actuel : <strong>{System.Net.WebUtility.HtmlEncode(tenant.PlanCode ?? "—")}</strong> ·
Société : <strong>{System.Net.WebUtility.HtmlEncode(tenant.CompanyName ?? "—")}</strong></p>
<p style=""color:#94a3b8;font-size:12px;border-top:1px solid #e2e8f0;padding-top:16px;margin-top:24px"">
  Email automatique envoyé par Concorde Workforce. Pour toute question, répondez à cet email
  ou contactez le support.
</p>
</body></html>";

        foreach (var recipient in recipients)
        {
            try
            {
                await email.SendEmailAsync(recipient, subject, bodyHtml);
            }
            catch (Exception ex)
            {
                _log.LogWarning(ex, "Envoi email rappel essai échoué pour destinataire {Email} ({Slug}).", recipient, tenant.Slug);
            }
        }
        _log.LogInformation("Rappel email fin d'essai envoyé à {Count} destinataire(s) pour {Slug}.", recipients.Count, tenant.Slug);
    }

    public async Task<CancellationResult> CancelSubscriptionAsync(
        Tenant tenant,
        bool immediate,
        string? reason,
        CancellationToken ct = default)
    {
        if (!_opts.IsConfigured)
        {
            return new CancellationResult(false, immediate, null, "Stripe non configuré.");
        }
        if (string.IsNullOrEmpty(tenant.StripeSubscriptionId))
        {
            // Pas de subscription Stripe → on bascule juste l'état tenant (cas trial non
            // provisionné ou tenant dev sans Stripe). Considéré comme un succès immédiat.
            await SetTenantCancelledAsync(tenant.Id, ct);
            return new CancellationResult(true, true, DateTime.UtcNow, null);
        }

        try
        {
            if (immediate)
            {
                // Récupère la subscription avec items.price expanded pour détecter la périodicité.
                // Politique commerciale : un abonnement ANNUEL résilié en cours de période donne
                // droit à un remboursement prorata temporis du temps non consommé (engagement
                // d'un an payé d'avance → restitution équitable). Un abonnement MENSUEL ne donne
                // pas droit à remboursement (usage SaaS B2B standard, le mois en cours est dû).
                Subscription subscription;
                try
                {
                    subscription = await _subscriptions.GetAsync(
                        tenant.StripeSubscriptionId,
                        new SubscriptionGetOptions
                        {
                            Expand = new List<string> { "items.data.price" },
                        },
                        cancellationToken: ct);
                }
                catch (StripeException ex) when (ex.HttpStatusCode == System.Net.HttpStatusCode.NotFound)
                {
                    // Subscription déjà supprimée côté Stripe (retry idempotent ou race avec webhook
                    // subscription.deleted). On considère la résiliation effective.
                    await SetTenantCancelledAsync(tenant.Id, ct);
                    return new CancellationResult(true, true, DateTime.UtcNow, null);
                }

                var isAnnual = IsAnnualSubscription(subscription);

                // Résiliation immédiate : on annule Stripe (le webhook customer.subscription.deleted
                // sera reçu et déclenchera SuspendAsync → mais on force Cancelled tout de suite
                // pour que l'admin perçoive la résiliation sans attendre le round-trip webhook).
                // Prorate/InvoiceNow restent false : on gère le remboursement nous-mêmes via
                // Refund API pour que l'argent revienne sur la CB du client (et non en crédit
                // sur la balance Stripe qui ne serait restitué qu'au prochain paiement — or il
                // n'y en aura pas après résiliation).
                await _subscriptions.CancelAsync(
                    tenant.StripeSubscriptionId,
                    new SubscriptionCancelOptions
                    {
                        InvoiceNow = false,
                        Prorate = false,
                    },
                    cancellationToken: ct);

                decimal refundedMajor = 0;
                string? refundCurrency = null;
                if (isAnnual)
                {
                    try
                    {
                        (refundedMajor, refundCurrency) = await IssueProratedRefundAsync(subscription, ct);
                    }
                    catch (StripeException refundEx)
                    {
                        // La résiliation reste effective même si le remboursement échoue. Le support
                        // traitera le remboursement manuellement via le Dashboard Stripe — on log
                        // suffisamment d'info pour retracer la facture concernée.
                        _log.LogError(refundEx,
                            "Remboursement prorata échoué pour tenant {Slug} (subscription={SubId}). " +
                            "Code Stripe={Code}. À traiter manuellement via Dashboard.",
                            tenant.Slug, tenant.StripeSubscriptionId, refundEx.StripeError?.Code);
                    }
                }

                await SetTenantCancelledAsync(tenant.Id, ct);
                _log.LogInformation(
                    "Tenant {Slug} : résiliation immédiate effectuée (subscription={SubId}, annual={Annual}, refunded={Refunded} {Cur}).",
                    tenant.Slug, tenant.StripeSubscriptionId, isAnnual, refundedMajor, refundCurrency ?? "-");
                return new CancellationResult(
                    Success: true,
                    Immediate: true,
                    EffectiveAt: DateTime.UtcNow,
                    ErrorMessage: null,
                    Prorated: isAnnual && refundedMajor > 0,
                    RefundedAmount: refundedMajor > 0 ? refundedMajor : (decimal?)null,
                    RefundCurrency: refundCurrency);
            }
            else
            {
                // Résiliation planifiée : Stripe gère la date de fin via cancel_at_period_end.
                // current_period_end est lu pour informer l'UI ("Accès jusqu'au …").
                var updated = await _subscriptions.UpdateAsync(
                    tenant.StripeSubscriptionId,
                    new SubscriptionUpdateOptions
                    {
                        CancelAtPeriodEnd = true,
                        CancellationDetails = new SubscriptionCancellationDetailsOptions
                        {
                            Comment = string.IsNullOrWhiteSpace(reason) ? null : reason,
                        },
                    },
                    cancellationToken: ct);

                DateTime? effectiveAt = updated.CurrentPeriodEnd != default
                    ? updated.CurrentPeriodEnd
                    : (updated.CancelAt != default ? updated.CancelAt : (DateTime?)null);

                await SetTenantScheduledCancellationAsync(tenant.Id, effectiveAt, ct);
                _log.LogInformation("Tenant {Slug} : résiliation planifiée en fin de période ({End}).",
                    tenant.Slug, effectiveAt);
                return new CancellationResult(true, false, effectiveAt, null);
            }
        }
        catch (StripeException ex)
        {
            _log.LogError(ex, "Échec de résiliation Stripe pour tenant {Slug}. Code={Code}",
                tenant.Slug, ex.StripeError?.Code);
            return new CancellationResult(false, immediate, null,
                "Stripe a refusé la résiliation. Réessayez plus tard ou contactez le support.");
        }
    }

    public async Task<PlanChangePreview> PreviewPlanChangeAsync(
        Tenant tenant,
        string newPlanCode,
        string billingCycle,
        int billedSeats,
        CancellationToken ct = default)
    {
        var canonicalNew = ABRPOINT.Server.Tenancy.PlanCatalog.Normalize(newPlanCode);
        var newPlan = ABRPOINT.Server.Tenancy.PlanCatalog.GetPlan(canonicalNew);
        if (newPlan == null)
            return new PlanChangePreview(false, tenant.PlanCode ?? "", newPlanCode,
                null, null, null, null, "Plan inconnu.");

        if (!_opts.IsConfigured)
            return new PlanChangePreview(false, tenant.PlanCode ?? "", canonicalNew,
                null, null, null, null, "Stripe non configuré.");

        if (string.IsNullOrEmpty(tenant.StripeSubscriptionId))
            return new PlanChangePreview(false, tenant.PlanCode ?? "", canonicalNew,
                null, null, null, null, "Aucun abonnement Stripe actif (passez par /checkout).");

        if (string.Equals(canonicalNew, ABRPOINT.Server.Tenancy.PlanCatalog.Normalize(tenant.PlanCode), StringComparison.OrdinalIgnoreCase))
            return new PlanChangePreview(false, tenant.PlanCode ?? "", canonicalNew,
                null, null, null, null, "Vous êtes déjà sur ce plan.");

        var newBasePriceId = ResolvePriceId(canonicalNew, "base", billingCycle);
        var newSeatPriceId = ResolvePriceId(canonicalNew, "seat", billingCycle);
        if (string.IsNullOrEmpty(newBasePriceId))
            return new PlanChangePreview(false, tenant.PlanCode ?? "", canonicalNew,
                null, null, null, null, "Prix Stripe manquant pour ce plan.");

        try
        {
            // On reconstruit le mapping (base, seat) → (item.Id existant) pour pouvoir muter
            // en place sans créer de nouveaux items orphelins. Sans l'expand items.data.price,
            // Stripe ne renvoie pas le Recurring.Interval ni le metadata du Price.
            var sub = await _subscriptions.GetAsync(
                tenant.StripeSubscriptionId,
                new SubscriptionGetOptions { Expand = new List<string> { "items.data.price" } },
                cancellationToken: ct);

            var proposedItems = BuildProposedItems(sub, newPlan, newBasePriceId, newSeatPriceId, billedSeats);

            // InvoiceService.UpcomingAsync simule la prochaine facture comme si la sub avait
            // déjà été update avec ces items + proration. Sans cet endpoint, on devrait
            // calculer le proration à la main (durée restante × différentiel) — fragile.
            var invoiceService = new InvoiceService();
            var upcoming = await invoiceService.UpcomingAsync(new UpcomingInvoiceOptions
            {
                Customer = tenant.StripeCustomerId,
                Subscription = tenant.StripeSubscriptionId,
                SubscriptionItems = proposedItems
                    .Select(i => new InvoiceSubscriptionItemOptions
                    {
                        Id = i.Id,
                        Price = i.Price,
                        Quantity = i.Quantity,
                        Deleted = i.Deleted,
                    })
                    .ToList(),
                SubscriptionProrationBehavior = "create_prorations",
                SubscriptionProrationDate = DateTime.UtcNow,
            }, cancellationToken: ct);

            // Proration = somme des lignes proration (positives = à facturer, négatives = crédit).
            // Le reste = lignes du nouveau cycle qui sont reproduites sur l'upcoming. On les exclut.
            var prorationMinor = upcoming.Lines?.Data?
                .Where(l => l.Proration)
                .Sum(l => l.Amount) ?? 0;

            return new PlanChangePreview(
                Available: true,
                CurrentPlan: ABRPOINT.Server.Tenancy.PlanCatalog.Normalize(tenant.PlanCode),
                NewPlan: canonicalNew,
                ProrationAmount: prorationMinor / 100m,
                Currency: upcoming.Currency,
                NextInvoiceAt: upcoming.PeriodEnd != default ? upcoming.PeriodEnd : (DateTime?)null,
                NextInvoiceTotal: upcoming.AmountDue / 100m,
                UnavailableReason: null);
        }
        catch (StripeException ex)
        {
            _log.LogWarning(ex,
                "Preview plan change : simulation Stripe indisponible pour {Slug}. Code={Code} → estimation locale.",
                tenant.Slug, ex.StripeError?.Code);

            // `resource_missing` (et toute autre erreur Stripe) = la subscription/customer/price
            // référencés n'existent pas dans le compte Stripe actif — typiquement un décalage
            // test/live ou des price_id hérités d'un autre compte. Plutôt qu'un échec rouge dans
            // l'UI, on renvoie une ESTIMATION LOCALE depuis PlanCatalog : la variation MENSUELLE
            // récurrente entre l'ancien et le nouveau pack pour le cycle choisi (incluant l'overage
            // sièges). Le différentiel proraté EXACT reste calculé par Stripe à la validation.
            var curPlan = ABRPOINT.Server.Tenancy.PlanCatalog.GetPlan(
                ABRPOINT.Server.Tenancy.PlanCatalog.Normalize(tenant.PlanCode));
            var isAnnual = string.Equals(billingCycle, "annual", StringComparison.OrdinalIgnoreCase);
            decimal PlanMonthly(ABRPOINT.Server.Tenancy.PlanDefinition? p)
                => p == null ? 0m : (isAnnual ? p.FlatPriceAnnualMonthlyEur : p.FlatPriceMonthlyEur);

            var newSeatsOver = System.Math.Max(0, billedSeats - newPlan.IncludedEmployees);
            var newMonthly = PlanMonthly(newPlan) + newSeatsOver * newPlan.OverageRatePerEmployeeEur;
            var curSeatsOver = curPlan == null ? 0 : System.Math.Max(0, billedSeats - curPlan.IncludedEmployees);
            var curMonthly = PlanMonthly(curPlan) + (curPlan?.OverageRatePerEmployeeEur ?? 0m) * curSeatsOver;

            return new PlanChangePreview(
                Available: true,
                CurrentPlan: ABRPOINT.Server.Tenancy.PlanCatalog.Normalize(tenant.PlanCode),
                NewPlan: canonicalNew,
                ProrationAmount: newMonthly - curMonthly,
                Currency: "eur",
                NextInvoiceAt: null,
                NextInvoiceTotal: newMonthly,
                UnavailableReason: null,
                Estimated: true,
                Note: "Estimation indicative (variation mensuelle). Le montant proraté exact sera confirmé par Stripe à la validation.");
        }
    }

    public async Task<ChangePlanResult> ChangePlanAsync(
        Tenant tenant,
        string newPlanCode,
        string billingCycle,
        int billedSeats,
        CancellationToken ct = default)
    {
        var canonicalNew = ABRPOINT.Server.Tenancy.PlanCatalog.Normalize(newPlanCode);
        var newPlan = ABRPOINT.Server.Tenancy.PlanCatalog.GetPlan(canonicalNew);
        if (newPlan == null)
            return new ChangePlanResult(false, tenant.PlanCode, newPlanCode, null, null, null, "Plan inconnu.");

        if (!_opts.IsConfigured)
            return new ChangePlanResult(false, tenant.PlanCode, canonicalNew, null, null, null, "Stripe non configuré.");

        if (string.IsNullOrEmpty(tenant.StripeSubscriptionId))
            return new ChangePlanResult(false, tenant.PlanCode, canonicalNew, null, null, null,
                "Aucun abonnement actif. Lancez un Stripe Checkout pour ce plan.");

        if (string.Equals(canonicalNew, ABRPOINT.Server.Tenancy.PlanCatalog.Normalize(tenant.PlanCode), StringComparison.OrdinalIgnoreCase))
            return new ChangePlanResult(false, tenant.PlanCode, canonicalNew, null, null, null, "Vous êtes déjà sur ce plan.");

        var newBasePriceId = ResolvePriceId(canonicalNew, "base", billingCycle);
        var newSeatPriceId = ResolvePriceId(canonicalNew, "seat", billingCycle);
        if (string.IsNullOrEmpty(newBasePriceId))
            return new ChangePlanResult(false, tenant.PlanCode, canonicalNew, null, null, null,
                "Prix Stripe manquant pour ce plan.");

        try
        {
            var sub = await _subscriptions.GetAsync(
                tenant.StripeSubscriptionId,
                new SubscriptionGetOptions { Expand = new List<string> { "items.data.price" } },
                cancellationToken: ct);

            var proposedItems = BuildProposedItems(sub, newPlan, newBasePriceId, newSeatPriceId, billedSeats);

            // proration_behavior=create_prorations : Stripe AJOUTE les lignes de proration à
            // la prochaine facture régulière (pas de prélèvement immédiat). Alternative
            // "always_invoice" facture tout de suite — on l'évite pour éviter une fenêtre
            // de paiement qui peut échouer (3DS, fonds insuffisants…) entre l'admin qui
            // clique et la confirmation Stripe.
            var idempotencyKey = ComputePlanChangeIdempotencyKey(tenant.Id, canonicalNew, billingCycle, billedSeats);

            var updated = await _subscriptions.UpdateAsync(
                tenant.StripeSubscriptionId,
                new SubscriptionUpdateOptions
                {
                    Items = proposedItems,
                    ProrationBehavior = "create_prorations",
                    ProrationDate = DateTime.UtcNow,
                    Metadata = new Dictionary<string, string>
                    {
                        ["plan"] = canonicalNew,
                        ["cycle"] = (billingCycle ?? "monthly").ToLowerInvariant(),
                        ["last_change_at"] = DateTime.UtcNow.ToString("o", System.Globalization.CultureInfo.InvariantCulture),
                    },
                },
                new RequestOptions { IdempotencyKey = idempotencyKey },
                cancellationToken: ct);

            // On lit la facture upcoming une seconde fois POUR EXTRAIRE le net du proration,
            // qui n'est pas renvoyé directement par Subscription.UpdateAsync. Coût : 1 appel
            // API en plus, mais ça permet de renvoyer un montant chiffré à l'UI ("différentiel
            // de 18.40€ ajouté à votre prochaine facture du 12 juin").
            decimal? netMajor = null;
            string? currency = null;
            DateTime? nextInvoiceAt = null;
            try
            {
                var invoiceService = new InvoiceService();
                var upcoming = await invoiceService.UpcomingAsync(new UpcomingInvoiceOptions
                {
                    Customer = tenant.StripeCustomerId,
                    Subscription = tenant.StripeSubscriptionId,
                }, cancellationToken: ct);
                var prorationMinor = upcoming.Lines?.Data?
                    .Where(l => l.Proration)
                    .Sum(l => l.Amount) ?? 0;
                netMajor = prorationMinor / 100m;
                currency = upcoming.Currency;
                nextInvoiceAt = upcoming.PeriodEnd != default ? upcoming.PeriodEnd : (DateTime?)null;
            }
            catch (StripeException ex)
            {
                // Le change a réussi ; on n'a juste pas pu lire la preview après. Log et continue.
                _log.LogWarning(ex,
                    "ChangePlan : update OK mais lecture upcoming invoice échouée pour {Slug}.",
                    tenant.Slug);
            }

            // Mise à jour locale du Tenant.PlanCode. Le webhook customer.subscription.updated
            // pourrait faire ça aussi, mais on le fait synchrone ici pour que la prochaine
            // requête voit le bon PlanCode (sinon fenêtre 1-10s où l'UI affiche encore l'ancien).
            var previousPlan = tenant.PlanCode;
            await using (var master = await _masterFactory.CreateDbContextAsync(ct))
            {
                var managed = await master.Tenants.FirstOrDefaultAsync(t => t.Id == tenant.Id, ct);
                if (managed != null)
                {
                    managed.PlanCode = canonicalNew;
                    if (updated.CurrentPeriodEnd != default) managed.CurrentPeriodEndsAt = updated.CurrentPeriodEnd;
                    await master.SaveChangesAsync(ct);
                    _store.Invalidate(managed.Slug);
                }
            }

            _log.LogInformation(
                "Tenant {Slug} : plan {Prev} → {Next} (subscription={SubId}, proration={Net} {Cur}).",
                tenant.Slug, previousPlan, canonicalNew, tenant.StripeSubscriptionId, netMajor, currency ?? "-");

            return new ChangePlanResult(
                Success: true,
                PreviousPlan: previousPlan,
                NewPlan: canonicalNew,
                NetAmountOnNextInvoice: netMajor,
                Currency: currency,
                NextInvoiceAt: nextInvoiceAt,
                ErrorMessage: null);
        }
        catch (StripeException ex)
        {
            _log.LogError(ex, "ChangePlan Stripe échoué pour tenant {Slug}. Code={Code}",
                tenant.Slug, ex.StripeError?.Code);
            return new ChangePlanResult(false, tenant.PlanCode, canonicalNew, null, null, null,
                "Stripe a refusé le changement de plan. Réessayez plus tard ou contactez le support.");
        }
    }

    /// <summary>
    /// Construit la liste d'items à passer à Subscription.UpdateAsync (et à
    /// Invoice.UpcomingAsync). On mute IN PLACE les items existants (Id préservé) pour
    /// changer leur Price et Quantity sans en créer de nouveaux ni orphelinser les
    /// anciens. Les items présents dans la subscription mais absents du nouveau plan
    /// sont marqués Deleted=true.
    /// </summary>
    private static List<SubscriptionItemOptions> BuildProposedItems(
        Subscription sub,
        ABRPOINT.Server.Tenancy.PlanDefinition newPlan,
        string newBasePriceId,
        string? newSeatPriceId,
        int billedSeats)
    {
        var existingItems = sub.Items?.Data ?? new List<SubscriptionItem>();
        // Heuristique : on identifie les items existants par recurring usage_type / interval
        // n'est pas disponible — on s'appuie sur l'ordre commercial historique (1er item = base,
        // 2e = seat). Plus robuste : inspecter le nom du price ou un metadata, mais le modèle
        // V2 garantit que toutes les subs créées via CreateCustomerAndTrialAsync ont items[0]=base
        // et items[1]=seat (cf. ce fichier l. 80-83).
        var baseItem = existingItems.FirstOrDefault();
        var seatItem = existingItems.Skip(1).FirstOrDefault();

        var newSeatQty = Math.Max(0, billedSeats - newPlan.IncludedEmployees);

        var result = new List<SubscriptionItemOptions>();
        if (baseItem != null)
            result.Add(new SubscriptionItemOptions { Id = baseItem.Id, Price = newBasePriceId, Quantity = 1 });
        else
            result.Add(new SubscriptionItemOptions { Price = newBasePriceId, Quantity = 1 });

        if (!string.IsNullOrEmpty(newSeatPriceId))
        {
            if (seatItem != null)
                result.Add(new SubscriptionItemOptions { Id = seatItem.Id, Price = newSeatPriceId, Quantity = newSeatQty });
            else if (newSeatQty > 0)
                result.Add(new SubscriptionItemOptions { Price = newSeatPriceId, Quantity = newSeatQty });
        }
        else if (seatItem != null)
        {
            // Le nouveau plan n'a pas de price seat configuré → on supprime l'item existant.
            result.Add(new SubscriptionItemOptions { Id = seatItem.Id, Deleted = true });
        }
        return result;
    }

    /// <summary>
    /// Idempotency-Key Stripe pour ChangePlan, équivalent de la clé Checkout. Bucket
    /// 1 minute = un double-clic produit la même clé, deux changements espacés produisent
    /// des clés distinctes.
    /// </summary>
    private static string ComputePlanChangeIdempotencyKey(Guid tenantId, string planCode, string cycle, int seats)
    {
        var bucket = DateTimeOffset.UtcNow.ToUnixTimeSeconds() / 60;
        var raw = $"chgplan:{tenantId}:{planCode}:{cycle}:{seats}:{bucket}";
        var bytes = System.Security.Cryptography.SHA256.HashData(System.Text.Encoding.UTF8.GetBytes(raw));
        return Convert.ToHexString(bytes).Substring(0, 32).ToLowerInvariant();
    }

    public async Task<bool> ResumeSubscriptionAsync(Tenant tenant, CancellationToken ct = default)
    {
        if (!_opts.IsConfigured || string.IsNullOrEmpty(tenant.StripeSubscriptionId))
            return false;

        try
        {
            await _subscriptions.UpdateAsync(
                tenant.StripeSubscriptionId,
                new SubscriptionUpdateOptions { CancelAtPeriodEnd = false },
                cancellationToken: ct);

            await using var master = await _masterFactory.CreateDbContextAsync(ct);
            var t = await master.Tenants.FirstOrDefaultAsync(x => x.Id == tenant.Id, ct);
            if (t != null)
            {
                t.CancelAtPeriodEnd = false;
                t.CancellationRequestedAt = null;
                await master.SaveChangesAsync(ct);
                _store.Invalidate(t.Slug);
            }
            _log.LogInformation("Tenant {Slug} : résiliation planifiée annulée.", tenant.Slug);
            return true;
        }
        catch (StripeException ex)
        {
            _log.LogError(ex, "Échec de reprise de subscription Stripe pour tenant {Slug}.", tenant.Slug);
            return false;
        }
    }

    /// <summary>
    /// True si au moins un item de la subscription est facturé annuellement (Price.Recurring.Interval == "year").
    /// On considère qu'une subscription contenant un item annuel est globalement annuelle —
    /// le modèle Stripe permet techniquement de mixer base+seat avec intervalles différents,
    /// mais notre catalogue PlanCatalog n'expose que des combinaisons homogènes (base+seat
    /// même intervalle), donc tester le premier item suffit en pratique.
    /// </summary>
    private static bool IsAnnualSubscription(Subscription sub)
    {
        if (sub?.Items?.Data == null) return false;
        foreach (var it in sub.Items.Data)
        {
            var interval = it?.Price?.Recurring?.Interval;
            if (!string.IsNullOrEmpty(interval) && string.Equals(interval, "year", StringComparison.OrdinalIgnoreCase))
                return true;
        }
        return false;
    }

    public async Task<string?> GetSubscriptionCycleAsync(string? subscriptionId, CancellationToken ct = default)
    {
        if (!_opts.IsConfigured || string.IsNullOrWhiteSpace(subscriptionId)) return null;
        Stripe.StripeConfiguration.ApiKey = _opts.SecretKey;
        try
        {
            var sub = await _subscriptions.GetAsync(
                subscriptionId,
                new SubscriptionGetOptions { Expand = new List<string> { "items.data.price" } },
                cancellationToken: ct);
            return IsAnnualSubscription(sub) ? "annual" : "monthly";
        }
        catch (StripeException ex)
        {
            _log.LogWarning(ex, "GetSubscriptionCycle : lecture subscription {Sub} échouée.", subscriptionId);
            return null;
        }
    }

    /// <summary>
    /// True si la subscription est actuellement en période d'essai (Status "trialing" ou
    /// TrialEnd dans le futur). Utilisé par la garde anti-cumul d'essai d'ApplyCheckoutSubscription.
    /// </summary>
    private static bool IsSubscriptionTrialing(Subscription sub)
    {
        if (sub == null) return false;
        if (string.Equals(sub.Status, "trialing", StringComparison.OrdinalIgnoreCase)) return true;
        return sub.TrialEnd.HasValue && sub.TrialEnd.Value > DateTime.UtcNow;
    }

    /// <summary>
    /// Émet un remboursement prorata temporis sur la dernière facture payée de la subscription.
    /// Le ratio remboursé = secondes restantes jusqu'à CurrentPeriodEnd / durée totale de la
    /// période. Ce remboursement va sur la carte d'origine via la Refund API Stripe (et non
    /// en crédit balance, qui serait perdu après cancel). Retourne le montant remboursé en
    /// unité majeure (ex: 47.50 EUR) et le code devise ISO.
    /// </summary>
    private async Task<(decimal amountMajor, string? currency)> IssueProratedRefundAsync(
        Subscription sub, CancellationToken ct)
    {
        if (sub == null) return (0, null);
        var periodStart = sub.CurrentPeriodStart;
        var periodEnd = sub.CurrentPeriodEnd;
        if (periodStart == default || periodEnd == default || periodEnd <= periodStart)
        {
            _log.LogWarning("Période Stripe invalide sur {SubId} — prorata non calculable.", sub.Id);
            return (0, null);
        }

        var totalSeconds = (periodEnd - periodStart).TotalSeconds;
        var now = DateTime.UtcNow;
        if (now <= periodStart) return (0, null); // période pas encore commencée
        if (now >= periodEnd) return (0, null);   // période terminée → rien à rembourser
        var remainingSeconds = (periodEnd - now).TotalSeconds;
        var unusedRatio = (decimal)(remainingSeconds / totalSeconds);
        if (unusedRatio <= 0m) return (0, null);

        // Identifie la dernière facture payée de la subscription pour cibler le PaymentIntent
        // (ou Charge en fallback). On limite à 1 résultat : c'est l'invoice de l'engagement
        // annuel en cours.
        var invoiceService = new InvoiceService();
        var invoices = await invoiceService.ListAsync(new InvoiceListOptions
        {
            Subscription = sub.Id,
            Status = "paid",
            Limit = 1,
        }, cancellationToken: ct);
        var lastInvoice = invoices?.Data?.FirstOrDefault();
        if (lastInvoice == null)
        {
            _log.LogWarning("Aucune facture payée pour {SubId} — prorata non remboursable.", sub.Id);
            return (0, null);
        }

        var refundAmountMinor = (long)Math.Floor(lastInvoice.AmountPaid * unusedRatio);
        if (refundAmountMinor <= 0) return (0, lastInvoice.Currency);

        var refundOptions = new RefundCreateOptions
        {
            Amount = refundAmountMinor,
            Reason = "requested_by_customer",
            Metadata = new Dictionary<string, string>
            {
                ["stripe_subscription_id"] = sub.Id,
                ["stripe_invoice_id"] = lastInvoice.Id,
                ["prorata_unused_ratio"] = unusedRatio.ToString("F6", System.Globalization.CultureInfo.InvariantCulture),
                ["prorata_unused_seconds"] = ((long)remainingSeconds).ToString(System.Globalization.CultureInfo.InvariantCulture),
                ["billing_interval"] = "year",
            },
        };
        var paymentIntentId = lastInvoice.PaymentIntentId;
        var chargeId = lastInvoice.ChargeId;
        if (!string.IsNullOrEmpty(paymentIntentId))
            refundOptions.PaymentIntent = paymentIntentId;
        else if (!string.IsNullOrEmpty(chargeId))
            refundOptions.Charge = chargeId;
        else
        {
            _log.LogWarning(
                "Facture {InvId} sans PaymentIntent ni Charge — prorata non remboursable (paiement par balance/voucher ?).",
                lastInvoice.Id);
            return (0, lastInvoice.Currency);
        }

        var refundService = new RefundService();
        var refund = await refundService.CreateAsync(refundOptions, cancellationToken: ct);
        var amountMajor = refund.Amount / 100m;
        _log.LogInformation(
            "Refund prorata créé : {Amount} {Cur} pour subscription {SubId} (ratio {Ratio:P2}, restant {Days:F1}j).",
            amountMajor, refund.Currency, sub.Id, unusedRatio, remainingSeconds / 86400.0);
        return (amountMajor, refund.Currency);
    }

    /// <summary>
    /// Bascule un tenant en statut Cancelled immédiat (résiliation effective). Met aussi
    /// à jour CancellationRequestedAt et CancelAtPeriodEnd=false.
    /// </summary>
    private async Task SetTenantCancelledAsync(Guid tenantId, CancellationToken ct)
    {
        await using var master = await _masterFactory.CreateDbContextAsync(ct);
        var t = await master.Tenants.FirstOrDefaultAsync(x => x.Id == tenantId, ct);
        if (t == null) return;
        t.Status = "Cancelled";
        t.CancellationRequestedAt = DateTime.UtcNow;
        t.CancelAtPeriodEnd = false;
        await master.SaveChangesAsync(ct);
        _store.Invalidate(t.Slug);
    }

    private async Task SetTenantScheduledCancellationAsync(Guid tenantId, DateTime? effectiveAt, CancellationToken ct)
    {
        await using var master = await _masterFactory.CreateDbContextAsync(ct);
        var t = await master.Tenants.FirstOrDefaultAsync(x => x.Id == tenantId, ct);
        if (t == null) return;
        t.CancelAtPeriodEnd = true;
        t.CancellationRequestedAt = DateTime.UtcNow;
        if (effectiveAt.HasValue) t.CurrentPeriodEndsAt = effectiveAt;
        await master.SaveChangesAsync(ct);
        _store.Invalidate(t.Slug);
    }

    public async Task ProcessTrialExpirationsAsync(CancellationToken ct = default)
    {
        await using var master = await _masterFactory.CreateDbContextAsync(ct);
        var now = DateTime.UtcNow;
        var expired = await master.Tenants
            .Where(t => t.Status == "Trialing" && t.TrialEndsAt != null && t.TrialEndsAt < now)
            .ToListAsync(ct);

        foreach (var tenant in expired)
        {
            // À la fin de l'essai, on bascule en PendingPayment : statut bloqué par
            // TenantResolverMiddleware (sauf /api/billing/*) → l'utilisateur est forcé de payer.
            // Avant ce changement on flippait en PastDue, mais le middleware ne le bloquait pas
            // → fenêtre d'accès gratuit illimité après expiration. Les tenants avec Stripe seront
            // re-flipés en Active par le webhook checkout.session.completed dès paiement.
            tenant.Status = "PendingPayment";
        }
        if (expired.Count > 0)
        {
            await master.SaveChangesAsync(ct);
            foreach (var t in expired) _store.Invalidate(t.Slug);
            _log.LogInformation("ProcessTrialExpirations : {Count} tenant(s) basculé(s) en PendingPayment.", expired.Count);
        }
    }

    private async Task UpdateStatusByCustomerIdAsync(string stripeCustomerId, string newStatus, CancellationToken ct)
    {
        if (string.IsNullOrEmpty(stripeCustomerId)) return;
        await using var master = await _masterFactory.CreateDbContextAsync(ct);
        var tenant = await master.Tenants.FirstOrDefaultAsync(t => t.StripeCustomerId == stripeCustomerId, ct);
        if (tenant == null)
        {
            _log.LogWarning("Webhook reçu pour customer {CustomerId} introuvable dans master.", stripeCustomerId);
            return;
        }
        if (tenant.Status == newStatus) return; // idempotence
        var previous = tenant.Status;
        tenant.Status = newStatus;
        await master.SaveChangesAsync(ct);
        _store.Invalidate(tenant.Slug);
        _log.LogInformation("Tenant {Slug} status: {Prev} → {Next} (customer={CustomerId})", tenant.Slug, previous, newStatus, stripeCustomerId);
    }

    /// <summary>
    /// Résout l'ID de prix Stripe pour une clé `{plan}:{kind}:{cycle}`.
    /// `kind` ∈ { "base", "seat" } — base = forfait mensuel, seat = surcharge par salarié sup.
    /// Rétrocompatibilité : si la clé 3-segments n'existe pas, on tente l'ancienne forme
    /// `{plan}:{cycle}` (un seul prix par plan).
    /// </summary>
    private string? ResolvePriceId(string? planCode, string kind, string? billingCycle)
    {
        if (string.IsNullOrWhiteSpace(planCode)) return null;
        var cycle = string.IsNullOrWhiteSpace(billingCycle) ? "monthly" : billingCycle.ToLowerInvariant();
        var key = $"{planCode}:{kind}:{cycle}";
        if (_opts.Prices.TryGetValue(key, out var pid) && !string.IsNullOrWhiteSpace(pid) && !pid.Contains("REPLACE"))
            return pid;
        // Fallback legacy 2-segments (avant introduction du modèle base/seat).
        if (kind == "base")
        {
            var legacyKey = $"{planCode}:{cycle}";
            if (_opts.Prices.TryGetValue(legacyKey, out var legacyPid) && !string.IsNullOrWhiteSpace(legacyPid) && !legacyPid.Contains("REPLACE"))
                return legacyPid;
        }
        return null;
    }

    /// <summary>
    /// Résout le price_id Stripe du produit unique <c>user_supp</c> pour un plan et un
    /// cycle donnés. Clé de config attendue : <c>Stripe:Prices:UserSupp:{Plan}:{cycle}</c>.
    /// Retourne null si non configuré (l'admin Stripe n'a pas créé le price), ce qui
    /// fera fail-open l'ajout du collab supplémentaire avec un log warn (cf. caller).
    /// </summary>
    private string? ResolveUserSuppPriceId(string? planCode, string? billingCycle)
    {
        if (string.IsNullOrWhiteSpace(planCode)) return null;
        var canonical = PlanCatalog.Normalize(planCode);
        if (string.IsNullOrEmpty(canonical)) return null;
        var cycle = string.IsNullOrWhiteSpace(billingCycle) ? "monthly" : billingCycle.ToLowerInvariant();
        var key = $"UserSupp:{canonical}:{cycle}";
        if (_opts.Prices.TryGetValue(key, out var pid) && !string.IsNullOrWhiteSpace(pid) && !pid.Contains("REPLACE"))
            return pid;
        return null;
    }

    /// <summary>
    /// Détecte le cycle de facturation (monthly/annual) d'une subscription Stripe en
    /// inspectant l'intervalle du premier price récurrent. Sert quand on ajoute un
    /// item <c>user_supp</c> à la subscription : on aligne automatiquement le cycle
    /// sur celui de l'abonnement existant, sans avoir à stocker le cycle sur Tenant.
    /// </summary>
    private static string DetectBillingCycle(Stripe.Subscription sub)
    {
        var first = sub.Items?.Data?.FirstOrDefault();
        var interval = first?.Price?.Recurring?.Interval;
        return string.Equals(interval, "year", System.StringComparison.OrdinalIgnoreCase) ? "annual" : "monthly";
    }

    /// <summary>
    /// Clé de metadata Stripe utilisée pour stocker le nombre de sièges supplémentaires
    /// pré-achetés (cf. <see cref="PurchaseExtraSeatsAsync"/>). Le sync quotidien respecte
    /// ce floor — il garantit que les sièges payés d'avance ne sont jamais déduits
    /// avant la fin du cycle de facturation, même si l'admin n'a pas encore créé les
    /// employés correspondants.
    /// </summary>
    private const string ExtraSeatsPurchasedMetaKey = "extra_seats_purchased";

    private static int ReadPurchasedExtras(Stripe.Subscription sub)
    {
        if (sub.Metadata != null
            && sub.Metadata.TryGetValue(ExtraSeatsPurchasedMetaKey, out var raw)
            && int.TryParse(raw, out var v) && v > 0)
        {
            return v;
        }
        return 0;
    }

    public async Task<int?> SyncSupplementaryEmployeesAsync(
        Tenant tenant,
        int activeEmployeeCount,
        CancellationToken ct = default)
    {
        // Pas de Stripe configuré → skip silencieusement (dev / preview). Le sync horaire
        // re-essaiera plus tard quand l'admin aura mis les clés. Le collab a quand même
        // été créé côté tenant DB par le caller — on ne bloque pas l'usage en dev.
        if (!_opts.IsConfigured) return null;
        if (string.IsNullOrWhiteSpace(tenant.StripeSubscriptionId)) return null;

        var plan = PlanCatalog.GetPlan(tenant.PlanCode);
        if (plan is null) return null;

        var activeOverage = PlanCatalog.ComputeSupplementaryCount(plan, activeEmployeeCount);

        Stripe.StripeConfiguration.ApiKey = _opts.SecretKey;
        var subService = new Stripe.SubscriptionService();
        var sub = await subService.GetAsync(tenant.StripeSubscriptionId, cancellationToken: ct);
        if (sub is null)
        {
            _log.LogWarning("Tenant {Slug} : subscription {Sub} introuvable, skip user_supp sync.", tenant.Slug, tenant.StripeSubscriptionId);
            return null;
        }

        // Sièges achetés via Payment Link dédié (« Collaborateur supplémentaire pack {plan} ») :
        // facturés par LEUR PROPRE abonnement Stripe. On les retire de l'overage facturé ici
        // (item user_supp du pack) pour ne JAMAIS les facturer deux fois.
        var linkSeats = System.Math.Max(0, tenant.LinkPurchasedSeats);
        var billableHere = System.Math.Max(0, activeOverage - linkSeats);

        // Respect du floor de sièges pré-achetés EN APP (/billing/add-seats, facturés sur le pack) :
        // si l'admin a payé pour 5 collabs supp. mais n'a créé que 0 employé au-delà du seuil inclus,
        // on garde la quantité à 5 (sinon le sync remettrait à 0 et la facture pré-payée serait créditée).
        var purchased = ReadPurchasedExtras(sub);
        var supplementary = System.Math.Max(billableHere, purchased);

        var cycle = DetectBillingCycle(sub);
        var userSuppPriceId = ResolveUserSuppPriceId(tenant.PlanCode, cycle);
        if (string.IsNullOrEmpty(userSuppPriceId))
        {
            _log.LogWarning(
                "Tenant {Slug} : price UserSupp:{Plan}:{Cycle} non configuré, skip sync. " +
                "Configurer Stripe:Prices:UserSupp:{Plan}:{Cycle} pour activer la facturation des collabs supplémentaires.",
                tenant.Slug, tenant.PlanCode, cycle, tenant.PlanCode, cycle);
            return null;
        }

        // Item existant ? On match par price_id. Stripe garde plusieurs items distincts par
        // subscription donc on évite tout amalgame avec l'ancien item per-plan "seat".
        var existing = sub.Items.Data.FirstOrDefault(i =>
            string.Equals(i.Price?.Id, userSuppPriceId, System.StringComparison.Ordinal));

        var itemService = new Stripe.SubscriptionItemService();
        if (existing is null)
        {
            // Pas encore d'item user_supp sur cette subscription. On le crée seulement s'il
            // y a un overage à facturer — inutile de polluer la subscription avec un item à 0.
            if (supplementary == 0) return 0;
            await itemService.CreateAsync(new Stripe.SubscriptionItemCreateOptions
            {
                Subscription = tenant.StripeSubscriptionId,
                Price = userSuppPriceId,
                Quantity = supplementary,
                ProrationBehavior = "create_prorations",
            }, cancellationToken: ct);
            _log.LogInformation(
                "Tenant {Slug} ({Plan}) : item user_supp créé sur subscription avec qty={Qty}.",
                tenant.Slug, tenant.PlanCode, supplementary);
            return supplementary;
        }

        // Idempotence : ne push que si la quantité change.
        if (existing.Quantity == supplementary) return supplementary;
        await itemService.UpdateAsync(existing.Id, new Stripe.SubscriptionItemUpdateOptions
        {
            Quantity = supplementary,
            ProrationBehavior = "create_prorations",
        }, cancellationToken: ct);
        _log.LogInformation(
            "Tenant {Slug} ({Plan}) : user_supp {Old} → {New} (employés={Count}, inclus={Included}, pré-achetés={Purchased})",
            tenant.Slug, tenant.PlanCode, existing.Quantity, supplementary, activeEmployeeCount, plan.IncludedEmployees, purchased);
        return supplementary;
    }

    public async Task<SeatPurchaseResult?> PurchaseExtraSeatsAsync(
        Tenant tenant,
        int delta,
        int activeEmployeeCount,
        CancellationToken ct = default)
    {
        if (delta <= 0) throw new System.ArgumentOutOfRangeException(nameof(delta), "Le nombre de sièges à ajouter doit être > 0.");
        if (!_opts.IsConfigured) return null;
        if (string.IsNullOrWhiteSpace(tenant.StripeSubscriptionId)) return null;

        var plan = PlanCatalog.GetPlan(tenant.PlanCode);
        if (plan is null) return null;

        Stripe.StripeConfiguration.ApiKey = _opts.SecretKey;
        var subService = new Stripe.SubscriptionService();
        var sub = await subService.GetAsync(tenant.StripeSubscriptionId, cancellationToken: ct);
        if (sub is null)
        {
            _log.LogWarning("Tenant {Slug} : subscription {Sub} introuvable, achat sièges impossible.",
                tenant.Slug, tenant.StripeSubscriptionId);
            return null;
        }

        var cycle = DetectBillingCycle(sub);
        var userSuppPriceId = ResolveUserSuppPriceId(tenant.PlanCode, cycle);
        if (string.IsNullOrEmpty(userSuppPriceId))
        {
            _log.LogWarning(
                "Tenant {Slug} : price UserSupp:{Plan}:{Cycle} non configuré, achat sièges refusé.",
                tenant.Slug, tenant.PlanCode, cycle);
            return null;
        }

        var prevPurchased = ReadPurchasedExtras(sub);
        var newPurchased = prevPurchased + delta;
        var activeOverage = PlanCatalog.ComputeSupplementaryCount(plan, activeEmployeeCount);
        var newQuantity = System.Math.Max(activeOverage, newPurchased);

        // Met à jour la metadata AVANT l'item — si l'update item échoue après, on garde
        // la trace de l'intention côté Stripe pour rejouer manuellement si besoin.
        await subService.UpdateAsync(tenant.StripeSubscriptionId, new Stripe.SubscriptionUpdateOptions
        {
            Metadata = new Dictionary<string, string>
            {
                [ExtraSeatsPurchasedMetaKey] = newPurchased.ToString(System.Globalization.CultureInfo.InvariantCulture),
            },
        }, cancellationToken: ct);

        var existing = sub.Items.Data.FirstOrDefault(i =>
            string.Equals(i.Price?.Id, userSuppPriceId, System.StringComparison.Ordinal));
        var itemService = new Stripe.SubscriptionItemService();
        if (existing is null)
        {
            await itemService.CreateAsync(new Stripe.SubscriptionItemCreateOptions
            {
                Subscription = tenant.StripeSubscriptionId,
                Price = userSuppPriceId,
                Quantity = newQuantity,
                ProrationBehavior = "create_prorations",
            }, cancellationToken: ct);
        }
        else if (existing.Quantity != newQuantity)
        {
            await itemService.UpdateAsync(existing.Id, new Stripe.SubscriptionItemUpdateOptions
            {
                Quantity = newQuantity,
                ProrationBehavior = "create_prorations",
            }, cancellationToken: ct);
        }

        _log.LogInformation(
            "Tenant {Slug} ({Plan}) : achat de {Delta} siège(s) supp. (total pré-achetés {Prev}→{New}, qty user_supp={Qty}).",
            tenant.Slug, tenant.PlanCode, delta, prevPurchased, newPurchased, newQuantity);

        return new SeatPurchaseResult(
            PurchasedExtraSeats: newPurchased,
            CurrentBilledQuantity: newQuantity,
            MonthlyCostEur: newQuantity * plan.OverageRatePerEmployeeEur,
            OverageRatePerSeat: plan.OverageRatePerEmployeeEur);
    }

    /// <summary>
    /// Construit le reverse-map price_id → (plan, cycle, kind) à partir de <c>Stripe:Prices</c>.
    /// Reconnaît les clés <c>{Plan}:base:{cycle}</c>, le legacy <c>{Plan}:{cycle}</c> (= base),
    /// et <c>UserSupp:{Plan}:{cycle}</c> (= collaborateur supplémentaire). Un même price_id peut
    /// être partagé entre mensuel/annuel (cf. config actuelle où UserSupp:*:monthly == *:annual) :
    /// dans ce cas on retient la 1re occurrence, le cycle réel étant de toute façon redétecté via
    /// l'intervalle Stripe ailleurs. <c>kind</c> ∈ { "base", "usersupp" }.
    /// </summary>
    private Dictionary<string, (string Plan, string Cycle, string Kind)> BuildPriceReverseMap()
    {
        var map = new Dictionary<string, (string, string, string)>(System.StringComparer.Ordinal);
        foreach (var kv in _opts.Prices)
        {
            var pid = kv.Value;
            if (string.IsNullOrWhiteSpace(pid) || pid.Contains("REPLACE")) continue;
            var seg = kv.Key.Split(':');
            if (seg.Length == 3 && string.Equals(seg[0], "UserSupp", System.StringComparison.OrdinalIgnoreCase))
            {
                if (!map.ContainsKey(pid)) map[pid] = (PlanCatalog.Normalize(seg[1]), seg[2].ToLowerInvariant(), "usersupp");
            }
            else if (seg.Length == 3 && string.Equals(seg[0], "Addon", System.StringComparison.OrdinalIgnoreCase))
            {
                // Addon:{addonKey}:{cycle} — module optionnel. On préserve la casse de la clé
                // (les addonKeys sont camelCase, ex. aiAssistantRh) : pas de Normalize ici.
                if (!map.ContainsKey(pid)) map[pid] = (seg[1], seg[2].ToLowerInvariant(), "addon");
            }
            else if (seg.Length == 3 && string.Equals(seg[0], "Storage", System.StringComparison.OrdinalIgnoreCase))
            {
                // Storage:block100Go:{cycle} — bloc de stockage supplémentaire (100 Go / unité).
                if (!map.ContainsKey(pid)) map[pid] = (seg[1], seg[2].ToLowerInvariant(), "storage");
            }
            else if (seg.Length == 3 && string.Equals(seg[1], "base", System.StringComparison.OrdinalIgnoreCase))
            {
                if (!map.ContainsKey(pid)) map[pid] = (PlanCatalog.Normalize(seg[0]), seg[2].ToLowerInvariant(), "base");
            }
            else if (seg.Length == 2 && PlanCatalog.GetPlan(seg[0]) != null)
            {
                // Legacy {Plan}:{cycle} = prix de base unique, UNIQUEMENT si seg[0] est un vrai
                // plan (Starter/Standard/Premium). La garde évite qu'une clé `Service:xxx`
                // (2 segments) soit interprétée à tort comme un prix de base de pack.
                if (!map.ContainsKey(pid)) map[pid] = (PlanCatalog.Normalize(seg[0]), seg[1].ToLowerInvariant(), "base");
            }
        }
        return map;
    }

    public async Task<CheckoutProvisionResult?> ApplyCheckoutSubscriptionAsync(
        Tenant tenant,
        string subscriptionId,
        CancellationToken ct = default)
    {
        if (!_opts.IsConfigured) return null;
        if (string.IsNullOrWhiteSpace(subscriptionId)) return null;

        Stripe.StripeConfiguration.ApiKey = _opts.SecretKey;
        Subscription sub;
        try
        {
            sub = await _subscriptions.GetAsync(
                subscriptionId,
                new SubscriptionGetOptions { Expand = new List<string> { "items.data.price" } },
                cancellationToken: ct);
        }
        catch (StripeException ex)
        {
            _log.LogWarning(ex, "ApplyCheckoutSubscription : subscription {Sub} introuvable pour tenant {Slug}.", subscriptionId, tenant.Slug);
            return null;
        }
        if (sub?.Items?.Data is null) return null;

        var reverse = BuildPriceReverseMap();
        string? derivedPlan = null;
        string? derivedCycle = null;
        var extraSeats = 0;
        var extraStorageBlocks = 0;
        var addonKeys = new List<string>();

        foreach (var item in sub.Items.Data)
        {
            var pid = item.Price?.Id;
            if (string.IsNullOrEmpty(pid)) continue;
            // Le cycle réel vient de l'intervalle Stripe (year → annual), plus fiable que la
            // clé de config quand un même price_id couvre mensuel ET annuel.
            var itemCycle = string.Equals(item.Price?.Recurring?.Interval, "year", System.StringComparison.OrdinalIgnoreCase)
                ? "annual" : "monthly";
            if (reverse.TryGetValue(pid, out var info))
            {
                if (info.Kind == "base")
                {
                    derivedPlan = info.Plan;
                    derivedCycle = itemCycle;
                }
                else if (info.Kind == "usersupp")
                {
                    extraSeats += (int)(item.Quantity);
                }
                else if (info.Kind == "addon")
                {
                    // info.Plan porte ici la clé d'addon (cf. BuildPriceReverseMap). Le webhook
                    // filtrera sur ValidAddonKeys avant de l'ajouter à Tenant.Addons.
                    if (!addonKeys.Contains(info.Plan)) addonKeys.Add(info.Plan);
                }
                else if (info.Kind == "storage")
                {
                    // 1 unité = 1 bloc de 100 Go. La quantité de l'item = nombre de blocs achetés.
                    extraStorageBlocks += (int)(item.Quantity);
                }
            }
        }

        // Pose le floor de sièges pré-achetés UNIQUEMENT sur un abonnement de PACK (derivedPlan
        // non null) : c'est l'abonnement que SyncSupplementaryEmployeesAsync lit via ReadPurchasedExtras.
        // Un abonnement « collaborateur seul » (Payment Link dédié, derivedPlan null) ne reçoit PAS
        // de floor — il est facturé par lui-même et comptabilisé côté tenant via LinkPurchasedSeats
        // (cf. webhook), donc retiré de l'overage du pack pour éviter le double-paiement.
        if (extraSeats > 0 && derivedPlan != null)
        {
            var prev = ReadPurchasedExtras(sub);
            var floor = System.Math.Max(prev, extraSeats);
            if (floor != prev)
            {
                try
                {
                    await _subscriptions.UpdateAsync(subscriptionId, new SubscriptionUpdateOptions
                    {
                        Metadata = new Dictionary<string, string>
                        {
                            [ExtraSeatsPurchasedMetaKey] = floor.ToString(System.Globalization.CultureInfo.InvariantCulture),
                        },
                    }, cancellationToken: ct);
                }
                catch (StripeException ex)
                {
                    _log.LogWarning(ex, "ApplyCheckoutSubscription : échec écriture floor extra_seats={Floor} sur {Sub} (tenant {Slug}).",
                        floor, subscriptionId, tenant.Slug);
                }
            }
        }

        // ── Garde anti-cumul d'essai ────────────────────────────────────────────────
        // Les Payment Links de pack (buy.stripe.com) sont configurés avec un essai 30 j
        // dans le Dashboard Stripe. Or l'essai n'est censé être accordé QU'UNE fois, au
        // signup (CreateCustomerAndTrialAsync). Sans cette garde, un tenant déjà inscrit
        // qui change de pack via un Payment Link obtiendrait un NOUVEAU mois gratuit — et
        // pourrait le « farmer » indéfiniment en re-changeant de pack. On neutralise donc
        // l'essai de la sub issue d'un checkout de PACK :
        //   • essai d'origine encore en cours (TrialEndsAt futur) → on ANCRE la fin d'essai
        //     sur la date d'origine : les jours restants sont préservés, mais l'essai n'est
        //     PAS réinitialisé à 30 j ;
        //   • essai d'origine déjà consommé (TrialEndsAt passé/nul) → fin d'essai immédiate
        //     (paiement maintenant via la carte collectée par le Payment Link).
        // Ne s'applique qu'aux checkouts de PACK (derivedPlan != null) et seulement si la
        // nouvelle sub est réellement en essai → no-op si l'essai est retiré des Payment
        // Links côté Dashboard, ou pour un checkout API in-app (créé sans essai). Best-effort.
        if (derivedPlan != null && IsSubscriptionTrialing(sub))
        {
            try
            {
                var now = DateTime.UtcNow;
                // Marge 1h : Stripe exige un trial_end soit "now", soit ≥ ~1h dans le futur.
                var anchor = tenant.TrialEndsAt;
                var keepRemaining = anchor.HasValue && anchor.Value > now.AddHours(1);
                var update = new SubscriptionUpdateOptions { ProrationBehavior = "none" };
                if (keepRemaining) update.TrialEnd = anchor;            // ancrage sur l'essai d'origine
                else update.TrialEnd = SubscriptionTrialEnd.Now;        // essai consommé → paiement immédiat
                await _subscriptions.UpdateAsync(subscriptionId, update, cancellationToken: ct);
                _log.LogInformation(
                    "Anti-cumul essai : sub {Sub} (tenant {Slug}) — essai {Action} (TrialEndsAt origine={Origin:yyyy-MM-dd}).",
                    subscriptionId, tenant.Slug,
                    keepRemaining ? "ancré sur la date d'origine" : "terminé immédiatement", anchor);
            }
            catch (StripeException ex)
            {
                _log.LogWarning(ex, "Anti-cumul essai : échec mise à jour trial_end sur {Sub} (tenant {Slug}).", subscriptionId, tenant.Slug);
            }
        }

        _log.LogInformation(
            "ApplyCheckoutSubscription : tenant {Slug} ← Payment Link sub {Sub} (plan={Plan}, cycle={Cycle}, collab_supp={Extra}, addons=[{Addons}], storage_blocs={Storage}).",
            tenant.Slug, subscriptionId, derivedPlan ?? "?", derivedCycle ?? "?", extraSeats, string.Join(",", addonKeys), extraStorageBlocks);

        return new CheckoutProvisionResult(derivedPlan, derivedCycle, extraSeats, addonKeys, extraStorageBlocks);
    }
}

internal sealed class StripeOptions
{
    public string? SecretKey { get; init; }
    public string? WebhookSecret { get; init; }
    public long TrialDays { get; init; } = 30;
    public IReadOnlyDictionary<string, string> Prices { get; init; } = new Dictionary<string, string>();

    public bool IsConfigured =>
        !string.IsNullOrWhiteSpace(SecretKey) && !SecretKey.Contains("REPLACE");

    public static StripeOptions Read(IConfiguration cfg)
    {
        var section = cfg.GetSection("Stripe");
        // Les clés de prix contiennent des ':' (ex. "UserSupp:Starter:monthly"). Le
        // provider de configuration .NET interprète ':' comme un séparateur de section :
        // ces clés JSON sont donc stockées en HIÉRARCHIE (UserSupp → Starter → monthly)
        // et non comme une clé plate. GetChildren() ne renvoyait alors que le 1er segment
        // ("UserSupp", "Starter") avec une valeur nulle → TryGetValue("UserSupp:Starter:
        // monthly") échouait et AUCUN price_id n'était résolu (facturation collab supp ET
        // création de subscription silencieusement cassées — latent tant que les tenants
        // restent en essai sans CB).
        // AsEnumerable(makePathsRelative:true) ré-aplatit l'arbre en clés relatives jointes
        // par ':' ; on ne garde que les feuilles (Value non vide) pour reconstruire
        // exactement les clés plates attendues par ResolvePriceId / ResolveUserSuppPriceId.
        var prices = section.GetSection("Prices")
            .AsEnumerable(makePathsRelative: true)
            .Where(kv => !string.IsNullOrEmpty(kv.Value))
            .ToDictionary(kv => kv.Key, kv => kv.Value!, StringComparer.OrdinalIgnoreCase);
        return new StripeOptions
        {
            SecretKey = section["SecretKey"],
            WebhookSecret = section["WebhookSecret"],
            TrialDays = long.TryParse(section["TrialDays"], out var d) ? d : 30,
            Prices = prices,
        };
    }
}
