import { useEffect, useState } from 'react';
import {
  Box, Paper, Typography, Stack, Button, CircularProgress, Alert, Divider, Link,
} from '@mui/material';
import { useNavigate } from 'react-router-dom';
import DownloadIcon from '@mui/icons-material/Download';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import ArrowBackIcon from '@mui/icons-material/ArrowBackIosNew';
import apiInstance from '../API/apiInstance';
import { useAuth } from '../helper/AuthProvider';
import InvoiceReceipt, { type ReceiptSection } from './InvoiceReceipt';
import { ADDON_LABELS } from './moduleCatalog';

/**
 * Page « Factures Concorde » — facture à venir + historique des factures Stripe.
 *
 * Présentation en reçu détaillé (design variante B des maquettes, cf. InvoiceReceipt) :
 *  - Facture à venir : détail LIVE reconstruit depuis /billing/subscription
 *    (abonnement de base + dépassement de sièges + modules souscrits).
 *  - Historique : reçu simple alimenté par les montants agrégés Stripe (HT/TVA/TTC),
 *    Stripe ne fournissant pas le détail ligne par ligne dans ce DTO.
 *
 * Justificatifs PDF hébergés par Stripe (lien direct). Pas de stockage local.
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

// Forme minimale de /billing/subscription nécessaire pour reconstituer le détail de
// la facture à venir (aligné sur PlanInfo/UsageInfo côté MonAbonnementPage).
interface SubPlan {
  displayName: string;
  flatPriceMonthlyEur: number;
  flatPriceAnnualMonthlyEur: number;
  includedEmployees: number;
  overageRatePerEmployeeEur: number;
}
interface SubUsage {
  activeEmployees: number;
  extraEmployees: number;
  extraCostMonthlyEur: number;
}
interface SubResponse {
  planCode: string | null;
  plan?: SubPlan | null;
  usage?: SubUsage | null;
  currentPeriodEndsAt?: string | null;
}

const eur = (n: number) =>
  n.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';

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

// Reconstruit les sections du reçu détaillé de la facture à venir depuis l'abonnement.
function buildUpcomingSections(plan: SubPlan, usage: SubUsage, subscribedAddons: string[]): ReceiptSection[] {
  const sections: ReceiptSection[] = [
    {
      title: 'Abonnement de base',
      lines: [{
        label: `Pack ${plan.displayName}`,
        sublabel: `${plan.includedEmployees} collaborateurs inclus`,
        amountEur: plan.flatPriceMonthlyEur,
        kind: 'base',
      }],
    },
  ];
  if (usage.extraEmployees > 0) {
    sections.push({
      title: 'Collaborateurs supplémentaires',
      tag: { label: 'DÉPASSEMENT', kind: 'over' },
      lines: [{
        label: `Sièges au-delà de ${plan.includedEmployees}`,
        sublabel: `${eur(plan.overageRatePerEmployeeEur)} HT / mois par collaborateur`,
        qty: `${usage.activeEmployees} actifs → ${usage.extraEmployees} supp.`,
        amountEur: usage.extraCostMonthlyEur || usage.extraEmployees * plan.overageRatePerEmployeeEur,
        kind: 'over',
      }],
    });
  }
  if (subscribedAddons.length > 0) {
    sections.push({
      title: 'Modules optionnels',
      tag: { label: `+${subscribedAddons.length} actif${subscribedAddons.length > 1 ? 's' : ''}`, kind: 'module' },
      lines: subscribedAddons.map((a) => ({
        label: ADDON_LABELS[a].label,
        sublabel: ADDON_LABELS[a].description,
        amountEur: ADDON_LABELS[a].priceMonthlyEur,
        kind: 'module' as const,
      })),
    });
  }
  return sections;
}

export default function FacturesConcordePage() {
  const navigate = useNavigate();
  const { planCode, addons } = useAuth();
  const subscribedAddons = (addons ?? []).filter((a) => ADDON_LABELS[a] != null);

  const [data, setData] = useState<InvoicesResponse | null>(null);
  const [sub, setSub] = useState<SubResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        // Les deux appels en parallèle : factures Stripe + abonnement (pour le détail
        // live de la facture à venir). Le second est best-effort (ne bloque pas la page).
        const [invRes, subRes] = await Promise.allSettled([
          apiInstance.get<InvoicesResponse>('/billing/invoices'),
          apiInstance.get<SubResponse>('/billing/subscription'),
        ]);
        if (cancelled) return;
        if (invRes.status === 'fulfilled') setData(invRes.value.data);
        else setError((invRes.reason as any)?.response?.data?.error || 'Impossible de récupérer vos factures.');
        if (subRes.status === 'fulfilled') setSub(subRes.value.data);
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
  const hasLiveDetail = !!(sub?.plan && sub?.usage);

  return (
    <Box sx={{ maxWidth: 980, mx: 'auto', p: { xs: 2, md: 4 } }}>
      <Button
        startIcon={<ArrowBackIcon sx={{ fontSize: 14 }} />}
        onClick={() => navigate('/dashboard/mon-abonnement')}
        sx={{ textTransform: 'none', color: '#14346B', fontWeight: 600, mb: 1, px: 0 }}
      >
        Retour
      </Button>

      <Typography variant="h4" sx={{ fontWeight: 800, color: '#0F1B33', mb: 0.5 }}>
        Vos prochaines factures
      </Typography>
      <Typography sx={{ color: '#6A7691', mb: 4 }}>
        Détail de votre facture à venir et historique de vos factures Concorde Workforce. Les
        justificatifs PDF sont hébergés par Stripe (lien direct ci-dessous).
      </Typography>

      {error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}

      <Box sx={{ display: { xs: 'block', md: 'grid' }, gridTemplateColumns: '2fr 1fr', gap: 3 }}>
        {/* Colonne gauche : facture à venir (reçu détaillé) + historique (reçus simples) */}
        <Box>
          {/* ── Facture à venir ── */}
          <Typography sx={{ fontSize: 12, fontWeight: 700, color: '#14346B', textTransform: 'uppercase', letterSpacing: '0.08em', mb: 1.5 }}>
            Facture à venir{upcoming?.periodStart ? ` — ${fmtDate(upcoming.periodStart)}` : ''}
          </Typography>

          {hasLiveDetail ? (
            <Box sx={{ mb: 3 }}>
              <InvoiceReceipt
                title="Détail de votre prochaine facture"
                cycleLabel={`Pack ${sub!.plan!.displayName}`}
                sections={buildUpcomingSections(sub!.plan!, sub!.usage!, subscribedAddons)}
              />
            </Box>
          ) : upcoming ? (
            <Box sx={{ mb: 3 }}>
              <InvoiceReceipt
                title={upcoming.description || 'Abonnement Concorde Workforce'}
                cycleLabel={planCode ? `Pack ${planCode}` : undefined}
                sections={[{
                  title: 'Abonnement',
                  lines: [{
                    label: upcoming.description || 'Abonnement Concorde Workforce',
                    sublabel: (upcoming.periodStart || upcoming.periodEnd)
                      ? `du ${fmtDate(upcoming.periodStart)} au ${fmtDate(upcoming.periodEnd)}`
                      : undefined,
                    amountEur: upcoming.amountHt,
                    kind: 'base',
                  }],
                }]}
                subtotalHt={upcoming.amountHt}
                tvaAmount={upcoming.tax ?? undefined}
                totalTtc={upcoming.amountTtc}
              />
            </Box>
          ) : (
            <Paper elevation={0} sx={{ p: 4, mb: 3, textAlign: 'center', borderRadius: '16px', border: '1px solid #E4EAF3' }}>
              <Typography sx={{ color: '#6A7691' }}>Aucune facture à venir pour l'instant.</Typography>
            </Paper>
          )}

          {/* ── Historique ── */}
          {history.length > 0 && (
            <>
              <Typography sx={{ fontSize: 12, fontWeight: 700, color: '#6A7691', textTransform: 'uppercase', letterSpacing: '0.08em', mb: 1.5 }}>
                Historique
              </Typography>
              <Stack spacing={2.5}>
                {history.map((inv) => {
                  const sc = statusChip(inv.status);
                  return (
                    <Box key={inv.id}>
                      <InvoiceReceipt
                        title={`Facture du ${fmtDate(inv.issuedAt)}`}
                        cycleLabel={sc.label}
                        totalLabel="Total payé"
                        sections={[{
                          title: 'Détail',
                          lines: [{
                            label: inv.description || 'Abonnement Concorde Workforce',
                            sublabel: (inv.periodStart || inv.periodEnd)
                              ? `du ${fmtDate(inv.periodStart)} au ${fmtDate(inv.periodEnd)}`
                              : undefined,
                            amountEur: inv.amountHt,
                            kind: 'base',
                          }],
                        }]}
                        subtotalHt={inv.amountHt}
                        tvaAmount={inv.tax ?? undefined}
                        totalTtc={inv.amountTtc}
                      />
                      {(inv.hostedInvoiceUrl || inv.invoicePdf) && (
                        <Stack direction="row" spacing={1} justifyContent="flex-end" sx={{ mt: 1 }}>
                          {inv.hostedInvoiceUrl && (
                            <Button
                              size="small" variant="outlined"
                              endIcon={<OpenInNewIcon sx={{ fontSize: 14 }} />}
                              component={Link} href={inv.hostedInvoiceUrl} target="_blank" rel="noopener noreferrer"
                              sx={{ textTransform: 'none', fontWeight: 600, borderRadius: '10px' }}
                            >
                              Voir
                            </Button>
                          )}
                          {inv.invoicePdf && (
                            <Button
                              size="small" variant="contained"
                              endIcon={<DownloadIcon sx={{ fontSize: 14 }} />}
                              component={Link} href={inv.invoicePdf} target="_blank" rel="noopener noreferrer"
                              sx={{ textTransform: 'none', fontWeight: 700, borderRadius: '10px', bgcolor: '#14346B', '&:hover': { bgcolor: '#0f2c5c' } }}
                            >
                              PDF
                            </Button>
                          )}
                        </Stack>
                      )}
                    </Box>
                  );
                })}
              </Stack>
            </>
          )}
        </Box>

        {/* Colonne droite : récap pack + explication du calcul */}
        <Box>
          <Paper elevation={0} sx={{
            p: 3, borderRadius: '16px', border: '1px solid #E4EAF3', mb: 2,
            position: { md: 'sticky' }, top: { md: 16 },
          }}>
            <Typography sx={{ fontSize: 12, fontWeight: 700, color: '#14346B', textTransform: 'uppercase', letterSpacing: '0.05em', mb: 1 }}>
              Votre pack
            </Typography>
            <Typography sx={{ fontWeight: 800, color: '#0F1B33', mb: 0.5, fontSize: 18 }}>
              {sub?.plan?.displayName || planCode || 'Aucun pack'}
            </Typography>
            {(sub?.currentPeriodEndsAt || upcoming?.periodStart) && (
              <Typography sx={{ color: '#6A7691', fontSize: 13 }}>
                Prochaine échéance : <strong>{fmtDate(sub?.currentPeriodEndsAt ?? upcoming?.periodStart ?? null)}</strong>
              </Typography>
            )}

            <Divider sx={{ my: 2 }} />

            <Typography sx={{ fontSize: 12, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em', mb: 1 }}>
              Calcul de votre facture
            </Typography>
            <Typography sx={{ color: '#475569', fontSize: 13, lineHeight: 1.6 }}>
              La facture à venir reprend votre abonnement de base, les éventuels collaborateurs
              au-delà du seuil inclus, et vos modules optionnels. En cas de changement de pack en
              cours de période, Stripe applique automatiquement la régularisation au prorata.
            </Typography>
          </Paper>
        </Box>
      </Box>
    </Box>
  );
}
