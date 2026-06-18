/**
 * Source unique des Payment Links Stripe (Checkout hébergé) par pack × cycle.
 *
 * Utilisé par :
 *   - ChangePlanModal (changement de pack) ;
 *   - TrialBanner (« Passer au plan payant » → paiement du pack en cours d'essai).
 *
 * Le tunnel Stripe de ces liens inclut l'essai 30 j configuré côté Dashboard ; la garde
 * serveur `ApplyCheckoutSubscription` (ABRPOINT.Server) neutralise tout cumul d'essai
 * (essai ancré sur la date d'origine si encore en cours, sinon paiement immédiat).
 *
 * Le webhook `checkout.session.completed` reconnaît le pack (price de base) → bascule le
 * PlanCode et remplace la subscription (l'ancien abonnement pack est annulé). Pour que le
 * paiement soit rattaché au bon tenant, on injecte `?client_reference_id={slug}`.
 */
export type PackKey = 'Starter' | 'Standard' | 'Premium';
export type BillingCycle = 'monthly' | 'annual';

export const PACK_PAYMENT_LINKS: Record<PackKey, Record<BillingCycle, string>> = {
  Starter: {
    monthly: 'https://buy.stripe.com/9B6dR21dX83v9JBcZX00002',
    annual: 'https://buy.stripe.com/aFa9AMcWFgA14ph2lj00003',
  },
  Standard: {
    monthly: 'https://buy.stripe.com/9B628k09TbfHaNF2lj00004',
    annual: 'https://buy.stripe.com/00w4gs2i197z7Bt1hf00005',
  },
  Premium: {
    monthly: 'https://buy.stripe.com/8x24gs1dX83v8Fxgc900006',
    annual: 'https://buy.stripe.com/4gMcMY4q91F7091cZX00007',
  },
};

/** Normalise une chaîne de pack ('standard', 'STANDARD'…) en PackKey, ou null si inconnu. */
export function normalizePackKey(raw?: string | null): PackKey | null {
  if (!raw) return null;
  const norm = raw.trim().charAt(0).toUpperCase() + raw.trim().slice(1).toLowerCase();
  return (norm === 'Starter' || norm === 'Standard' || norm === 'Premium') ? norm : null;
}

/**
 * Construit le Payment Link d'un pack pour le cycle donné, en y injectant le slug du tenant
 * (`?client_reference_id={slug}`) quand il est connu. Renvoie null si le pack/cycle est inconnu.
 */
export function buildPackPaymentLink(pack: PackKey, cycle: BillingCycle, slug?: string | null): string | null {
  const base = PACK_PAYMENT_LINKS[pack]?.[cycle];
  if (!base) return null;
  return slug ? `${base}?client_reference_id=${encodeURIComponent(slug)}` : base;
}
