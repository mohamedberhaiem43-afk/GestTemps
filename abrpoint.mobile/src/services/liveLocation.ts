import * as Location from 'expo-location';
import { AppState, AppStateStatus } from 'react-native';
import { apiService } from './api';

/**
 * Heartbeat de position « live » côté mobile.
 *
 * Le salarié pointé est traqué EN TEMPS RÉEL pour que l'admin/manager le voie
 * sur la carte (PositionTrackingPage côté web). On capture la position TOUTES
 * LES 60 SECONDES et on la POST au backend (`/Presences/live-location`). Le
 * backend upsert dans la table `live_position` qui n'a qu'une ligne par salarié.
 *
 * Choix de design :
 *   • Foreground-only : pas de background location iOS/Android (refus
 *     Apple/Google sans justification métier solide, et coût batterie élevé).
 *     Le heartbeat ne tourne QUE quand l'app est ouverte ET que le salarié est
 *     marqué « clocked in » par l'écran HomeScreen. Si l'utilisateur met l'app
 *     en arrière-plan → on stoppe ; au retour foreground (cf. AppState
 *     listener), on relance si le drapeau "clocked in" est toujours actif.
 *   • Accuracy.Balanced : compromise entre précision (~10-30 m, suffisant
 *     pour la visualisation carte) et batterie (vs Accuracy.High = GPS continu).
 *   • Timeout 8 s par capture : un échec n'arrête pas le service, on retente
 *     au tick suivant. Évite que le service entier s'écroule si le GPS est
 *     temporairement indisponible (tunnel, intérieur de bâtiment).
 *   • RGPD : si le backend répond `{ accepted: false, reason: 'outside_window' }`,
 *     on arrête le heartbeat — la politique tenant ferme la fenêtre de capture
 *     (ex. soir/week-end). On relancera au prochain start() (= prochain
 *     pointage matinal). Évite de hammer le backend avec des refus en boucle.
 */

let intervalId: ReturnType<typeof setInterval> | null = null;
let appStateSub: { remove: () => void } | null = null;
let active = false; // « clocked in » côté logique métier (drapeau posé par HomeScreen)
let currentContext: HeartbeatContext | null = null;
const sessionId = `mobile-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

const HEARTBEAT_INTERVAL_MS = 60_000; // 60 s — équilibre fraîcheur carte / batterie
const POSITION_TIMEOUT_MS = 8_000;

export interface HeartbeatContext {
  soccod: string;
  empcod: string;
}

/**
 * Démarre le heartbeat. Appelé depuis HomeScreen juste après un pointage
 * d'entrée réussi. Idempotent : appeler 2 fois ne crée pas 2 timers.
 */
export function startLiveLocationHeartbeat(ctx: HeartbeatContext) {
  active = true;
  currentContext = ctx;

  // Stoppe un éventuel timer résiduel (changement d'utilisateur, par exemple).
  if (intervalId) clearInterval(intervalId);

  // Premier tick immédiat — sans ça, l'admin attend 60 s avant la première
  // position visible sur la carte après le pointage.
  void tick();
  intervalId = setInterval(() => { void tick(); }, HEARTBEAT_INTERVAL_MS);

  // Listener AppState : on suspend en background, on reprend en foreground.
  // Indispensable car l'OS peut throttler / suspendre les timers JS quand
  // l'app n'est pas au premier plan.
  if (!appStateSub) {
    appStateSub = AppState.addEventListener('change', onAppStateChange);
  }
}

/**
 * Stoppe le heartbeat. Appelé depuis HomeScreen au pointage de SORTIE
 * (clock-out) ou au logout. Le backend laissera la dernière position visible
 * 30 min avant la purger via LivePositionRetentionHostedService.
 */
export function stopLiveLocationHeartbeat() {
  active = false;
  currentContext = null;
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }
  if (appStateSub) {
    appStateSub.remove();
    appStateSub = null;
  }
}

function onAppStateChange(next: AppStateStatus) {
  if (!active) return;
  if (next === 'active') {
    // Re-déclenche un tick immédiat au retour foreground — la position
    // affichée côté admin pouvait être périmée de plusieurs minutes.
    void tick();
  }
}

async function tick() {
  if (!active || !currentContext) return;
  try {
    const perm = await Location.getForegroundPermissionsAsync();
    if (perm.status !== 'granted') return; // pas de permission → on saute (le user pourra l'accorder plus tard)

    // Race position + timeout — un GPS bloqué ne doit pas faire planter le service.
    const positionPromise = Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('timeout')), POSITION_TIMEOUT_MS)
    );
    const pos: any = await Promise.race([positionPromise, timeoutPromise]);

    // batteryLevel optionnel — pas envoyé pour l'instant (nécessiterait expo-battery
    // qui n'est pas dans les dépendances du projet). À brancher si besoin produit
    // émerge (cf. champ LivePosition.battery_level côté backend déjà prêt).
    const batteryLevel: number | undefined = undefined;

    const lat = pos.coords?.latitude;
    const lon = pos.coords?.longitude;
    if (typeof lat !== 'number' || typeof lon !== 'number') return;
    // Filtre 0,0 — défaut émulateur, position invalide.
    if (lat === 0 && lon === 0) return;

    const acc = typeof pos.coords?.accuracy === 'number' ? Math.round(pos.coords.accuracy) : undefined;

    const resp = await apiService.postLiveLocation({
      soccod: currentContext.soccod,
      empcod: currentContext.empcod,
      lat,
      lon,
      acc,
      sessionId,
      batteryLevel,
    });

    // Si le backend ferme la fenêtre RGPD, on arrête de cogner — on relancera
    // au prochain start() (= prochain pointage par exemple le lendemain matin).
    if (resp && resp.accepted === false) {
      stopLiveLocationHeartbeat();
    }
  } catch {
    // Best-effort. Un échec ponctuel (réseau, GPS, etc.) ne stoppe pas le service.
    // Le prochain tick (60 s) retentera ; pas de log pour ne pas spammer.
  }
}
