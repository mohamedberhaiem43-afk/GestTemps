import { useEffect, useState } from 'react';
import { Box, Paper, Typography, LinearProgress, Alert, Stack, CircularProgress } from '@mui/material';
import StorageIcon from '@mui/icons-material/Storage';
import apiInstance from '../API/apiInstance';

/**
 * Carte « Stockage utilisé » pour la page Mon abonnement. Lit GET /api/billing/storage-usage
 * qui renvoie un snapshot mis à jour hourly par StorageUsageHostedService côté serveur
 * (mesure réelle = pg_database_size(tenant_db) + taille du dossier uploads/{slug}/).
 *
 * Affichage :
 *   - jauge X Go / Y Go (couleur verte < 70%, orange 70-90%, rouge > 90%)
 *   - pourcentage + libellé du plan
 *   - timestamp "dernière mesure il y a N minutes" pour transparence sur la fraîcheur
 *   - CTA upgrade quand on dépasse 90% — le tenant est prévenu avant d'être bloqué
 *     par le guard côté upload (qui retourne 507).
 */
interface StorageUsage {
  usedMb: number;
  quotaMb: number;
  usedGb: number;
  quotaGb: number;
  percentUsed: number;
  checkedAt: string | null;
  planCode: string | null;
}

function gaugeColor(pct: number): 'success' | 'warning' | 'error' {
  if (pct >= 90) return 'error';
  if (pct >= 70) return 'warning';
  return 'success';
}

function formatRelativeTime(iso: string | null): string {
  if (!iso) return 'jamais';
  try {
    const checked = new Date(iso).getTime();
    const diffMs = Date.now() - checked;
    if (diffMs < 0) return 'à l\'instant';
    const minutes = Math.floor(diffMs / 60_000);
    if (minutes < 1) return 'à l\'instant';
    if (minutes < 60) return `il y a ${minutes} min`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `il y a ${hours} h`;
    const days = Math.floor(hours / 24);
    return `il y a ${days} j`;
  } catch {
    return iso;
  }
}

export default function StorageUsageCard() {
  const [data, setData] = useState<StorageUsage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await apiInstance.get<StorageUsage>('/billing/storage-usage');
        if (!cancelled) setData(res.data);
      } catch (e: any) {
        if (!cancelled) setError(e?.response?.data?.error || 'Impossible de charger l\'utilisation de stockage.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  if (loading) {
    return (
      <Paper elevation={0} sx={{ p: 3, borderRadius: '20px', border: '1px solid #e2e8f0', mb: 3 }}>
        <Stack direction="row" spacing={2} alignItems="center">
          <CircularProgress size={18} />
          <Typography sx={{ color: '#64748b' }}>Chargement du stockage…</Typography>
        </Stack>
      </Paper>
    );
  }

  if (error || !data) {
    return (
      <Alert severity="info" sx={{ mb: 3, borderRadius: '14px' }}>
        {error ?? 'Stockage indisponible.'}
      </Alert>
    );
  }

  const color = gaugeColor(data.percentUsed);
  const overQuota = data.usedMb > data.quotaMb;
  const nearQuota = data.percentUsed >= 90 && !overQuota;

  return (
    <Paper elevation={0} sx={{ p: { xs: 3, md: 4 }, borderRadius: '20px', border: '1px solid #e2e8f0', mb: 3 }}>
      <Stack direction={{ xs: 'column', md: 'row' }} spacing={3} alignItems={{ md: 'center' }} justifyContent="space-between" sx={{ mb: 2 }}>
        <Box>
          <Stack direction="row" spacing={1.2} alignItems="center">
            <StorageIcon sx={{ color: '#64748b' }} />
            <Typography sx={{ fontSize: 12, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Stockage utilisé
            </Typography>
          </Stack>
          <Typography variant="h5" sx={{ fontWeight: 800, color: '#0f172a', mt: 0.5 }}>
            {data.usedGb.toFixed(2)} Go <Typography component="span" sx={{ color: '#64748b', fontWeight: 600, fontSize: 16 }}>/ {data.quotaGb.toFixed(0)} Go</Typography>
          </Typography>
          <Typography sx={{ color: '#475569', fontSize: 13, mt: 0.3 }}>
            Plan {data.planCode ?? '—'} · {data.percentUsed.toFixed(1)}% du quota · dernière mesure {formatRelativeTime(data.checkedAt)}
          </Typography>
        </Box>
      </Stack>

      <LinearProgress
        variant="determinate"
        value={Math.min(100, data.percentUsed)}
        color={color}
        sx={{ height: 12, borderRadius: 6, bgcolor: '#f1f5f9' }}
      />

      {overQuota && (
        <Alert severity="error" sx={{ mt: 2, borderRadius: '14px' }}>
          <Typography sx={{ fontWeight: 700 }}>Quota dépassé</Typography>
          <Typography sx={{ fontSize: 14, mt: 0.3 }}>
            Vous ne pouvez plus téléverser de nouveaux documents. Supprimez des fichiers du coffre-fort
            ou passez à un pack supérieur pour augmenter la capacité.
          </Typography>
        </Alert>
      )}
      {nearQuota && (
        <Alert severity="warning" sx={{ mt: 2, borderRadius: '14px' }}>
          <Typography sx={{ fontSize: 14 }}>
            Vous approchez la limite de votre pack. Pensez à faire le ménage ou à passer à un pack
            supérieur avant d'être bloqué.
          </Typography>
        </Alert>
      )}
    </Paper>
  );
}
