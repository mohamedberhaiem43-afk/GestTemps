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

const pageIn = keyframes`
  from { opacity: 0; transform: translateY(4px); }
  to   { opacity: 1; transform: translateY(0); }
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
        // Hint navigateur : pendant l'animation seulement, le compositeur sait
        // que opacity + transform peuvent changer. Évite des reflows sur les
        // grandes pages (annuaire 500 lignes).
        willChange: 'opacity, transform',
      }}
    >
      {children}
    </Box>
  );
}
