import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';

const BIO_EMAIL_KEY = 'bio_email';
const BIO_PASSWORD_KEY = 'bio_password';
const BIO_TENANT_KEY = 'bio_tenant';
const BIO_ENABLED_KEY = 'bio_enabled';

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
 * Stocke les credentials nécessaires pour un re-login biométrique. On garde le password
 * dans SecureStore (chiffré par OS) — c'est le compromis standard pour un déverrouillage rapide.
 * À éviter pour des comptes hautement sensibles (préférer alors un refresh-token long).
 */
export async function enableBiometricLogin(email: string, password: string, tenantSlug?: string): Promise<void> {
  await SecureStore.setItemAsync(BIO_EMAIL_KEY, email);
  await SecureStore.setItemAsync(BIO_PASSWORD_KEY, password);
  if (tenantSlug) await SecureStore.setItemAsync(BIO_TENANT_KEY, tenantSlug);
  await SecureStore.setItemAsync(BIO_ENABLED_KEY, '1');
}

export async function disableBiometricLogin(): Promise<void> {
  await SecureStore.deleteItemAsync(BIO_EMAIL_KEY);
  await SecureStore.deleteItemAsync(BIO_PASSWORD_KEY);
  await SecureStore.deleteItemAsync(BIO_TENANT_KEY);
  await SecureStore.deleteItemAsync(BIO_ENABLED_KEY);
}

export async function isBiometricLoginEnabled(): Promise<boolean> {
  const flag = await SecureStore.getItemAsync(BIO_ENABLED_KEY);
  return flag === '1';
}

export async function getStoredBiometricCredentials(): Promise<
  { email: string; password: string; tenantSlug: string | null } | null
> {
  const email = await SecureStore.getItemAsync(BIO_EMAIL_KEY);
  const password = await SecureStore.getItemAsync(BIO_PASSWORD_KEY);
  if (!email || !password) return null;
  const tenantSlug = await SecureStore.getItemAsync(BIO_TENANT_KEY);
  return { email, password, tenantSlug };
}
