import apiInstance from '../components/API/apiInstance';

/**
 * Heartbeat de position « live » côté web (équivalent du mobile
 * abrpoint.mobile/src/services/liveLocation.ts).
 *
 * Le salarié connecté sur l'app web peut activer un partage de position
 * temporaire pour apparaître sur la carte « Suivi positions » (admin/manager).
 * Sans ce service, seuls les mobiles publiaient des heartbeats — un salarié
 * connecté uniquement via navigateur n'apparaissait jamais sur la carte live,
 * même après avoir « partagé sa position » à la demande du navigateur.
 *
 * Notes :
 *   • API HTML5 Geolocation : ne fonctionne qu'en contexte sécurisé (HTTPS ou
 *     localhost). Sur http:// pur, getCurrentPosition() rejette avec un code
 *     PERMISSION_DENIED systématique — on remonte ce cas à l'appelant.
 *   • Foreground uniquement : on suspend dès que l'onglet passe en arrière-plan
 *     (visibilitychange) et on reprend au retour, sur le même modèle que la
 *     version mobile (AppState). Le navigateur throttle déjà les timers en
 *     onglet caché, ce listener garantit qu'on ne relance pas un tick juste
 *     avant la suspension.
 *   • Auto-stop si le backend renvoie accepted=false (fenêtre RGPD fermée),
 *     pour ne pas marteler l'endpoint avec des refus en boucle.
 */

export interface HeartbeatContext {
  soccod: string;
  empcod: string;
}

const HEARTBEAT_INTERVAL_MS = 60_000;
const POSITION_TIMEOUT_MS = 8_000;
const SESSION_ID = `web-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

let intervalId: ReturnType<typeof setInterval> | null = null;
let visibilityHandler: (() => void) | null = null;
let active = false;
let currentContext: HeartbeatContext | null = null;

export function isLiveLocationSupported(): boolean {
  return typeof navigator !== 'undefined'
    && 'geolocation' in navigator
    && (window.isSecureContext === true || location.hostname === 'localhost');
}

export function isLiveLocationActive(): boolean {
  return active;
}

export function startLiveLocationHeartbeat(ctx: HeartbeatContext) {
  if (!isLiveLocationSupported()) {
    throw new Error('Géolocalisation non disponible — contexte non sécurisé (HTTPS requis).');
  }
  active = true;
  currentContext = ctx;
  if (intervalId) clearInterval(intervalId);

  // Premier tick immédiat pour ne pas attendre 60s avant d'apparaître sur la carte.
  void tick();
  intervalId = setInterval(() => { void tick(); }, HEARTBEAT_INTERVAL_MS);

  if (!visibilityHandler) {
    visibilityHandler = () => {
      if (!active) return;
      if (document.visibilityState === 'visible') {
        // Retour foreground → tick immédiat (la position était figée pendant
        // que l'onglet était caché ; les timers JS sont throttlés à 1/min ou
        // plus rarement par les navigateurs récents).
        void tick();
      }
    };
    document.addEventListener('visibilitychange', visibilityHandler);
  }
}

export function stopLiveLocationHeartbeat() {
  active = false;
  currentContext = null;
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }
  if (visibilityHandler) {
    document.removeEventListener('visibilitychange', visibilityHandler);
    visibilityHandler = null;
  }
}

function getCurrentPositionPromise(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: false,
      maximumAge: 30_000,
      timeout: POSITION_TIMEOUT_MS,
    });
  });
}

async function tick() {
  if (!active || !currentContext) return;
  if (document.visibilityState === 'hidden') return;
  try {
    const pos = await getCurrentPositionPromise();
    const lat = pos.coords?.latitude;
    const lon = pos.coords?.longitude;
    if (typeof lat !== 'number' || typeof lon !== 'number') return;
    if (lat === 0 && lon === 0) return; // garde-fou « default location »

    const acc = typeof pos.coords?.accuracy === 'number'
      ? Math.round(pos.coords.accuracy)
      : undefined;

    const resp = await apiInstance.post('/Presences/live-location', {
      soccod: currentContext.soccod,
      empcod: currentContext.empcod,
      lat,
      lon,
      acc,
      sessionId: SESSION_ID,
    });

    // Fenêtre RGPD fermée côté tenant → on arrête.
    if (resp?.data?.accepted === false) {
      stopLiveLocationHeartbeat();
    }
  } catch {
    // Best-effort : permission refusée, GPS indisponible, réseau coupé,
    // backend en erreur… On laisse le prochain tick retenter dans 60s.
    // Pas de log : éviter de spammer la console à chaque échec ponctuel.
  }
}
