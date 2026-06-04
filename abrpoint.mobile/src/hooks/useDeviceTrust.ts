import { useEffect, useState } from 'react';
import { assessDeviceTrust, DeviceTrustReport } from '../services/deviceSecurity';
import { useAuth } from '../contexts/AuthContext';

let cached: DeviceTrustReport | null = null;

/**
 * Évalue une fois et met en cache (les caractéristiques du device ne changent
 * pas en cours de session). Tous les composants qui appellent ce hook récupèrent
 * la même évaluation sans re-trigger expo-device.
 *
 * Plan gating : la feature « Device Trust » fait partie du pack Premium. Sur
 * Standard, on retourne `null` sans évaluer le device — DeviceTrustBanner ne
 * s'affichera pas et l'app reste fonctionnelle. Pendant l'essai, toutes les
 * features sont actives ⇒ évaluation comme un Premium.
 */
export function useDeviceTrust(): DeviceTrustReport | null {
  const { user } = useAuth();
  const enabled = user?.planFeatures?.deviceTrustEnforced ?? true;
  const [report, setReport] = useState<DeviceTrustReport | null>(cached);

  useEffect(() => {
    if (!enabled) {
      setReport(null);
      return;
    }
    if (cached) return;
    let mounted = true;
    assessDeviceTrust()
      .then(r => {
        cached = r;
        if (mounted) setReport(r);
      })
      .catch(() => {
        // En cas d'échec (expo-device indispo en SSR/web, etc.), on bascule
        // sur "unknown" — on ne bloque pas l'app pour autant.
        const fallback: DeviceTrustReport = {
          level: 'unknown',
          isPhysicalDevice: true,
          isEmulator: false,
          reasons: ['assessment_failed'],
          platform: 'other',
          fingerprint: { osVersion: null, brand: null, model: null, yearClass: null },
        };
        cached = fallback;
        if (mounted) setReport(fallback);
      });
    return () => { mounted = false; };
  }, [enabled]);

  return enabled ? report : null;
}
