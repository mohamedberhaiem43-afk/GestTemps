import { Box, BoxProps, keyframes } from '@mui/material';

/**
 * Stagger reveal : chaque ligne d'une liste apparaît avec un léger fade + translateY,
 * décalée de 40 ms par rapport à la précédente. L'œil perçoit la liste « se construire »
 * au lieu d'apparaître brutalement, ce qui rend les chargements paginés plus naturels.
 *
 * Usage type :
 *   {items.map((item, i) => (
 *     <StaggerItem key={item.id} index={i}>
 *       ... contenu de la ligne
 *     </StaggerItem>
 *   ))}
 *
 * Le délai est plafonné à ~12 lignes (~480 ms total) pour éviter qu'une liste de 100
 * éléments mette 4 s à finir d'apparaître.
 */

const slideIn = keyframes`
  from { opacity: 0; transform: translateY(6px); }
  to   { opacity: 1; transform: translateY(0); }
`;

interface StaggerItemProps extends BoxProps {
  /** Position de l'item dans la liste (0-based). Sert au calcul du delay. */
  index: number;
  /** Délai par item, en ms. Défaut 40 ms — assez perceptible sans ralentir la liste. */
  step?: number;
  /** Nombre maximum de pas appliqués (au-delà, pas de délai supplémentaire). */
  maxSteps?: number;
}

export function StaggerItem({
  index,
  step = 40,
  maxSteps = 12,
  sx,
  children,
  ...rest
}: StaggerItemProps) {
  const delay = Math.min(index, maxSteps) * step;
  return (
    <Box
      sx={{
        animation: `${slideIn} 320ms cubic-bezier(0.22, 0.61, 0.36, 1) both`,
        animationDelay: `${delay}ms`,
        ...sx,
      }}
      {...rest}
    >
      {children}
    </Box>
  );
}

/**
 * Variante sans wrapper DOM supplémentaire : retourne juste les props sx à fusionner
 * sur un élément existant. Utile quand on veut éviter d'imbriquer une div en plus
 * (ex : sur une cell de Grid CSS où l'ajout d'un parent casserait la mise en page).
 */
export function staggerSx(index: number, step = 40, maxSteps = 12) {
  const delay = Math.min(index, maxSteps) * step;
  return {
    animation: `${slideIn} 320ms cubic-bezier(0.22, 0.61, 0.36, 1) both`,
    animationDelay: `${delay}ms`,
  };
}
