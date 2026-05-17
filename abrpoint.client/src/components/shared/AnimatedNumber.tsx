import React from 'react';
import { Typography } from '@mui/material';

/**
 * Hook utilitaire qui anime une transition numérique de la valeur précédente
 * vers `target` sur `durationMs` via `requestAnimationFrame` avec une courbe
 * `easeOutCubic`. Utilisé pour donner du dynamisme aux chiffres KPI quand ils
 * apparaissent ou changent (passage de période, filtre, etc.).
 *
 * Extrait initialement de Dashboard/DashboardModern.tsx pour être réutilisé
 * sur d'autres pages KPI (SoldeConge, Remboursement, États).
 */
export function useCountUp(target: number, durationMs = 900): number {
  const [display, setDisplay] = React.useState(target);
  const fromRef = React.useRef(target);
  const rafRef = React.useRef<number | null>(null);

  React.useEffect(() => {
    if (!Number.isFinite(target)) {
      setDisplay(target);
      return;
    }
    const from = fromRef.current;
    const to = target;
    if (from === to) {
      setDisplay(to);
      return;
    }
    const start = performance.now();
    const tick = (now: number) => {
      const elapsed = now - start;
      const t = Math.min(1, elapsed / durationMs);
      // easeOutCubic : démarre vite, ralentit en fin de course → "compteur"
      const eased = 1 - Math.pow(1 - t, 3);
      const current = from + (to - from) * eased;
      setDisplay(current);
      if (t < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        fromRef.current = to;
      }
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    };
  }, [target, durationMs]);

  return display;
}

/**
 * Sépare une valeur affichée ("85.2%", "12.3 hrs", "1247", "--") en partie
 * numérique et suffixe pour pouvoir n'animer que le chiffre. Si la valeur n'a
 * pas de partie numérique parseable (ex: "--"), retourne null pour fallback.
 */
export function splitNumeric(value: string | number): { num: number; suffix: string; decimals: number; prefix: string } | null {
  if (typeof value === 'number') {
    return { num: value, suffix: '', decimals: 0, prefix: '' };
  }
  // Accepte un éventuel préfixe non numérique (ex: "€ 1 234,56") avant le nombre.
  // Le suffixe = tout ce qui reste après le nombre (unité, %, devise...).
  const m = String(value).match(/^(\D*?)(-?\d+(?:[.,]\d+)?)(.*)$/);
  if (!m) return null;
  const numStr = m[2].replace(',', '.');
  const num = parseFloat(numStr);
  if (!Number.isFinite(num)) return null;
  const decimals = numStr.includes('.') ? numStr.split('.')[1].length : 0;
  return { num, suffix: m[3], decimals, prefix: m[1] };
}

interface AnimatedNumberProps {
  value: string | number;
  /** Optionnel : sur-écrit le nombre de décimales détecté automatiquement. */
  decimals?: number;
  /** Optionnel : durée de l'animation (défaut 900ms). */
  durationMs?: number;
  /** Optionnel : composant de rendu (par défaut Typography). */
  as?: 'typography' | 'span';
  /**
   * Optionnel : fonction de formatage appliquée à CHAQUE frame d'animation.
   * Permet d'utiliser un format locale (ex. fr-FR avec séparateur de milliers)
   * ou un préfixe/suffixe custom. Si absent, fallback `.toFixed(decimals)` +
   * suffix détecté.
   */
  formatValue?: (n: number) => string;
  className?: string;
  sx?: any;
}

/**
 * Composant qui affiche une valeur en l'animant si elle est numérique.
 * Fallback gracieux : si la valeur n'est pas parseable (ex: "--"), elle est
 * rendue telle quelle sans animation.
 */
export function AnimatedNumber({ value, decimals, durationMs, as = 'typography', formatValue, className, sx }: AnimatedNumberProps) {
  const parsed = splitNumeric(value);
  const target = parsed ? parsed.num : 0;
  const animated = useCountUp(target, durationMs);
  const Comp: any = as === 'span' ? 'span' : Typography;
  if (!parsed) {
    return <Comp className={className} sx={sx}>{value}</Comp>;
  }
  let display: string;
  if (formatValue) {
    display = formatValue(animated);
  } else {
    const fixedDecimals = decimals ?? parsed.decimals;
    display = parsed.prefix + animated.toFixed(fixedDecimals) + parsed.suffix;
  }
  return <Comp className={className} sx={sx}>{display}</Comp>;
}

export default AnimatedNumber;
