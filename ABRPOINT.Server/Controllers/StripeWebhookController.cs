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

        // Replay protection : la signature Stripe valide UN payload + un timestamp dans la
        // fenêtre tolerance (5 min par défaut), mais elle ne dédoublonne PAS les retries.
        // Stripe rejoue tout webhook qui a renvoyé !=2xx ou timeout 30s (jusqu'à 3 jours).
        // Sans cette table, un retry après un crash transient ré-exécute le handler →
        // double subscription, double activation, etc. On insère event_id en clé primaire
        // dès qu'on a une signature valide ; un INSERT en doublon = retry → on renvoie 200.
        await using (var masterDedup = await _masterFactory.CreateDbContextAsync(ct))
        {
            var saveSucceeded = false;
            try
            {
                masterDedup.StripeWebhookSeen.Add(new StripeWebhookSeen
                {
                    EventId = stripeEvent.Id,
                    EventType = stripeEvent.Type,
                });
                await masterDedup.SaveChangesAsync(ct);
                saveSucceeded = true;
            }
            catch (DbUpdateException)
            {
                // PK violation potentielle → vérifier que la ligne existe vraiment avant de
                // swallow l'exception. Sans cette double-vérif, on masquerait un vrai problème
                // SQL transient. C# interdit `await` dans une expression de filtre `when`, d'où
                // ce pattern avec saveSucceeded plutôt que `catch when`.
            }
            if (!saveSucceeded)
            {
                if (await EventAlreadyProcessedAsync(stripeEvent.Id, ct))
                {
                    // Déjà traité avec succès. On renvoie 200 pour que Stripe arrête les retries.
                    // Si la 1ère exécution avait crashé après l'insert mais avant la fin du handler,
                    // Stripe retentera ; ce cas-là est rare et le côté métier est généralement
                    // idempotent (UPDATE Status, MarkActive, etc.).
                    _log.LogInformation("Stripe event {EventId} ({Type}) déjà traité — replay ignoré.", stripeEvent.Id, stripeEvent.Type);
                    return Ok();
                }
                // Échec SaveChanges qui n'est PAS une duplication PK → vrai problème SQL transient.
                // 500 → Stripe retentera ; on log pour audit.
                _log.LogError("Échec dedup pour Stripe event {EventId} ({Type}) sans cause de duplication.", stripeEvent.Id, stripeEvent.Type);
                return StatusCode(500);
            }
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
                    // Émis soit après une résiliation immédiate, soit en fin de période d'une
                    // résiliation planifiée. Dans les deux cas on bascule Cancelled (le précédent
                    // mapping Suspended ne reflétait pas la résiliation utilisateur).
                    var sub = stripeEvent.Data.Object as Subscription;
                    if (!string.IsNullOrEmpty(sub?.CustomerId))
                    {
                        await using var master = await _masterFactory.CreateDbContextAsync(ct);
                        var tenant = await master.Tenants.FirstOrDefaultAsync(t => t.StripeCustomerId == sub.CustomerId, ct);
                        if (tenant != null)
                        {
                            tenant.Status = "Cancelled";
                            tenant.CancelAtPeriodEnd = false;
                            if (tenant.CancellationRequestedAt == null) tenant.CancellationRequestedAt = DateTime.UtcNow;
                            await master.SaveChangesAsync(ct);
                            _tenantStore.Invalidate(tenant.Slug);
                            _log.LogInformation("Tenant {Slug} → Cancelled via webhook subscription.deleted.", tenant.Slug);
                        }
                    }
                    break;
                }
                case "customer.subscription.updated":
                {
                    // Sync cancel_at_period_end + current_period_end depuis Stripe (source de
                    // vérité). Si l'admin résilie depuis le portail Stripe sans passer par
                    // notre /cancel-subscription, on récupère quand même l'état.
                    var sub = stripeEvent.Data.Object as Subscription;
                    if (!string.IsNullOrEmpty(sub?.CustomerId))
                    {
                        await using var master = await _masterFactory.CreateDbContextAsync(ct);
                        var tenant = await master.Tenants.FirstOrDefaultAsync(t => t.StripeCustomerId == sub.CustomerId, ct);
                        if (tenant != null)
                        {
                            tenant.CancelAtPeriodEnd = sub.CancelAtPeriodEnd;
                            if (sub.CurrentPeriodEnd != default) tenant.CurrentPeriodEndsAt = sub.CurrentPeriodEnd;
                            else if (sub.CancelAt != default) tenant.CurrentPeriodEndsAt = sub.CancelAt;
                            if (sub.CancelAtPeriodEnd && tenant.CancellationRequestedAt == null)
                                tenant.CancellationRequestedAt = DateTime.UtcNow;
                            await master.SaveChangesAsync(ct);
                            _tenantStore.Invalidate(tenant.Slug);
                        }
                    }
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
                    // client_reference_id (ou Metadata["tenant_id"]) identifie le tenant. Pour le
                    // Checkout piloté par l'API c'est le Guid du tenant ; pour un Payment Link de
                    // la page d'accueil (buy.stripe.com), le frontend injecte le SLUG via
                    // ?client_reference_id={slug}. On accepte donc les DEUX formes.
                    var tenantRef = session?.ClientReferenceId
                        ?? (session?.Metadata != null && session.Metadata.TryGetValue("tenant_id", out var tid) ? tid : null);
                    if (string.IsNullOrWhiteSpace(tenantRef) || string.IsNullOrEmpty(session?.SubscriptionId))
                    {
                        _log.LogWarning("checkout.session.completed sans tenant_ref ou subscription_id (session={SessionId}).", session?.Id);
                        break;
                    }
                    await using var master = await _masterFactory.CreateDbContextAsync(ct);
                    Tenant? tenant;
                    if (Guid.TryParse(tenantRef, out var tenantId))
                        tenant = await master.Tenants.FirstOrDefaultAsync(t => t.Id == tenantId, ct);
                    else
                    {
                        var refSlug = tenantRef.Trim().ToLowerInvariant();
                        tenant = await master.Tenants.FirstOrDefaultAsync(t => t.Slug == refSlug, ct);
                    }
                    if (tenant is null)
                    {
                        _log.LogWarning("Tenant introuvable pour checkout.session.completed (ref={TenantRef}).", tenantRef);
                        break;
                    }
                    // Le plan de CE checkout vient soit du Metadata["plan"] (Checkout API), soit
                    // du price de base de la subscription (Payment Link de pack), dérivé par
                    // ApplyCheckoutSubscriptionAsync (qui pose aussi le floor de collaborateurs
                    // supplémentaires extra_seats_purchased).
                    string? metaPlan = (session.Metadata != null
                        && session.Metadata.TryGetValue("plan", out var planFromMeta)
                        && !string.IsNullOrWhiteSpace(planFromMeta)) ? planFromMeta : null;

                    CheckoutProvisionResult? provision = null;
                    try
                    {
                        provision = await _billing.ApplyCheckoutSubscriptionAsync(tenant, session.SubscriptionId, ct);
                    }
                    catch (Exception ex)
                    {
                        // Best-effort : la suite reste effective même si la lecture des line items échoue.
                        _log.LogWarning(ex, "ApplyCheckoutSubscription échoué pour tenant {Slug} (session={SessionId}).", tenant.Slug, session.Id);
                    }

                    var planForCheckout = metaPlan ?? provision?.PlanCode;
                    if (!string.IsNullOrEmpty(session.CustomerId)) tenant.StripeCustomerId = session.CustomerId;

                    // Auto-déblocage des modules : si le paiement (pack OU module) porte un price
                    // mappé sur `Addon:{key}:{cycle}`, on ajoute la clé d'addon valide à Tenant.Addons
                    // → GetEffectiveFeatures débloque la fonctionnalité dès le prochain /me. Dédup +
                    // filtre ValidAddonKeys (storage100Go & co. ignorés). Idempotent (HashSet).
                    if (provision?.AddonKeys is { Count: > 0 } detectedAddons)
                    {
                        var merged = PlanCatalog.ParseAddons(tenant.Addons);
                        foreach (var k in detectedAddons)
                            if (PlanCatalog.ValidAddonKeys.Contains(k)) merged.Add(k);
                        tenant.Addons = merged.Count == 0
                            ? null
                            : string.Join(",", merged.OrderBy(a => a, StringComparer.OrdinalIgnoreCase));
                    }

                    // Auto-augmentation du quota de stockage : payer le module « Stockage 100 Go »
                    // (price Storage:block100Go) incrémente le nombre de blocs du tenant. Le quota
                    // effectif = quota pack + blocs × 100 Go (StorageQuotaGuard). Idempotent par
                    // événement (dédup StripeWebhookSeen) : chaque achat compte une fois.
                    if (provision is { ExtraStorageBlocks: > 0 } sp)
                    {
                        tenant.ExtraStorageBlocks += sp.ExtraStorageBlocks;
                        _log.LogInformation(
                            "Tenant {Slug} : +{Blocks} bloc(s) de stockage (100 Go) via Payment Link → total {Total} bloc(s).",
                            tenant.Slug, sp.ExtraStorageBlocks, tenant.ExtraStorageBlocks);
                    }

                    if (!string.IsNullOrWhiteSpace(planForCheckout))
                    {
                        // ── Checkout de PACK : la nouvelle subscription remplace l'abonnement
                        // trial/précédent et active le plan (paiement confirmé). On annule ensuite
                        // l'ancienne subscription pour ne pas avoir deux abonnements actifs.
                        var oldSubId = tenant.StripeSubscriptionId;
                        tenant.StripeSubscriptionId = session.SubscriptionId;
                        tenant.PlanCode = planForCheckout;
                        tenant.Status = "Active";
                        await master.SaveChangesAsync(ct);
                        _tenantStore.Invalidate(tenant.Slug);

                        if (!string.IsNullOrEmpty(oldSubId) && oldSubId != session.SubscriptionId)
                        {
                            try { await new SubscriptionService().CancelAsync(oldSubId, cancellationToken: ct); }
                            catch (StripeException ex) { _log.LogWarning(ex, "Annulation de l'ancienne subscription {OldSubId} échouée.", oldSubId); }
                        }
                    }
                    else
                    {
                        // ── Checkout ADDITIF (Payment Link dédié, sans price de base de pack) :
                        // module (Assistant RH IA, signature, stockage) OU collaborateurs supp.
                        // On ne remplace PAS l'abonnement de pack et on n'annule rien.
                        //
                        // Collaborateurs supp. via lien dédié : la subscription ne porte qu'un item
                        // user_supp → provision.ExtraSeatsPurchased = quantité. Ces sièges sont
                        // facturés par CETTE subscription, donc on les enregistre dans
                        // LinkPurchasedSeats (relève le seuil d'overage + retiré du user_supp du pack
                        // pour éviter le double-paiement). Idempotent par événement (dédup).
                        if (provision is { ExtraSeatsPurchased: > 0 } seatProv)
                        {
                            tenant.LinkPurchasedSeats += seatProv.ExtraSeatsPurchased;
                            _log.LogInformation(
                                "Tenant {Slug} : +{Seats} collaborateur(s) supp. via Payment Link dédié → total {Total}.",
                                tenant.Slug, seatProv.ExtraSeatsPurchased, tenant.LinkPurchasedSeats);
                        }

                        await master.SaveChangesAsync(ct);
                        _tenantStore.Invalidate(tenant.Slug);
                        _log.LogInformation(
                            "checkout.session.completed additif pour {Slug} (sub={Sub}) — abonnement de pack inchangé.",
                            tenant.Slug, session.SubscriptionId);
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

    /// <summary>
    /// Vérifie qu'un event_id figure bien dans la table de dédup. Utilisé pour confirmer
    /// qu'un DbUpdateException vient bien d'une PK violation (déjà traité) et non d'un
    /// autre problème transactionnel — sinon on swallow une vraie erreur silencieusement.
    /// </summary>
    private async Task<bool> EventAlreadyProcessedAsync(string eventId, CancellationToken ct)
    {
        await using var db = await _masterFactory.CreateDbContextAsync(ct);
        return await db.StripeWebhookSeen.AsNoTracking().AnyAsync(e => e.EventId == eventId, ct);
    }
}
