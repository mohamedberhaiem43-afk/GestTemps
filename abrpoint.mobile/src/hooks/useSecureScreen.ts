import { useEffect } from 'react';
import {
  preventScreenCaptureAsync,
  allowScreenCaptureAsync,
  addScreenshotListener,
} from 'expo-screen-capture';
import { Alert } from 'react-native';

/**
 * Active la protection screenshot/recording sur l'écran courant.
 *
 * Comportement par plateforme :
 *   - Android : applique FLAG_SECURE → screenshot impossible, preview recent-apps
 *     remplacée par un écran noir système (protection complète).
 *   - iOS : ne peut pas EMPÊCHER le screenshot (limite OS), mais détecte
 *     l'événement et affiche un avertissement à l'utilisateur. Le BackgroundShield
 *     (cf. App.tsx) couvre l'écran quand l'app passe en background pour cacher
 *     le contenu sensible dans la preview multi-tâches iOS.
 *
 * Usage : appeler `useSecureScreen()` au top d'un composant écran qui affiche
 * des données sensibles (bulletin paie, signature, données médicales, etc.).
 *
 * Le hook nettoie automatiquement à l'unmount (autres écrans non sensibles
 * peuvent être screenshotés normalement).
 */
export function useSecureScreen(enabled: boolean = true): void {
  useEffect(() => {
    if (!enabled) return;

    let removed = false;
    preventScreenCaptureAsync().catch(() => { /* best-effort, certaines preview Expo Go ne supportent pas */ });

    const sub = addScreenshotListener(() => {
      // iOS-only en pratique : Android ne fait pas remonter l'event car
      // le screenshot est bloqué par FLAG_SECURE en amont.
      Alert.alert(
        '⚠️ Capture détectée',
        "Cet écran contient des données confidentielles. Les captures d'écran sont déconseillées.",
      );
    });

    return () => {
      if (removed) return;
      removed = true;
      sub.remove();
      allowScreenCaptureAsync().catch(() => { /* noop */ });
    };
  }, [enabled]);
}
