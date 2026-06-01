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
    /// Cron : notifie admins + managers des tenants Active dont la PÉRIODE DE FACTURATION
    /// Stripe courante (<see cref="Tenant.CurrentPeriodEndsAt"/>) expire dans
    /// <paramref name="daysBeforeEnd"/> jours, pour leur rappeler que le paiement sera
    /// automatiquement reconduit et leur permettre d'anticiper une éventuelle annulation
    /// ou MAJ de moyen de paiement. Idempotent par cycle de facturation — anti-doublon
    /// via <see cref="Tenant.SubscriptionRenewalReminderSentAt"/> : on n'envoie qu'une
    /// fois par période. Skip les tenants avec <c>CancelAtPeriodEnd=true</c> (qui ont
    /// déjà choisi de ne pas renouveler — pas besoin de leur rappeler de payer).
    /// </summary>
    Task SendSubscriptionRenewalRemindersAsync(int daysBeforeEnd = 7, CancellationToken ct = default);

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

    /// <summary>
    /// Aligne la quantité de l'item <c>user_supp</c> de la subscription Stripe sur
    /// <paramref name="activeEmployeeCount"/> − <c>plan.IncludedEmployees</c>.
    /// Idempotent : si la quantité ne change pas, rien n'est poussé. Crée l'item
    /// (price <c>UserSupp:{Plan}:{cycle}</c>) au premier dépassement.
    ///
    /// Appelé :
    ///   - juste après création d'un collaborateur en mode "overage confirmé" (par
    ///     <c>EmployesController.Post</c>) pour facturer immédiatement la prochaine échéance ;
    ///   - quotidiennement par <c>EmployeeBillingSyncService</c> en true-up (collabs
    ///     désactivés/réactivés, imports CSV, divergences diverses).
    /// </summary>
    /// <returns>Quantité finale poussée (≥ 0), ou null si le sync est skip (pas de
    /// subscription Stripe, plan inconnu, price <c>UserSupp</c> non configuré).</returns>
    Task<int?> SyncSupplementaryEmployeesAsync(
        Tenant tenant,
        int activeEmployeeCount,
        CancellationToken ct = default);

    /// <summary>
    /// Pré-achat de sièges supplémentaires : l'admin paye d'avance pour autoriser N
    /// collaborateurs au-delà de l'effectif inclus du pack, sans avoir à créer
    /// immédiatement les employés. Concrètement, on stocke un floor <c>extra_seats_purchased</c>
    /// dans la metadata Stripe de la subscription, et on pousse l'item user_supp
    /// à <c>max(activeOverage, purchased)</c>. <see cref="SyncSupplementaryEmployeesAsync"/>
    /// respecte ce floor (ne réduit jamais en-dessous), donc la pré-allocation tient
    /// jusqu'à la fin du cycle de facturation ou jusqu'à un nouvel achat.
    /// </summary>
    /// <param name="delta">Nombre de sièges à AJOUTER (positif uniquement — la réduction
    /// se fait via downgrade de pack).</param>
    /// <returns>Nouvel état des sièges achetés + coût mensuel estimé. Null si la
    /// subscription n'est pas configurée (pas de Stripe).</returns>
    Task<SeatPurchaseResult?> PurchaseExtraSeatsAsync(
        Tenant tenant,
        int delta,
        int activeEmployeeCount,
        CancellationToken ct = default);

    /// <summary>
    /// Réconcilie l'état d'un tenant avec une subscription Stripe issue d'un
    /// <b>Payment Link</b> (lien <c>buy.stripe.com</c> de la page d'accueil). Contrairement
    /// au Checkout piloté par l'API (qui pose <c>Metadata["plan"]</c> + un item user_supp à 0),
    /// un Payment Link arrive « brut » : pas de metadata plan, et la quantité de
    /// collaborateurs supplémentaires choisie par le client est portée par un item de prix
    /// dédié (mappé sur <c>UserSupp:{Plan}:{cycle}</c>). Cette méthode :
    /// <list type="number">
    /// <item>charge la subscription avec ses items + prix expandés ;</item>
    /// <item>déduit le <c>PlanCode</c> et le cycle depuis le price_id de base
    ///   (reverse-map de <c>Stripe:Prices</c>) ;</item>
    /// <item>lit la quantité de l'item <c>user_supp</c> = collaborateurs supplémentaires
    ///   pré-achetés, et la grave comme floor <c>extra_seats_purchased</c> dans la metadata
    ///   de la subscription (respecté par <see cref="SyncSupplementaryEmployeesAsync"/>).</item>
    /// </list>
    /// Idempotent : un replay du webhook ne réduit jamais le floor existant.
    /// </summary>
    /// <returns>Le pack/cycle dérivés + le nombre de collaborateurs supplémentaires détectés,
    /// ou null si Stripe n'est pas configuré ou la subscription est introuvable.</returns>
    Task<CheckoutProvisionResult?> ApplyCheckoutSubscriptionAsync(
        Tenant tenant,
        string subscriptionId,
        CancellationToken ct = default);
}

/// <summary>
/// Résultat de la réconciliation d'une subscription Payment Link
/// (cf. <see cref="IBillingService.ApplyCheckoutSubscriptionAsync"/>). <c>PlanCode</c>/<c>Cycle</c>
/// sont null si aucun price de base connu n'a pu être identifié dans la subscription.
/// </summary>
public sealed record CheckoutProvisionResult(
    string? PlanCode,
    string? Cycle,
    int ExtraSeatsPurchased,
    IReadOnlyList<string> AddonKeys);

/// <summary>
/// Résultat d'un achat de sièges supplémentaires (cf. <see cref="IBillingService.PurchaseExtraSeatsAsync"/>).
/// </summary>
public sealed record SeatPurchaseResult(
    int PurchasedExtraSeats,
    int CurrentBilledQuantity,
    decimal MonthlyCostEur,
    decimal OverageRatePerSeat);

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
