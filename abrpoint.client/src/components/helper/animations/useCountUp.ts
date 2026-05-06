import { useEffect, useRef, useState } from 'react';

/**
 * Compteur animé : interpole une valeur de 0 (ou de la dernière valeur affichée) vers
 * `target` sur `durationMs`. Utilise requestAnimationFrame avec une easing cubic-out
 * pour que le compteur ralentisse en arrivant sur la cible (perçu plus naturel qu'un
 * lerp linéaire).
 *
 * Renvoie la valeur courante à afficher. À utiliser sur les KPI du dashboard, des
 * fiches de statistiques, etc. — pas sur les valeurs qui changent à haute fréquence
 * (un re-render par frame n'est pas gratuit).
 *
 * Exemple :
 *   const animatedSolde = useCountUp(kpis.solde, { decimals: 1 });
 *   <span>{animatedSolde}</span>
 */
export interface CountUpOptions {
  /** Durée de l'interpolation en ms. Défaut 700 ms. */
  durationMs?: number;
  /** Nombre de décimales à afficher. Défaut 0. */
  decimals?: number;
  /** Si true, démarre toujours de 0 plutôt que de la dernière valeur affichée. */
  resetOnChange?: boolean;
}

export function useCountUp(target: number, opts: CountUpOptions = {}): string {
  const { durationMs = 700, decimals = 0, resetOnChange = false } = opts;
  const [display, setDisplay] = useState(target);
  const fromRef = useRef(target);
  const startTsRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    // Si la valeur n'a pas réellement changé, on ne lance pas d'animation : ça évite
    // des re-renders inutiles à chaque navigation entre onglets qui repropage la
    // même valeur via React Query.
    if (target === display && fromRef.current === target) return;

    fromRef.current = resetOnChange ? 0 : display;
    startTsRef.current = null;

    const tick = (ts: number) => {
      if (startTsRef.current === null) startTsRef.current = ts;
      const elapsed = ts - startTsRef.current;
      const t = Math.min(1, elapsed / durationMs);
      // ease-out cubic — le compteur ralentit en arrivant sur la cible.
      const eased = 1 - Math.pow(1 - t, 3);
      const current = fromRef.current + (target - fromRef.current) * eased;
      setDisplay(current);
      if (t < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        setDisplay(target);
        rafRef.current = null;
      }
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, durationMs, resetOnChange]);

  return display.toFixed(decimals);
}
