import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';
import apiService from './api';
import { assessDeviceTrust, requireTrust } from './deviceSecurity';

// Clés SecureStore — nouvelles (SEC-G2 : bio-token uniquement, pas de password).
const BIO_TOKEN_KEY = 'bio_token';
const BIO_TENANT_KEY = 'bio_tenant';
const BIO_ENABLED_KEY = 'bio_enabled';

// Clés legacy — supprimées au premier appel post-upgrade pour purger les
// installations existantes qui avaient le password en clair dans SecureStore.
const LEGACY_BIO_EMAIL_KEY = 'bio_email';
const LEGACY_BIO_PASSWORD_KEY = 'bio_password';

export interface BiometricCapabilities {
  hasHardware: boolean;
  isEnrolled: boolean;
  types: LocalAuthentication.AuthenticationType[];
  /** Libellé adaptable (Face ID / Touch ID / biométrie). */
  label: string;
}

/** Détermine si l'appareil supporte la biométrie ET qu'au moins une empreinte/visage est enrôlé. */
export async function getBiometricCapabilities(): Promise<BiometricCapabilities> {
  const [hasHardware, isEnrolled, types] = await Promise.all([
    LocalAuthentication.hasHardwareAsync(),
    LocalAuthentication.isEnrolledAsync(),
    LocalAuthentication.supportedAuthenticationTypesAsync(),
  ]);

  let label = 'Biométrie';
  if (types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) {
    label = 'Reconnaissance faciale';
  } else if (types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) {
    label = 'Empreinte digitale';
  } else if (types.includes(LocalAuthentication.AuthenticationType.IRIS)) {
    label = 'Iris';
  }

  return { hasHardware, isEnrolled, types, label };
}

/** Authentifie l'utilisateur via biométrie (FaceID/TouchID/Iris). */
export async function authenticateBiometric(reason = 'Authentifiez-vous pour vous connecter'): Promise<boolean> {
  const result = await LocalAuthentication.authenticateAsync({
    promptMessage: reason,
    fallbackLabel: 'Utiliser le mot de passe',
    cancelLabel: 'Annuler',
    disableDeviceFallback: false,
  });
  return result.success;
}

/**
 * Active la biométrie pour ce device :
 *   1. Demande au backend un bio-token dédié (lié au compte, expiry 90j, rotaté à chaque usage)
 *   2. Stocke uniquement ce bio-token dans SecureStore (pas le password)
 *
 * Doit être appelé alors que l'utilisateur est DÉJÀ authentifié avec son JWT
 * (le backend exige [Authorize] sur /biometric-enable).
 *
 * Si le tenantSlug est fourni, il est aussi mémorisé pour que le re-login
 * biométrique retombe sur la bonne base multi-tenant.
 */
export async function enableBiometricLogin(tenantSlug?: string): Promise<void> {
  // SEC-G3 : on refuse l'enrôlement biométrique sur émulateur ou device très
  // ancien — le risque que le bio-token soit extrait du Keystore/Keychain est
  // trop élevé. L'utilisateur peut toujours se connecter avec son mot de passe.
  const trust = await assessDeviceTrust();
  requireTrust(trust, 'medium');

  // Purge des anciennes clés legacy (email + password en clair) si présentes.
  await purgeLegacyBiometricKeys();

  const { bioToken } = await apiService.biometricEnable();
  await SecureStore.setItemAsync(BIO_TOKEN_KEY, bioToken);
  if (tenantSlug) await SecureStore.setItemAsync(BIO_TENANT_KEY, tenantSlug);
  await SecureStore.setItemAsync(BIO_ENABLED_KEY, '1');
}

export async function disableBiometricLogin(): Promise<void> {
  // Tente de révoquer côté serveur (best-effort). Important : on tente même
  // si l'utilisateur est déjà déconnecté — le JWT peut être expiré, dans ce
  // cas l'appel échoue silencieusement et le token reste actif côté serveur
  // jusqu'à expiration ou révocation manuelle depuis le portail web.
  try { await apiService.biometricDisable(); } catch { /* noop */ }

  await SecureStore.deleteItemAsync(BIO_TOKEN_KEY);
  await SecureStore.deleteItemAsync(BIO_TENANT_KEY);
  await SecureStore.deleteItemAsync(BIO_ENABLED_KEY);
  await purgeLegacyBiometricKeys();
}

export async function isBiometricLoginEnabled(): Promise<boolean> {
  const flag = await SecureStore.getItemAsync(BIO_ENABLED_KEY);
  return flag === '1';
}

/**
 * Effectue le re-login biométrique : prompt biométrie → POST bio-token →
 * met à jour les tokens d'auth + rote le bio-token. Retourne le user info
 * comme un login classique.
 *
 * À appeler depuis LoginScreen quand l'utilisateur tape sur le bouton bio.
 */
export async function biometricLoginFlow(): Promise<{ user: any } | null> {
  const enabled = await isBiometricLoginEnabled();
  if (!enabled) return null;

  const bioToken = await SecureStore.getItemAsync(BIO_TOKEN_KEY);
  if (!bioToken) return null;

  const ok = await authenticateBiometric('Connexion à Concorde Workly');
  if (!ok) return null;

  const tenantSlug = await SecureStore.getItemAsync(BIO_TENANT_KEY);
  try {
    const result = await apiService.biometricLogin(bioToken, tenantSlug ?? undefined);
    // Rotation : on remplace le bio-token local par le nouveau.
    if (result.bioToken) {
      await SecureStore.setItemAsync(BIO_TOKEN_KEY, result.bioToken);
    }
    // Récupère le user après login pour que AuthContext puisse l'hydrater.
    const user = await apiService.getCurrentUser();
    return { user };
  } catch (err: any) {
    // Bio-token expiré ou révoqué côté serveur → on nettoie et on bascule
    // sur le login classique.
    if (err?.response?.status === 401 || err?.response?.status === 403) {
      await disableBiometricLogin();
    }
    throw err;
  }
}

/**
 * Compat ascendante — l'ancienne API `enableBiometricLogin(email, password, tenant)`
 * est encore appelée par des écrans existants. On garde la signature mais on
 * ignore email/password (ils ne sont plus stockés). Le tenantSlug est conservé.
 */
export async function legacyEnableBiometricLogin(_email: string, _password: string, tenantSlug?: string): Promise<void> {
  return enableBiometricLogin(tenantSlug);
}

/**
 * Stub legacy : retournait email+password. Renvoie maintenant juste le tenantSlug.
 * Les écrans qui s'en servaient pour faire un login email+password auto doivent
 * maintenant appeler biometricLoginFlow().
 */
export async function getStoredBiometricCredentials(): Promise<{ tenantSlug: string | null } | null> {
  const enabled = await isBiometricLoginEnabled();
  if (!enabled) return null;
  const tenantSlug = await SecureStore.getItemAsync(BIO_TENANT_KEY);
  return { tenantSlug };
}

async function purgeLegacyBiometricKeys() {
  await SecureStore.deleteItemAsync(LEGACY_BIO_EMAIL_KEY);
  await SecureStore.deleteItemAsync(LEGACY_BIO_PASSWORD_KEY);
}
