import { Box, keyframes } from '@mui/material';
import React from 'react';

/**
 * Page transition fade : enveloppe le contenu d'une route avec une animation
 * d'entrée discrète (fade + translateY 4 px sur 220 ms).
 *
 * Usage :
 *   <PageFade routeKey={pathname}>
 *     <RoutedContent />
 *   </PageFade>
 *
 * En changeant `routeKey`, React remonte le wrapper, ce qui re-déclenche le
 * keyframe — pas besoin de framer-motion ni d'AnimatePresence pour ce besoin
 * « page fade in ». Si l'utilisateur navigue très vite entre deux pages, le
 * fade ne saute pas (chaque mount redémarre l'animation à 0).
 */

// ⚠ Animation OPACITY-ONLY (pas de transform) — choix imposé par un piège CSS :
// dès qu'un wrapper a `transform` (même translateY(0)) OU `will-change: transform`,
// il devient un nouveau "containing block" pour ses descendants `position: fixed`.
// La nav fixée de HomePage (.hp-nav, top:0 + position:fixed) cessait alors d'être
// ancrée au viewport et se faisait scroller avec le contenu (signalé par l'utilisateur
// 2026-05-26 : "le menu ne reste pas fixé après scroll"). En supprimant le translateY
// + le willChange:transform, on garde un fade discret sans casser les fixed descendants.
const pageIn = keyframes`
  from { opacity: 0; }
  to   { opacity: 1; }
`;

interface PageFadeProps {
  routeKey: string;
  children: React.ReactNode;
}

export default function PageFade({ routeKey, children }: PageFadeProps) {
  return (
    <Box
      key={routeKey}
      sx={{
        animation: `${pageIn} 220ms cubic-bezier(0.22, 0.61, 0.36, 1) both`,
        // willChange: 'opacity' uniquement — pas de 'transform' (cf. note ci-dessus).
        willChange: 'opacity',
      }}
    >
      {children}
    </Box>
  );
}
