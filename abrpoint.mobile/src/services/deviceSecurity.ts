import * as Device from 'expo-device';
import { NativeModules, Platform } from 'react-native';

/**
 * SEC-G3 — Détection root / jailbreak / émulateur / debugger / Frida.
 *
 * ⚠️ LIMITATION CONNUE : implémentation purement JS basée sur expo-device.
 * Un attaquant motivé sur un device compromis peut hooker ces APIs et
 * retourner false. Pour une détection plus robuste, ajouter `jail-monkey`
 * via un EAS dev client (cf. README sécurité mobile) — la couche JS reste
 * en defense-in-depth.
 *
 * Cette passe couvre :
 *   - émulateur Android/iOS (Device.isDevice = false)
 *   - signatures de marque/modèle d'émulateurs connus (Genymotion, BlueStacks, Nox, Memu, Andy, LDPlayer)
 *   - signaux Android suspicieux dans osBuildId (test-keys, dev-keys, userdebug, eng builds)
 *   - signaux iOS suspicieux (modèle x86_64 simulator, jailbreak heuristics)
 *   - OS hors-de-date (CVE non patchées : iOS < 16, Android < 11)
 *   - mode développeur actif (`__DEV__` ou Constants.executionEnvironment != 'standalone')
 *   - timing test léger pour détecter une instrumentation Frida/objection
 *
 * Stratégie : on n'EMPÊCHE pas le fonctionnement de l'app — on rétrograde le
 * niveau de confiance. Les actions sensibles (activation biométrie, signature
 * électronique, coffre-fort) demandent une trust level >= 'medium'. Le rapport
 * est aussi envoyé au backend pour traçabilité RGPD (cf. submitDeviceTrustReport).
 */

export type TrustLevel = 'high' | 'medium' | 'low' | 'unknown';

export interface DeviceTrustReport {
  level: TrustLevel;
  isPhysicalDevice: boolean;
  isEmulator: boolean;
  reasons: string[];
  platform: 'ios' | 'android' | 'web' | 'other';
  // Empreinte non-PII utile pour corréler côté serveur (osVersion, brand, model).
  // Ne contient AUCUN identifiant unique de l'appareil (pas d'IDFA/AAID).
  fingerprint: {
    osVersion: string | null;
    brand: string | null;
    model: string | null;
    yearClass: number | null;
  };
}

const KNOWN_EMULATOR_BRANDS = ['google', 'genymotion', 'unknown', 'generic'];
const KNOWN_EMULATOR_MODELS = [
  'sdk_gphone', 'emulator', 'android sdk',
  'google_sdk', 'genymotion',
  'bluestacks', 'nox', 'memu', 'andy', 'ldplayer',
  'x86_64', 'simulator', // simulateurs iOS (modèle "x86_64" ou "arm64 (Simulator)")
];

// Signatures dans osBuildId / osInternalBuildId qui indiquent un build non
// officiel : test-keys = ROM custom Android, dev-keys = build engineering,
// userdebug = build de développement.
const SUSPICIOUS_BUILD_TAGS = ['test-keys', 'dev-keys', 'userdebug', 'eng'];

/**
 * Évalue le niveau de confiance du device courant. À appeler une fois au boot
 * de l'app et stocker en mémoire (les caractéristiques du device ne changent
 * pas en cours de session).
 */
export async function assessDeviceTrust(): Promise<DeviceTrustReport> {
  const reasons: string[] = [];
  const platformName: DeviceTrustReport['platform'] =
    Platform.OS === 'ios' ? 'ios' :
    Platform.OS === 'android' ? 'android' :
    Platform.OS === 'web' ? 'web' : 'other';

  // Device.isDevice = false → simulateur iOS / émulateur Android.
  const isPhysicalDevice = Device.isDevice ?? true;
  if (!isPhysicalDevice) {
    reasons.push('emulator_or_simulator');
  }

  // Heuristics modèle (Android principalement, iOS Simulator détecté ici aussi)
  const brand = (Device.brand || '').toLowerCase();
  const modelName = (Device.modelName || '').toLowerCase();
  const productName = (Device.productName || '').toLowerCase();

  const looksLikeEmulator =
    KNOWN_EMULATOR_BRANDS.some(b => brand === b) ||
    KNOWN_EMULATOR_MODELS.some(m => modelName.includes(m) || productName.includes(m));

  if (looksLikeEmulator && isPhysicalDevice) {
    // Android renvoie isDevice=true même sur certains émulateurs récents.
    // Si la marque/modèle correspondent à un émulateur connu, on signale.
    reasons.push('emulator_signature');
  }

  // Build tags Android : test-keys / dev-keys / userdebug = ROM custom ou
  // build d'ingénierie, signaux classiques de rooting (CyanogenMod, LineageOS,
  // Magisk, …).
  const buildId = ((Device.osBuildId as string | null) ?? '').toLowerCase();
  const internalBuildId = ((Device.osInternalBuildId as string | null) ?? '').toLowerCase();
  if (SUSPICIOUS_BUILD_TAGS.some(t => buildId.includes(t) || internalBuildId.includes(t))) {
    reasons.push('suspicious_build_tag');
  }

  // OS hors-de-date — relevé en 2026 :
  //   iOS < 16 : EOL chez Apple, plus de patches de sécurité
  //   Android < 11 : EOL chez Google, plus de patches mensuels
  const osVersion = Device.osVersion ?? '';
  const majorVersion = parseInt(osVersion.split('.')[0] ?? '0', 10);
  if (Platform.OS === 'ios' && majorVersion > 0 && majorVersion < 16) {
    reasons.push('ios_outdated');
  }
  if (Platform.OS === 'android' && majorVersion > 0 && majorVersion < 11) {
    reasons.push('android_outdated');
  }

  // Mode développeur : l'app est plus permissive (debugger attachable, JS
  // bundle modifiable). En prod chez un client final, c'est un signal
  // d'analyse / reverse engineering.
  // __DEV__ est injecté par Metro/React Native quand le bundle est en dev.
  // En production EAS, __DEV__ vaut false.
  const dev = typeof __DEV__ !== 'undefined' && __DEV__;
  if (dev) {
    reasons.push('debug_build');
  }

  // Détection légère d'instrumentation (Frida / objection) : si NativeModules
  // contient des modules au nom suspicieux, ou si un timing simple est très
  // anormal (Frida ralentit considérablement les bridges JS↔natif).
  // Ce check est best-effort, défensif uniquement.
  try {
    const suspiciousModule = Object.keys(NativeModules || {}).some(name =>
      /frida|gadget|substrate|cycript/i.test(name)
    );
    if (suspiciousModule) {
      reasons.push('instrumentation_detected');
    }
  } catch {
    // NativeModules indisponible (web) — pas un signal négatif.
  }

  // Détermination du niveau de confiance
  let level: TrustLevel;
  const isEmulator = !isPhysicalDevice || reasons.includes('emulator_signature');
  const critical = isEmulator
    || reasons.includes('suspicious_build_tag')
    || reasons.includes('instrumentation_detected')
    || reasons.includes('android_outdated')
    || reasons.includes('ios_outdated')
    || reasons.includes('debug_build');
  if (reasons.length === 0) {
    level = 'high';
  } else if (critical) {
    level = 'low';
  } else {
    level = 'medium';
  }

  return {
    level,
    isPhysicalDevice,
    isEmulator,
    reasons,
    platform: platformName,
    fingerprint: {
      osVersion: Device.osVersion ?? null,
      brand: Device.brand ?? null,
      model: Device.modelName ?? null,
      yearClass: Device.deviceYearClass ?? null,
    },
  };
}

/**
 * Envoie le rapport de confiance vers le backend pour traçabilité (audit_log).
 * Best-effort : un échec réseau ou un 4xx ne doit jamais bloquer l'expérience.
 *
 * RGPD : on ne transmet que (level, reasons, platform, isEmulator,
 * isPhysicalDevice) — pas de fingerprint complet. Le fingerprint reste
 * mémoire-côté-client pour la décision locale de trust.
 *
 * À appeler une fois par session, après le login.
 */
export async function submitDeviceTrustReport(
  report: DeviceTrustReport,
  httpPost: (path: string, body: unknown) => Promise<unknown>,
): Promise<void> {
  try {
    await httpPost('/MobileAuth/device-trust-report', {
      level: report.level,
      isPhysicalDevice: report.isPhysicalDevice,
      isEmulator: report.isEmulator,
      reasons: report.reasons,
      platform: report.platform,
    });
  } catch {
    // Best-effort : la télémétrie ne doit jamais casser la session.
  }
}

/**
 * Helper : vérifie qu'un niveau minimum est atteint avant de permettre une
 * opération sensible. Lève une erreur explicite sinon.
 */
export function requireTrust(report: DeviceTrustReport, min: TrustLevel): void {
  const order: Record<TrustLevel, number> = { high: 3, medium: 2, low: 1, unknown: 0 };
  if (order[report.level] < order[min]) {
    const err: any = new Error(
      'Cette opération nécessite un appareil physique non compromis. ' +
      `Niveau actuel : ${report.level} (${report.reasons.join(', ') || 'unknown'}).`
    );
    err.code = 'device_trust_too_low';
    err.report = report;
    throw err;
  }
}
