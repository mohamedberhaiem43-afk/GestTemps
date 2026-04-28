using ABRPOINT.Server.Billing;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
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
    private readonly IConfiguration _cfg;
    private readonly ILogger<StripeWebhookController> _log;

    public StripeWebhookController(IBillingService billing, IConfiguration cfg, ILogger<StripeWebhookController> log)
    {
        _billing = billing;
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
