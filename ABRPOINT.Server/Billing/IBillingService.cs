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

    /// <summary>
    /// Résilie l'abonnement Stripe du tenant. Si <paramref name="immediate"/> est true,
    /// la subscription est annulée immédiatement (Stripe SubscriptionService.CancelAsync)
    /// et Tenant.Status bascule en "Cancelled". Sinon (résiliation planifiée), on met
    /// cancel_at_period_end = true côté Stripe : l'accès reste actif jusqu'à
    /// CurrentPeriodEndsAt et Stripe enverra customer.subscription.deleted en fin de période.
    /// Idempotent : annuler une subscription déjà annulée renvoie Success=true sans erreur.
    /// </summary>
    Task<CancellationResult> CancelSubscriptionAsync(
        Tenant tenant,
        bool immediate,
        string? reason,
        CancellationToken ct = default);

    /// <summary>
    /// Annule une résiliation planifiée (cancel_at_period_end = false côté Stripe).
    /// Fonctionne tant que la fin de période n'est pas atteinte ; au-delà la subscription
    /// est définitivement supprimée par Stripe et seul un nouveau Checkout peut la recréer.
    /// </summary>
    Task<bool> ResumeSubscriptionAsync(Tenant tenant, CancellationToken ct = default);

    /// <summary>
    /// Change le plan d'un tenant avec abonnement Stripe actif. Met à jour en place les
    /// items de la subscription (price de base + price seat + quantité seat recalculée
    /// pour le nouvel "included") avec <c>proration_behavior=create_prorations</c> : Stripe
    /// crédite ou facture le différentiel sur la PROCHAINE facture (pas de prélèvement
    /// immédiat). L'accès aux features change instantanément côté app via Tenant.PlanCode.
    /// Upgrade et downgrade utilisent le même endpoint — la sémantique commerciale dépend
    /// du sens (montant > 0 = à payer, montant &lt; 0 = crédité).
    /// </summary>
    Task<ChangePlanResult> ChangePlanAsync(
        Tenant tenant,
        string newPlanCode,
        string billingCycle,
        int billedSeats,
        CancellationToken ct = default);

    /// <summary>
    /// Calcule (sans appliquer) le coût du changement de plan. Appelle Stripe
    /// <c>Invoice.UpcomingAsync</c> avec les items proposés + proration. Permet au
    /// frontend d'afficher "Vous serez crédité 12.40 EUR sur votre prochaine facture
    /// du 15 juin" AVANT que l'admin clique sur Confirmer.
    /// </summary>
    Task<PlanChangePreview> PreviewPlanChangeAsync(
        Tenant tenant,
        string newPlanCode,
        string billingCycle,
        int billedSeats,
        CancellationToken ct = default);
}

public sealed record BillingProvisionResult(
    string? CustomerId,
    string? SubscriptionId,
    DateTime? TrialEndsAt,
    bool Skipped,
    string? SkipReason);

public sealed record CancellationResult(
    bool Success,
    bool Immediate,
    DateTime? EffectiveAt,
    string? ErrorMessage,
    bool Prorated = false,
    decimal? RefundedAmount = null,
    string? RefundCurrency = null);

/// <summary>
/// Résultat de l'application d'un changement de plan. <c>NetAmountOnNextInvoice</c>
/// est en unité majeure (EUR, pas centimes) et signé : positif si l'admin sera
/// facturé du différentiel sur la prochaine facture (upgrade), négatif si du crédit
/// est appliqué (downgrade).
/// </summary>
public sealed record ChangePlanResult(
    bool Success,
    string? PreviousPlan,
    string? NewPlan,
    decimal? NetAmountOnNextInvoice,
    string? Currency,
    DateTime? NextInvoiceAt,
    string? ErrorMessage);

/// <summary>
/// Preview chiffré d'un changement de plan, calculé sans modifier la subscription.
/// Reflète exactement ce que Stripe facturera/créditera si l'admin confirme.
/// </summary>
public sealed record PlanChangePreview(
    bool Available,
    string CurrentPlan,
    string NewPlan,
    decimal? ProrationAmount,
    string? Currency,
    DateTime? NextInvoiceAt,
    decimal? NextInvoiceTotal,
    string? UnavailableReason);
