using ABRPOINT.Server.Billing;
using ABRPOINT.Server.Tenancy;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Stripe;

namespace ABRPOINT.Server.Controllers;

/// <summary>
/// Reçoit les webhooks Stripe et met à jour Tenant.Status.
/// Vérifie la signature `Stripe-Signature` avec Stripe:WebhookSecret.
/// Bypass tenant resolver via /api/stripe/webhook (cf. TenantResolverMiddleware.BypassPrefixes).
/// </summary>
[ApiController]
[Route("api/stripe/webhook")]
[AllowAnonymous]
public class StripeWebhookController : ControllerBase
{
    private readonly IBillingService _billing;
    private readonly IDbContextFactory<MasterDbContext> _masterFactory;
    private readonly ITenantStore _tenantStore;
    private readonly IConfiguration _cfg;
    private readonly ILogger<StripeWebhookController> _log;

    public StripeWebhookController(
        IBillingService billing,
        IDbContextFactory<MasterDbContext> masterFactory,
        ITenantStore tenantStore,
        IConfiguration cfg,
        ILogger<StripeWebhookController> log)
    {
        _billing = billing;
        _masterFactory = masterFactory;
        _tenantStore = tenantStore;
        _cfg = cfg;
        _log = log;
    }

    [HttpPost]
    public async Task<IActionResult> Receive(CancellationToken ct)
    {
        var webhookSecret = _cfg["Stripe:WebhookSecret"];
        if (string.IsNullOrWhiteSpace(webhookSecret) || webhookSecret.Contains("REPLACE"))
        {
            _log.LogWarning("Stripe webhook reçu mais WebhookSecret non configuré — ignoré.");
            return Ok(); // 200 pour ne pas faire retry Stripe ; en prod, mettre 503.
        }

        using var reader = new StreamReader(Request.Body);
        var json = await reader.ReadToEndAsync(ct);

        Event stripeEvent;
        try
        {
            stripeEvent = EventUtility.ConstructEvent(
                json,
                Request.Headers["Stripe-Signature"],
                webhookSecret,
                throwOnApiVersionMismatch: false);
        }
        catch (StripeException ex)
        {
            _log.LogWarning(ex, "Stripe signature invalide.");
            return BadRequest("Invalid signature");
        }

        try
        {
            switch (stripeEvent.Type)
            {
                case "invoice.payment_succeeded":
                {
                    var invoice = stripeEvent.Data.Object as Invoice;
                    if (!string.IsNullOrEmpty(invoice?.CustomerId))
                        await _billing.MarkActiveAsync(invoice.CustomerId, ct);
                    break;
                }
                case "invoice.payment_failed":
                {
                    var invoice = stripeEvent.Data.Object as Invoice;
                    if (!string.IsNullOrEmpty(invoice?.CustomerId))
                        await _billing.MarkPastDueAsync(invoice.CustomerId, ct);
                    break;
                }
                case "customer.subscription.deleted":
                {
                    var sub = stripeEvent.Data.Object as Subscription;
                    if (!string.IsNullOrEmpty(sub?.CustomerId))
                        await _billing.SuspendAsync(sub.CustomerId, ct);
                    break;
                }
                case "customer.subscription.trial_will_end":
                {
                    // Hook informatif : envoyer un email J-3 (à brancher plus tard sur EmailService).
                    var sub = stripeEvent.Data.Object as Subscription;
                    _log.LogInformation("Trial will end for customer {CustomerId} (sub {SubId}).", sub?.CustomerId, sub?.Id);
                    break;
                }
                case "checkout.session.completed":
                {
                    // L'utilisateur a complété le Checkout : on rattache la nouvelle subscription
                    // au tenant et on annule l'éventuelle subscription trial pré-existante pour
                    // éviter d'avoir deux subscriptions actives sur le même customer.
                    var session = stripeEvent.Data.Object as Stripe.Checkout.Session;
                    var tenantIdRaw = session?.ClientReferenceId
                        ?? (session?.Metadata != null && session.Metadata.TryGetValue("tenant_id", out var tid) ? tid : null);
                    if (!Guid.TryParse(tenantIdRaw, out var tenantId) || string.IsNullOrEmpty(session?.SubscriptionId))
                    {
                        _log.LogWarning("checkout.session.completed sans tenant_id ou subscription_id (session={SessionId}).", session?.Id);
                        break;
                    }
                    await using var master = await _masterFactory.CreateDbContextAsync(ct);
                    var tenant = await master.Tenants.FirstOrDefaultAsync(t => t.Id == tenantId, ct);
                    if (tenant is null)
                    {
                        _log.LogWarning("Tenant {TenantId} introuvable pour checkout.session.completed.", tenantId);
                        break;
                    }
                    var oldSubId = tenant.StripeSubscriptionId;
                    tenant.StripeSubscriptionId = session.SubscriptionId;
                    if (!string.IsNullOrEmpty(session.CustomerId)) tenant.StripeCustomerId = session.CustomerId;
                    tenant.Status = "Active";
                    await master.SaveChangesAsync(ct);
                    _tenantStore.Invalidate(tenant.Slug);

                    if (!string.IsNullOrEmpty(oldSubId) && oldSubId != session.SubscriptionId)
                    {
                        try { await new SubscriptionService().CancelAsync(oldSubId, cancellationToken: ct); }
                        catch (StripeException ex) { _log.LogWarning(ex, "Annulation de l'ancienne subscription {OldSubId} échouée.", oldSubId); }
                    }
                    break;
                }
                default:
                    _log.LogDebug("Stripe event ignoré: {Type}", stripeEvent.Type);
                    break;
            }
        }
        catch (Exception ex)
        {
            _log.LogError(ex, "Erreur de traitement du webhook Stripe {Type}", stripeEvent.Type);
            // 500 → Stripe re-essaie (jusqu'à 3 jours).
            return StatusCode(500);
        }

        return Ok();
    }
}
