import * as Device from 'expo-device';
import { Platform } from 'react-native';

/**
 * SEC-G3 — Détection root / jailbreak / émulateur.
 *
 * ⚠️ LIMITATION CONNUE : implémentation purement JS basée sur expo-device.
 * Un attaquant motivé sur un device compromis peut hooker ces APIs et
 * retourner false. Pour une détection plus robuste, ajouter `react-native-jail-monkey`
 * (nécessite un EAS dev client, pas Expo Go) — voir Roadmap V1.2.
 *
 * Cette première passe couvre les cas évidents :
 *   - émulateur Android/iOS (Device.isDevice = false)
 *   - signatures de marque/modèle d'émulateurs courants (Genymotion, BlueStacks, etc.)
 *
 * Stratégie : on n'EMPÊCHE pas le fonctionnement de l'app — on rétrograde le
 * niveau de confiance. Les actions sensibles (activation biométrie, signature
 * électronique) demandent une trust level >= 'medium'.
 */

export type TrustLevel = 'high' | 'medium' | 'low' | 'unknown';

export interface DeviceTrustReport {
  level: TrustLevel;
  isPhysicalDevice: boolean;
  isEmulator: boolean;
  reasons: string[];
  platform: 'ios' | 'android' | 'web' | 'other';
}

const KNOWN_EMULATOR_BRANDS = ['google', 'genymotion', 'unknown'];
const KNOWN_EMULATOR_MODELS = [
  'sdk_gphone', 'emulator', 'android sdk',
  'google_sdk', 'genymotion',
  'bluestacks', 'nox',
];

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
  // Sur un produit RH B2B en dev/test ça arrive ; en prod chez le client final
  // c'est un signal fort de tentative de reverse engineering.
  const isPhysicalDevice = Device.isDevice ?? true;
  if (!isPhysicalDevice) {
    reasons.push('emulator_or_simulator');
  }

  // Heuristics modèle (Android principalement)
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

  // OS très ancien = vecteur de risque (vulnérabilités CVE non patchées).
  // iOS < 14 et Android < 9 sont considérés comme à risque élevé.
  const osVersion = Device.osVersion ?? '';
  const majorVersion = parseInt(osVersion.split('.')[0] ?? '0', 10);
  if (Platform.OS === 'ios' && majorVersion > 0 && majorVersion < 14) {
    reasons.push('ios_outdated');
  }
  if (Platform.OS === 'android' && majorVersion > 0 && majorVersion < 9) {
    reasons.push('android_outdated');
  }

  // Détermination du niveau de confiance
  let level: TrustLevel;
  const isEmulator = !isPhysicalDevice || reasons.includes('emulator_signature');
  if (reasons.length === 0) {
    level = 'high';
  } else if (isEmulator || reasons.includes('android_outdated') || reasons.includes('ios_outdated')) {
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
  };
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
