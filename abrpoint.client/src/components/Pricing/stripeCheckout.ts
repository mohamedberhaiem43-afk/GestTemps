import apiInstance from '../API/apiInstance';

export interface CheckoutPlan {
  plan?: string;
  cycle?: 'monthly' | 'annual';
  userCount?: number;
  packageType?: 'formation' | 'pack' | 'coaching';
}

const successUrl = () => `${window.location.origin}/dashboard?checkout=success&session_id={CHECKOUT_SESSION_ID}`;
const cancelUrl = () => `${window.location.origin}/dashboard/plan-configuration?checkout=cancelled`;

// Demande au backend une session Stripe Checkout puis redirige le navigateur
// vers l'URL hostée par Stripe. La page de paiement est entièrement gérée par
// Stripe — l'app ne collecte plus de données carte.
export async function startStripeCheckout(plan: CheckoutPlan): Promise<void> {
  const { data } = await apiInstance.post('/billing/checkout', {
    planCode: plan.plan ?? 'Standard',
    billingCycle: plan.cycle ?? 'monthly',
    userCount: plan.userCount ?? 1,
    packageType: plan.packageType ?? 'pack',
    successUrl: successUrl(),
    cancelUrl: cancelUrl(),
  });
  if (!data?.url) throw new Error('Réponse Stripe invalide.');
  window.location.href = data.url;
}

// Variante pour les utilisateurs dont la connexion est refusée (tenant en
// "PendingPayment") : on ré-authentifie par email/mot de passe côté serveur,
// qui renvoie l'URL Stripe sans poser de cookie de session.
export async function resumeStripeCheckout(email: string, password: string): Promise<void> {
  const { data } = await apiInstance.post('/billing/resume-checkout', {
    email,
    password,
    successUrl: successUrl(),
    cancelUrl: cancelUrl(),
  });
  if (!data?.url) throw new Error('Réponse Stripe invalide.');
  window.location.href = data.url;
}
