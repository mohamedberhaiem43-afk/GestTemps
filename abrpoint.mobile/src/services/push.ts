import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import apiService from './api';

const REGISTERED_TOKEN_KEY = 'push_registered_token';
const DEVICE_ID_KEY = 'push_device_id';

/**
 * Configure le handler des notifications reçues quand l'app est ouverte (toast in-app + son).
 * À appeler une fois au démarrage de l'app (depuis App.tsx).
 */
export function configureNotificationHandler() {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
      // SDK Notifications 0.31+ exige les flags banner/list explicites.
      shouldShowBanner: true,
      shouldShowList: true,
    } as any),
  });
}

async function getOrCreateDeviceId(): Promise<string> {
  let id = await SecureStore.getItemAsync(DEVICE_ID_KEY);
  if (!id) {
    id = `${Platform.OS}-${Math.random().toString(36).slice(2, 10)}-${Date.now()}`;
    await SecureStore.setItemAsync(DEVICE_ID_KEY, id);
  }
  return id;
}

/**
 * Demande la permission, récupère le token Expo, et l'enregistre côté backend.
 * Idempotent : si le même token est déjà enregistré sur ce device, on n'appelle pas l'API
 * (on met juste à jour `lastSeenAt` au prochain login).
 *
 * À appeler après un login réussi.
 */
export async function registerForPushAsync(soccod?: string): Promise<{ token: string; registered: boolean } | null> {
  if (!Device.isDevice) {
    // Émulateurs : pas de push réel possible.
    return null;
  }

  try {
    // Sur iOS, on demande explicitement les permissions son + alert + badge.
    // Sans ça, certaines installations héritent d'un mode silencieux par défaut.
    const existing = await Notifications.getPermissionsAsync();
    let status = existing.status;
    if (status !== 'granted') {
      const req = await Notifications.requestPermissionsAsync({
        ios: { allowAlert: true, allowBadge: true, allowSound: true },
      });
      status = req.status;
    }
    if (status !== 'granted') return null;

    if (Platform.OS === 'android') {
      // Channel obligatoire sur Android 8+ pour des notifs visibles + sons.
      // `sound: 'default'` force la sonnerie système à se déclencher (sans ce
      // champ, le canal hérite du mode silencieux selon la version d'Android).
      // `enableVibrate` + `enableLights` pour que la notif soit perceptible.
      await Notifications.setNotificationChannelAsync('default', {
        name: 'Default',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#0040a1',
        sound: 'default',
        enableVibrate: true,
        enableLights: true,
        lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
        showBadge: true,
      });
    }

    const tokenResponse = await Notifications.getExpoPushTokenAsync();
    const token = tokenResponse.data;
    if (!token) return null;

    const lastRegistered = await SecureStore.getItemAsync(REGISTERED_TOKEN_KEY);
    if (lastRegistered === token) {
      // Déjà enregistré sur ce device — on n'appelle pas l'API à chaque démarrage.
      return { token, registered: true };
    }

    const deviceId = await getOrCreateDeviceId();
    await apiService.registerPushToken({
      Token: token,
      Platform: Platform.OS,
      DeviceId: deviceId,
      Soccod: soccod,
    });
    await SecureStore.setItemAsync(REGISTERED_TOKEN_KEY, token);
    return { token, registered: true };
  } catch (e) {
    console.log('Push registration failed:', e);
    return null;
  }
}

/** Appelé au logout pour ne plus enregistrer le même token au prochain login (sera réenregistré proprement). */
export async function clearRegisteredToken(): Promise<void> {
  try { await SecureStore.deleteItemAsync(REGISTERED_TOKEN_KEY); } catch { /* noop */ }
}
