import { useEffect, useState } from 'react';
import {
  Box, Paper, Typography, Chip, Stack, Button, CircularProgress, Alert, Divider, Link,
} from '@mui/material';
import { useNavigate } from 'react-router-dom';
import DownloadIcon from '@mui/icons-material/Download';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import ArrowBackIcon from '@mui/icons-material/ArrowBackIosNew';
import apiInstance from '../API/apiInstance';
import { useAuth } from '../helper/AuthProvider';

/**
 * Page « Factures Concorde » — liste la facture à venir (preview Stripe basé sur
 * la subscription active + proration) ainsi que l'historique des factures émises
 * (jusqu'à 12 dernières). Source : Stripe Invoice API via /api/billing/invoices.
 *
 * Pas de génération PDF côté Concorde : on expose le lien `hostedInvoiceUrl` /
 * `invoicePdf` fournis par Stripe (jusqu'à 30 jours en mode test, durable en
 * production). Pas de stockage local des factures pour rester PCI/RGPD minimaliste.
 */

interface InvoiceDto {
  id: string;
  number: string | null;
  status: 'upcoming' | 'open' | 'paid' | 'draft' | 'void' | 'uncollectible' | string;
  currency: string;
  amountHt: number;
  amountTtc: number;
  tax: number | null;
  periodStart: string | null;
  periodEnd: string | null;
  issuedAt: string | null;
  dueDate: string | null;
  hostedInvoiceUrl: string | null;
  invoicePdf: string | null;
  description: string | null;
}

interface InvoicesResponse {
  upcoming: InvoiceDto | null;
  history: InvoiceDto[];
}

const fmtMoney = (amount: number, currency = 'EUR') => {
  try {
    return new Intl.NumberFormat('fr-FR', { style: 'currency', currency }).format(amount);
  } catch {
    return `${amount.toFixed(2)} ${currency}`;
  }
};

const fmtDate = (d: string | null) => {
  if (!d) return '—';
  try {
    return new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });
  } catch { return d; }
};

const statusChip = (status: string): { label: string; color: 'success' | 'warning' | 'info' | 'default' | 'error' } => {
  switch (status) {
    case 'paid': return { label: 'Payée', color: 'success' };
    case 'open': return { label: 'En attente', color: 'warning' };
    case 'draft': return { label: 'Brouillon', color: 'default' };
    case 'upcoming': return { label: 'À venir', color: 'info' };
    case 'void': return { label: 'Annulée', color: 'default' };
    case 'uncollectible': return { label: 'Impayée', color: 'error' };
    default: return { label: status, color: 'default' };
  }
};

export default function FacturesConcordePage() {
  const navigate = useNavigate();
  const { planCode } = useAuth();

  const [data, setData] = useState<InvoicesResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await apiInstance.get<InvoicesResponse>('/billing/invoices');
        if (!cancelled) setData(res.data);
      } catch (e: any) {
        if (!cancelled) {
          setError(e?.response?.data?.error || 'Impossible de récupérer vos factures.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  if (loading) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 400 }}>
        <CircularProgress />
      </Box>
    );
  }

  const upcoming = data?.upcoming ?? null;
  const history = data?.history ?? [];

  return (
    <Box sx={{ maxWidth: 980, mx: 'auto', p: { xs: 2, md: 4 } }}>
      <Button
        startIcon={<ArrowBackIcon sx={{ fontSize: 14 }} />}
        onClick={() => navigate('/dashboard/mon-abonnement')}
        sx={{ textTransform: 'none', color: '#0040a1', fontWeight: 600, mb: 1, px: 0 }}
      >
        Retour
      </Button>

      <Typography variant="h4" sx={{ fontWeight: 800, color: '#0f172a', mb: 0.5 }}>
        Vos prochaines factures
      </Typography>
      <Typography sx={{ color: '#64748b', mb: 4 }}>
        Liste des factures émises par Concorde Workforce, à venir et passées. Les justificatifs PDF
        sont hébergés par Stripe (lien direct ci-dessous).
      </Typography>

      {error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}

      <Box sx={{ display: { xs: 'block', md: 'grid' }, gridTemplateColumns: '2fr 1fr', gap: 3 }}>
        {/* Colonne gauche : timeline factures (à venir + historique) */}
        <Box>
          {upcoming && (
            <Paper elevation={0} sx={{
              p: { xs: 2, md: 3 }, mb: 2, borderRadius: '16px',
              border: '1px solid #cdd9ee', bgcolor: '#f8fafc',
            }}>
              <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 1.5 }}>
                <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: '#0040a1' }} />
                <Typography sx={{ fontWeight: 700, color: '#0040a1', fontSize: 14 }}>
                  À venir — {fmtDate(upcoming.periodStart)}
                </Typography>
              </Stack>
              <InvoiceRow inv={upcoming} />
            </Paper>
          )}

          {history.length === 0 && !upcoming && (
            <Paper elevation={0} sx={{ p: 4, textAlign: 'center', borderRadius: '16px', border: '1px solid #e2e8f0' }}>
              <Typography sx={{ color: '#64748b', mb: 1 }}>Aucune facture à afficher pour l'instant.</Typography>
              <Typography sx={{ color: '#94a3b8', fontSize: 13 }}>
                Vos factures apparaîtront ici dès le premier prélèvement Stripe.
              </Typography>
            </Paper>
          )}

          {history.map((inv, idx) => (
            <Paper key={inv.id} elevation={0} sx={{
              p: { xs: 2, md: 3 }, mb: 2, borderRadius: '16px',
              border: '1px solid #e2e8f0',
            }}>
              <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 1.5 }}>
                <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: idx === 0 ? '#0040a1' : '#cbd5e1' }} />
                <Typography sx={{ fontWeight: 700, color: '#0f172a', fontSize: 14 }}>
                  le {fmtDate(inv.issuedAt)}
                </Typography>
                <Box sx={{ flex: 1 }} />
                <Chip
                  label={statusChip(inv.status).label}
                  size="small"
                  color={statusChip(inv.status).color === 'default' ? undefined : statusChip(inv.status).color}
                  sx={{ fontWeight: 700 }}
                />
              </Stack>
              <InvoiceRow inv={inv} />
            </Paper>
          ))}
        </Box>

        {/* Colonne droite : récap pack + explication du calcul */}
        <Box>
          <Paper elevation={0} sx={{
            p: 3, borderRadius: '16px', border: '1px solid #e2e8f0', mb: 2,
            position: { md: 'sticky' }, top: { md: 16 },
          }}>
            <Typography sx={{ fontSize: 12, fontWeight: 700, color: '#0040a1', textTransform: 'uppercase', letterSpacing: '0.05em', mb: 1 }}>
              Votre pack
            </Typography>
            <Typography sx={{ fontWeight: 800, color: '#0f172a', mb: 0.5, fontSize: 18 }}>
              {planCode || 'Aucun pack'}
            </Typography>
            {upcoming && (
              <Typography sx={{ color: '#64748b', fontSize: 13 }}>
                Prochaine échéance : <strong>{fmtDate(upcoming.periodStart)}</strong>
              </Typography>
            )}

            <Divider sx={{ my: 2 }} />

            <Typography sx={{ fontSize: 12, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em', mb: 1 }}>
              Calcul de votre facture
            </Typography>
            <Typography sx={{ color: '#475569', fontSize: 13, lineHeight: 1.6 }}>
              Votre abonnement Concorde Workforce couvre la période indiquée. Les montants
              affichés sont calculés au prorata si vous changez de pack en cours de période
              (Stripe applique automatiquement la régularisation sur la facture suivante).
            </Typography>
          </Paper>
        </Box>
      </Box>
    </Box>
  );
}

function InvoiceRow({ inv }: { inv: InvoiceDto }) {
  return (
    <Box>
      <Typography sx={{ fontWeight: 700, color: '#0f172a', fontSize: 15, mb: 0.5 }}>
        {inv.description || 'Abonnement Concorde Workforce'}
      </Typography>
      {(inv.periodStart || inv.periodEnd) && (
        <Typography sx={{ color: '#64748b', fontSize: 13, mb: 1.5 }}>
          du {fmtDate(inv.periodStart)} au {fmtDate(inv.periodEnd)}
        </Typography>
      )}
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems={{ sm: 'center' }} justifyContent="space-between">
        <Box>
          <Typography sx={{ color: '#475569', fontSize: 13 }}>
            Total HT : <strong style={{ color: '#0f172a' }}>{fmtMoney(inv.amountHt, inv.currency)}</strong>
          </Typography>
          <Typography sx={{ color: '#475569', fontSize: 13 }}>
            Total TTC : <strong style={{ color: '#0f172a' }}>{fmtMoney(inv.amountTtc, inv.currency)}</strong>
          </Typography>
        </Box>
        <Stack direction="row" spacing={1}>
          {inv.hostedInvoiceUrl && (
            <Button
              size="small"
              variant="outlined"
              endIcon={<OpenInNewIcon sx={{ fontSize: 14 }} />}
              component={Link}
              href={inv.hostedInvoiceUrl}
              target="_blank"
              rel="noopener noreferrer"
              sx={{ textTransform: 'none', fontWeight: 600, borderRadius: '10px' }}
            >
              Voir
            </Button>
          )}
          {inv.invoicePdf && (
            <Button
              size="small"
              variant="contained"
              endIcon={<DownloadIcon sx={{ fontSize: 14 }} />}
              component={Link}
              href={inv.invoicePdf}
              target="_blank"
              rel="noopener noreferrer"
              sx={{ textTransform: 'none', fontWeight: 700, borderRadius: '10px' }}
            >
              PDF
            </Button>
          )}
        </Stack>
      </Stack>
    </Box>
  );
}
