import { useEffect, useState } from 'react';
import { assessDeviceTrust, DeviceTrustReport } from '../services/deviceSecurity';

let cached: DeviceTrustReport | null = null;

/**
 * Évalue une fois et met en cache (les caractéristiques du device ne changent
 * pas en cours de session). Tous les composants qui appellent ce hook récupèrent
 * la même évaluation sans re-trigger expo-device.
 */
export function useDeviceTrust(): DeviceTrustReport | null {
  const [report, setReport] = useState<DeviceTrustReport | null>(cached);

  useEffect(() => {
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
        };
        cached = fallback;
        if (mounted) setReport(fallback);
      });
    return () => { mounted = false; };
  }, []);

  return report;
}
