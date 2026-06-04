/**
 * Google Analytics 4 — chargement CONDITIONNÉ AU CONSENTEMENT (catégorie « audience »).
 *
 * Posture CNIL stricte : la mesure d'audience n'est PAS exemptée ici, donc on ne charge
 * RIEN tant que l'utilisateur n'a pas accepté la catégorie « audience » de la bannière
 * cookies. Aucun hit n'est envoyé avant consentement.
 *
 * Cycle de vie :
 *   • au démarrage (initAnalytics) : si « audience » déjà consenti → on charge gtag.
 *   • à chaque changement de consentement (event `cookie-consent:changed`) :
 *       refusé → accepté : on charge gtag (et on track la page courante).
 *       accepté → refusé : on coupe GA via le flag `ga-disable-<ID>` (plus aucun hit).
 *   • retrait total (event `cookie-consent:cleared`) : on coupe GA.
 *
 * SPA : GA4 n'envoie un page_view automatique qu'au 1er chargement. On émet donc un
 * page_view supplémentaire à chaque navigation react-router (pushState/replaceState/
 * popstate), sinon seules les pages d'entrée seraient comptées.
 *
 * CSP : nécessite d'autoriser googletagmanager.com (script-src) et les domaines
 * google-analytics.com / analytics.google.com (connect-src) — cf. nginx.conf.
 */
import { hasConsent } from '../components/helper/CookieConsent';

export const GA_MEASUREMENT_ID = 'G-45Y7SFCDJZ';

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
    [key: `ga-disable-${string}`]: boolean | undefined;
  }
}

let scriptLoaded = false;       // le <script> gtag.js a-t-il été injecté ?
let spaHooksInstalled = false;  // les hooks d'historique SPA sont-ils posés ?

function loadGtagScript() {
  if (scriptLoaded) return;
  scriptLoaded = true;

  window.dataLayer = window.dataLayer || [];
  // gtag doit pousser les `arguments` bruts dans dataLayer (signature officielle GA).
  window.gtag = function gtag() {
    // eslint-disable-next-line prefer-rest-params
    window.dataLayer!.push(arguments);
  };

  const s = document.createElement('script');
  s.async = true;
  s.src = `https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`;
  document.head.appendChild(s);

  window.gtag('js', new Date());
  // anonymize_ip : minimisation RGPD. send_page_view laissé par défaut (1er pageview).
  window.gtag('config', GA_MEASUREMENT_ID, { anonymize_ip: true });

  installSpaPageviewHooks();
}

// Envoie un page_view manuel (navigations SPA, où GA4 ne le fait pas tout seul).
function sendPageView() {
  if (!window.gtag) return;
  window.gtag('event', 'page_view', {
    page_path: window.location.pathname + window.location.search,
    page_location: window.location.href,
    page_title: document.title,
  });
}

function installSpaPageviewHooks() {
  if (spaHooksInstalled) return;
  spaHooksInstalled = true;

  const fire = () => {
    // Laisse react-router mettre à jour le titre/URL avant d'envoyer le hit.
    window.setTimeout(sendPageView, 0);
  };

  const origPush = history.pushState;
  history.pushState = function pushState(...args) {
    const ret = origPush.apply(this, args as Parameters<typeof history.pushState>);
    fire();
    return ret;
  };
  const origReplace = history.replaceState;
  history.replaceState = function replaceState(...args) {
    const ret = origReplace.apply(this, args as Parameters<typeof history.replaceState>);
    fire();
    return ret;
  };
  window.addEventListener('popstate', fire);
}

// Active GA : 1re fois → charge le script (déclenche le pageview initial) ;
// réactivation après un refus → on lève le flag de coupure + on track la page.
function enableGa() {
  window[`ga-disable-${GA_MEASUREMENT_ID}`] = false;
  if (!scriptLoaded) {
    loadGtagScript();
  } else {
    sendPageView();
  }
}

// Coupe GA : flag officiel reconnu par gtag.js → plus aucun hit n'est envoyé.
function disableGa() {
  window[`ga-disable-${GA_MEASUREMENT_ID}`] = true;
}

function applyConsent(audienceGranted: boolean) {
  if (audienceGranted) enableGa();
  else disableGa();
}

/**
 * Envoie un événement GA (conversions, clics…). No-op si GA n'est pas chargé
 * (pas de consentement) → sûr à appeler partout sans garde.
 * Ex. : trackEvent('generate_lead', { form: 'contact-sales' })
 *       trackEvent('sign_up', { method: 'email' })
 *       trackEvent('app_download_click', { platform: 'android' })
 * Pour marquer un événement comme « conversion », l'activer ensuite dans
 * GA → Admin → Événements (« Marquer comme conversion »).
 */
export function trackEvent(name: string, params?: Record<string, unknown>) {
  if (typeof window === 'undefined' || !window.gtag) return;
  window.gtag('event', name, params ?? {});
}

export function initAnalytics() {
  if (typeof window === 'undefined') return;

  // État initial selon le consentement déjà enregistré (aucun hit si non consenti).
  applyConsent(hasConsent('audience'));

  // Changement de consentement via la bannière / le panneau « Gérer mes cookies ».
  window.addEventListener('cookie-consent:changed', (e: Event) => {
    const detail = (e as CustomEvent).detail as
      | { categories?: { audience?: boolean } }
      | undefined;
    applyConsent(Boolean(detail?.categories?.audience));
  });

  // Retrait total du consentement.
  window.addEventListener('cookie-consent:cleared', () => disableGa());
}
