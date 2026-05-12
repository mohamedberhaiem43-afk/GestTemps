using ABRPOINT.Server.Tenancy;

namespace ABRPOINT.Server.Billing;

/// <summary>
/// Coordonne Stripe (Customer + Subscription) et l'état Tenant.Status dans la master DB.
/// Toutes les méthodes sont idempotentes (un retry après timeout réseau ne crée pas de doublon).
/// </summary>
public interface IBillingService
{
    /// <summary>
    /// Crée un Customer Stripe et une Subscription en mode trial pour ce tenant.
    /// Met à jour Tenant.StripeCustomerId / StripeSubscriptionId / TrialEndsAt.
    /// </summary>
    Task<BillingProvisionResult> CreateCustomerAndTrialAsync(
        Tenant tenant,
        string? planCode,
        string? billingCycle,
        CancellationToken ct = default);

    /// <summary>Webhook : invoice.payment_succeeded → Tenant.Status = "Active".</summary>
    Task MarkActiveAsync(string stripeCustomerId, CancellationToken ct = default);

    /// <summary>Webhook : invoice.payment_failed → Tenant.Status = "PastDue".</summary>
    Task MarkPastDueAsync(string stripeCustomerId, CancellationToken ct = default);

    /// <summary>Webhook : customer.subscription.deleted → Tenant.Status = "Suspended".</summary>
    Task SuspendAsync(string stripeCustomerId, CancellationToken ct = default);

    /// <summary>Cron : marque trialed pendant trop longtemps en PastDue (déclenche le 1er paiement Stripe sinon).</summary>
    Task ProcessTrialExpirationsAsync(CancellationToken ct = default);

    /// <summary>
    /// Cron : notifie admins + managers des tenants dont l'essai expire dans
    /// <paramref name="daysBeforeEnd"/> jours, pour leur rappeler de finaliser le paiement
    /// Stripe avant la bascule en PendingPayment. Idempotent — chaque tenant n'est notifié
    /// qu'une seule fois (champ Tenant.TrialReminderSentAt).
    /// </summary>
    Task SendTrialExpiryRemindersAsync(int daysBeforeEnd = 4, CancellationToken ct = default);
}

public sealed record BillingProvisionResult(
    string? CustomerId,
    string? SubscriptionId,
    DateTime? TrialEndsAt,
    bool Skipped,
    string? SkipReason);
