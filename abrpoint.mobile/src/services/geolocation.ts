import * as Location from 'expo-location';

export interface GpsCoords {
  latitude: number;
  longitude: number;
  accuracy?: number;
}

export interface GpsResult {
  coords: GpsCoords | null;
  /** "granted" | "denied" | "blocked" | "timeout" | "error" */
  status: 'granted' | 'denied' | 'blocked' | 'timeout' | 'error';
  error?: string;
}

/**
 * Demande la permission et capture la position courante avec un timeout strict.
 * Le pointage doit pouvoir aboutir même si le GPS met trop longtemps : l'appelant
 * peut décider de soumettre quand même, mais on retourne un status explicite.
 */
export async function captureCurrentPosition(timeoutMs = 5000): Promise<GpsResult> {
  try {
    const perm = await Location.getForegroundPermissionsAsync();
    if (perm.status !== 'granted') {
      const req = await Location.requestForegroundPermissionsAsync();
      if (req.status !== 'granted') {
        return { coords: null, status: req.canAskAgain ? 'denied' : 'blocked' };
      }
    }

    // Race entre la lecture GPS et un timeout explicite.
    const positionPromise = Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('timeout')), timeoutMs)
    );

    const pos: any = await Promise.race([positionPromise, timeoutPromise]);
    return {
      coords: {
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
        accuracy: pos.coords.accuracy ?? undefined,
      },
      status: 'granted',
    };
  } catch (e: any) {
    if (e?.message === 'timeout') return { coords: null, status: 'timeout' };
    return { coords: null, status: 'error', error: e?.message };
  }
}
