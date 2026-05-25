import apiInstance from '../API/apiInstance';

export interface CheckoutPlan {
  plan?: string;
  cycle?: 'monthly' | 'annual';
  userCount?: number;
  packageType?: 'formation' | 'pack' | 'coaching';
}

const successUrl = () => `${window.location.origin}/dashboard?checkout=success&session_id={CHECKOUT_SESSION_ID}`;
const cancelUrl = () => `${window.location.origin}/dashboard/plan-configuration?checkout=cancelled`;

// Resume flow : pas de session établie après /billing/resume-checkout (endpoint
// anonyme), donc /dashboard renvoie 401 → redirect /login → re-tentative connect
// qui peut retomber en 402 si le webhook Stripe n'a pas encore flippé le tenant
// (race typique 1-5s). On retombe donc sur /login avec un flag qui pré-remplit
// l'email + affiche un bandeau « Paiement confirmé, reconnectez-vous » et qui
// permettra à la prochaine tentative connect de passer (middleware bypass +
// post-login redirect vers /mon-abonnement si tenant pas encore Active).
const resumeSuccessUrl = (email: string) =>
  `${window.location.origin}/login?reactivated=1&email=${encodeURIComponent(email)}&session_id={CHECKOUT_SESSION_ID}`;

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
    successUrl: resumeSuccessUrl(email),
    cancelUrl: cancelUrl(),
  });
  if (!data?.url) throw new Error('Réponse Stripe invalide.');
  window.location.href = data.url;
}
