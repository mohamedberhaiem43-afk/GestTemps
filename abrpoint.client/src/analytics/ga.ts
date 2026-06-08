/**
 * Google Analytics 4 — Google Consent Mode v2 (mode « avancé »).
 *
 * Posture : gtag.js est chargé DÈS LE DÉMARRAGE avec un consentement par défaut
 * `denied` sur tous les signaux. Tant que l'utilisateur n'a pas accepté :
 *   • aucun cookie n'est déposé ;
 *   • GA n'envoie que des pings anonymes « cookieless » (modélisation), sans
 *     identifiant ni donnée personnelle — c'est le mécanisme RGPD officiel de Google.
 * Quand l'utilisateur accepte, on passe les signaux concernés à `granted` via
 * `gtag('consent','update',…)` et la collecte cookie-based démarre.
 *
 * Pourquoi charger gtag avant consentement (vs. l'ancienne approche « rien avant
 * accord ») : les paramètres UTM (campagnes LinkedIn, etc.) sont présents dans
 * l'URL d'atterrissage. En chargeant gtag immédiatement + `url_passthrough`, la
 * source de campagne est capturée et conservée même avant/sans cookies, puis
 * correctement attribuée à la session dès l'acceptation. Sans ça, un visiteur qui
 * naviguait avant d'accepter perdait ses UTM → session classée « direct ».
 *
 * Mapping consentement ↔ signaux Consent Mode :
 *   • catégorie « audience »  → analytics_storage
 *   • catégorie « marketing » → ad_storage / ad_user_data / ad_personalization
 *
 * `wait_for_update: 500` laisse 500 ms à la bannière pour pousser un `update`
 * avant l'envoi du 1er hit : pour un visiteur déjà consentant, le page_view initial
 * part donc directement en `granted`.
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
  }
}

let bootstrapped = false;       // gtag.js a-t-il été initialisé (consent default + config) ?
let spaHooksInstalled = false;  // les hooks d'historique SPA sont-ils posés ?

// Initialise gtag avec Consent Mode v2. Appelé UNE fois au démarrage, quel que soit
// l'état du consentement : le consentement par défaut `denied` garantit qu'aucun
// cookie n'est posé tant que l'utilisateur n'a pas accepté.
function bootstrapGtag() {
  if (bootstrapped) return;
  bootstrapped = true;

  window.dataLayer = window.dataLayer || [];
  // gtag doit pousser les `arguments` bruts dans dataLayer (signature officielle GA).
  window.gtag = function gtag() {
    // eslint-disable-next-line prefer-rest-params
    window.dataLayer!.push(arguments);
  };

  // ── Consent Mode v2 : tout refusé PAR DÉFAUT (avant config, donc avant tout hit).
  window.gtag('consent', 'default', {
    analytics_storage: 'denied',
    ad_storage: 'denied',
    ad_user_data: 'denied',
    ad_personalization: 'denied',
    wait_for_update: 500,
  });
  // Conserve les UTM / click IDs via l'URL quand les cookies sont refusés (attribution
  // de campagne sans cookie) et caviarde les données pub tant que `ad_storage` est denied.
  window.gtag('set', 'url_passthrough', true);
  window.gtag('set', 'ads_data_redaction', true);

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

// Met à jour les signaux Consent Mode selon les catégories acceptées. gtag mémorise
// l'état : passer `analytics_storage` à granted déclenche la collecte cookie-based
// (et l'envoi des hits modélisés en attente), le repasser à denied la stoppe.
function updateConsent(audience: boolean, marketing: boolean) {
  if (!window.gtag) return;
  window.gtag('consent', 'update', {
    analytics_storage: audience ? 'granted' : 'denied',
    ad_storage: marketing ? 'granted' : 'denied',
    ad_user_data: marketing ? 'granted' : 'denied',
    ad_personalization: marketing ? 'granted' : 'denied',
  });
}

/**
 * Envoie un événement GA (conversions, clics…). gtag étant toujours initialisé
 * (Consent Mode v2), l'event part dans tous les cas : sous consentement refusé il
 * est géré/modélisé sans cookie ; accepté, il est collecté normalement. No-op
 * uniquement hors navigateur (SSR) → sûr à appeler partout sans garde.
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

  // Consent Mode v2 : on initialise gtag immédiatement (consentement par défaut
  // `denied`), puis on applique le consentement déjà enregistré pour le visiteur
  // récurrent — grâce à `wait_for_update`, son page_view initial part en `granted`.
  bootstrapGtag();
  updateConsent(hasConsent('audience'), hasConsent('marketing'));

  // Changement de consentement via la bannière / le panneau « Gérer mes cookies ».
  window.addEventListener('cookie-consent:changed', (e: Event) => {
    const detail = (e as CustomEvent).detail as
      | { categories?: { audience?: boolean; marketing?: boolean } }
      | undefined;
    updateConsent(Boolean(detail?.categories?.audience), Boolean(detail?.categories?.marketing));
  });

  // Retrait total du consentement → tous les signaux repassent à denied.
  window.addEventListener('cookie-consent:cleared', () => updateConsent(false, false));
}
