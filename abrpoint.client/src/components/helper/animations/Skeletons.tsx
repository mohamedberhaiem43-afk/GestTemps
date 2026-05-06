import { Box, Skeleton } from '@mui/material';

/**
 * Skeletons « content-shaped » : on reproduit la silhouette du composant
 * final (avatar rond, badge type, dates, pill statut, actions) plutôt qu'un
 * grand rectangle gris générique. Sur les pages avec /me + listes lentes,
 * l'utilisateur perçoit l'app comme rapide même si le 1er paint est tardif.
 *
 * Tous les skeletons sont animés `wave` (gradient qui glisse), pas `pulse` —
 * la wave reste plus discrète quand 5+ skeletons sont empilés.
 */

/**
 * Ligne de demande (congé, autorisation, note de frais) :
 * Avatar ‖ Nom + #ref ‖ Badge type ‖ Dates ‖ Pill statut ‖ 2 boutons
 */
export function ListRowSkeleton() {
  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: '1.5fr 1fr 1.2fr 0.8fr auto',
        alignItems: 'center',
        gap: 2,
        px: 2.5,
        py: 1.5,
        borderBottom: '1px solid #f1f5f9',
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
        <Skeleton variant="circular" width={36} height={36} animation="wave" />
        <Box sx={{ flex: 1 }}>
          <Skeleton variant="text" width="70%" height={16} animation="wave" />
          <Skeleton variant="text" width="40%" height={12} animation="wave" />
        </Box>
      </Box>
      <Skeleton variant="rounded" width={90} height={22} animation="wave" sx={{ borderRadius: '999px' }} />
      <Box>
        <Skeleton variant="text" width="80%" height={14} animation="wave" />
        <Skeleton variant="text" width="50%" height={12} animation="wave" />
      </Box>
      <Skeleton variant="rounded" width={80} height={22} animation="wave" sx={{ borderRadius: '999px' }} />
      <Box sx={{ display: 'flex', gap: 1 }}>
        <Skeleton variant="circular" width={32} height={32} animation="wave" />
        <Skeleton variant="rounded" width={84} height={32} animation="wave" sx={{ borderRadius: '8px' }} />
      </Box>
    </Box>
  );
}

/**
 * Bloc complet de liste : N lignes empilées. Par défaut 5, ajustable.
 */
export function ListSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <Box>
      {Array.from({ length: rows }).map((_, i) => (
        <ListRowSkeleton key={i} />
      ))}
    </Box>
  );
}

/**
 * Carte KPI (gradient + valeur centrale). Reproduit la forme des cartes
 * du dashboard manager, des stats latérales sur DemConge, etc.
 */
export function KpiCardSkeleton({ height = 120 }: { height?: number }) {
  return (
    <Box
      sx={{
        height,
        borderRadius: '16px',
        background: 'linear-gradient(135deg, #f1f5f9 0%, #e2e8f0 100%)',
        p: 2,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
      }}
    >
      <Skeleton variant="text" width="60%" height={14} animation="wave" />
      <Skeleton variant="rounded" width="50%" height={28} animation="wave" />
      <Skeleton variant="text" width="40%" height={12} animation="wave" />
    </Box>
  );
}

/**
 * Grille de cartes KPI — reprend le layout 4 colonnes du dashboard.
 */
export function KpiGridSkeleton({ count = 4 }: { count?: number }) {
  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: { xs: 'repeat(2, 1fr)', sm: `repeat(${Math.min(count, 4)}, 1fr)` },
        gap: 2,
      }}
    >
      {Array.from({ length: count }).map((_, i) => (
        <KpiCardSkeleton key={i} />
      ))}
    </Box>
  );
}

/**
 * Ligne de tableau classique (effectifs, contrats, missions…). Layout
 * tabulaire avec des cellules de largeurs variables.
 */
export function TableRowSkeleton({ columns = 6 }: { columns?: number }) {
  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: `repeat(${columns}, 1fr)`,
        gap: 1.5,
        px: 2,
        py: 1.5,
        borderBottom: '1px solid #f1f5f9',
        alignItems: 'center',
      }}
    >
      {Array.from({ length: columns }).map((_, i) => (
        <Skeleton
          key={i}
          variant="text"
          width={i === 0 ? '90%' : `${50 + ((i * 13) % 40)}%`}
          height={16}
          animation="wave"
        />
      ))}
    </Box>
  );
}

export function TableSkeleton({ rows = 6, columns = 6 }: { rows?: number; columns?: number }) {
  return (
    <Box>
      {Array.from({ length: rows }).map((_, i) => (
        <TableRowSkeleton key={i} columns={columns} />
      ))}
    </Box>
  );
}
