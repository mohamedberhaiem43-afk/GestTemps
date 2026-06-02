import { useEffect, useState } from 'react';
import {
  Box, Paper, Typography, Stack, Button, CircularProgress, Alert, Divider, Link,
} from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import DownloadIcon from '@mui/icons-material/Download';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import ArrowBackIcon from '@mui/icons-material/ArrowBackIosNew';
import apiInstance from '../API/apiInstance';
import { useAuth } from '../helper/AuthProvider';
import InvoiceReceipt, { type ReceiptSection } from './InvoiceReceipt';
import { getAddonLabels } from './moduleCatalog';

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

type Lang = 'fr' | 'en';

interface Dict {
  back: string;
  pageTitle: string;
  pageSubtitle: string;
  fetchError: string;
  upcomingLabel: string;
  upcomingReceiptTitle: string;
  noUpcoming: string;
  defaultSubscription: string;
  subscriptionSectionTitle: string;
  historyLabel: string;
  invoiceOfPrefix: string; // "Facture du " / "Invoice from "
  totalPaid: string;
  detailSectionTitle: string;
  periodRange: (from: string, to: string) => string;
  viewBtn: string;
  pdfBtn: string;
  yourPackLabel: string;
  noPack: string;
  nextDueDate: string;
  invoiceCalcLabel: string;
  invoiceCalcText: string;
  // détail facture à venir (sections)
  baseSubscriptionTitle: string;
  packLabel: (name: string) => string;
  includedEmployees: (n: number) => string;
  extraEmployeesTitle: string;
  overageTag: string;
  seatsBeyond: (n: number) => string;
  perEmployeePerMonth: (amount: string) => string;
  seatsQty: (active: number, extra: number) => string;
  optionalModulesTitle: string;
  modulesActiveTag: (n: number) => string;
  // statuts
  statusPaid: string;
  statusOpen: string;
  statusDraft: string;
  statusUpcoming: string;
  statusVoid: string;
  statusUncollectible: string;
}

const FR: Dict = {
  back: 'Retour',
  pageTitle: 'Vos prochaines factures',
  pageSubtitle:
    'Détail de votre facture à venir et historique de vos factures Concorde Workforce. Les justificatifs PDF sont hébergés par Stripe (lien direct ci-dessous).',
  fetchError: 'Impossible de récupérer vos factures.',
  upcomingLabel: 'Facture à venir',
  upcomingReceiptTitle: 'Détail de votre prochaine facture',
  noUpcoming: "Aucune facture à venir pour l'instant.",
  defaultSubscription: 'Abonnement Concorde Workforce',
  subscriptionSectionTitle: 'Abonnement',
  historyLabel: 'Historique',
  invoiceOfPrefix: 'Facture du ',
  totalPaid: 'Total payé',
  detailSectionTitle: 'Détail',
  periodRange: (from, to) => `du ${from} au ${to}`,
  viewBtn: 'Voir',
  pdfBtn: 'PDF',
  yourPackLabel: 'Votre pack',
  noPack: 'Aucun pack',
  nextDueDate: 'Prochaine échéance :',
  invoiceCalcLabel: 'Calcul de votre facture',
  invoiceCalcText:
    'La facture à venir reprend votre abonnement de base, les éventuels collaborateurs au-delà du seuil inclus, et vos modules optionnels. En cas de changement de pack en cours de période, Stripe applique automatiquement la régularisation au prorata.',
  baseSubscriptionTitle: 'Abonnement de base',
  packLabel: (name) => `Pack ${name}`,
  includedEmployees: (n) => `${n} collaborateurs inclus`,
  extraEmployeesTitle: 'Collaborateurs supplémentaires',
  overageTag: 'DÉPASSEMENT',
  seatsBeyond: (n) => `Sièges au-delà de ${n}`,
  perEmployeePerMonth: (amount) => `${amount} HT / mois par collaborateur`,
  seatsQty: (active, extra) => `${active} actifs → ${extra} supp.`,
  optionalModulesTitle: 'Modules optionnels',
  modulesActiveTag: (n) => `+${n} actif${n > 1 ? 's' : ''}`,
  statusPaid: 'Payée',
  statusOpen: 'En attente',
  statusDraft: 'Brouillon',
  statusUpcoming: 'À venir',
  statusVoid: 'Annulée',
  statusUncollectible: 'Impayée',
};

const EN: Dict = {
  back: 'Back',
  pageTitle: 'Your upcoming invoices',
  pageSubtitle:
    'Details of your upcoming invoice and the history of your Concorde Workforce invoices. PDF receipts are hosted by Stripe (direct link below).',
  fetchError: 'Unable to retrieve your invoices.',
  upcomingLabel: 'Upcoming invoice',
  upcomingReceiptTitle: 'Details of your next invoice',
  noUpcoming: 'No upcoming invoice for now.',
  defaultSubscription: 'Concorde Workforce subscription',
  subscriptionSectionTitle: 'Subscription',
  historyLabel: 'History',
  invoiceOfPrefix: 'Invoice from ',
  totalPaid: 'Total paid',
  detailSectionTitle: 'Details',
  periodRange: (from, to) => `from ${from} to ${to}`,
  viewBtn: 'View',
  pdfBtn: 'PDF',
  yourPackLabel: 'Your pack',
  noPack: 'No pack',
  nextDueDate: 'Next due date:',
  invoiceCalcLabel: 'How your invoice is calculated',
  invoiceCalcText:
    'The upcoming invoice includes your base subscription, any employees beyond the included threshold, and your optional modules. If you change pack mid-period, Stripe automatically applies a prorated adjustment.',
  baseSubscriptionTitle: 'Base subscription',
  packLabel: (name) => `${name} pack`,
  includedEmployees: (n) => `${n} employees included`,
  extraEmployeesTitle: 'Additional employees',
  overageTag: 'OVERAGE',
  seatsBeyond: (n) => `Seats beyond ${n}`,
  perEmployeePerMonth: (amount) => `${amount} excl. tax / month per employee`,
  seatsQty: (active, extra) => `${active} active → ${extra} extra`,
  optionalModulesTitle: 'Optional modules',
  modulesActiveTag: (n) => `+${n} active`,
  statusPaid: 'Paid',
  statusOpen: 'Pending',
  statusDraft: 'Draft',
  statusUpcoming: 'Upcoming',
  statusVoid: 'Voided',
  statusUncollectible: 'Uncollectible',
};

const LANG: Record<Lang, Dict> = { fr: FR, en: EN };

const eur = (n: number) =>
  n.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';

const fmtDate = (d: string | null) => {
  if (!d) return '—';
  try {
    return new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });
  } catch { return d; }
};

const statusChip = (status: string, d: Dict): { label: string; color: 'success' | 'warning' | 'info' | 'default' | 'error' } => {
  switch (status) {
    case 'paid': return { label: d.statusPaid, color: 'success' };
    case 'open': return { label: d.statusOpen, color: 'warning' };
    case 'draft': return { label: d.statusDraft, color: 'default' };
    case 'upcoming': return { label: d.statusUpcoming, color: 'info' };
    case 'void': return { label: d.statusVoid, color: 'default' };
    case 'uncollectible': return { label: d.statusUncollectible, color: 'error' };
    default: return { label: status, color: 'default' };
  }
};

// Reconstruit les sections du reçu détaillé de la facture à venir depuis l'abonnement.
function buildUpcomingSections(
  plan: SubPlan,
  usage: SubUsage,
  subscribedAddons: string[],
  d: Dict,
  addonLabels: Record<string, { label: string; description: string; priceMonthlyEur: number }>,
): ReceiptSection[] {
  const sections: ReceiptSection[] = [
    {
      title: d.baseSubscriptionTitle,
      lines: [{
        label: d.packLabel(plan.displayName),
        sublabel: d.includedEmployees(plan.includedEmployees),
        amountEur: plan.flatPriceMonthlyEur,
        kind: 'base',
      }],
    },
  ];
  if (usage.extraEmployees > 0) {
    sections.push({
      title: d.extraEmployeesTitle,
      tag: { label: d.overageTag, kind: 'over' },
      lines: [{
        label: d.seatsBeyond(plan.includedEmployees),
        sublabel: d.perEmployeePerMonth(eur(plan.overageRatePerEmployeeEur)),
        qty: d.seatsQty(usage.activeEmployees, usage.extraEmployees),
        amountEur: usage.extraCostMonthlyEur || usage.extraEmployees * plan.overageRatePerEmployeeEur,
        kind: 'over',
      }],
    });
  }
  if (subscribedAddons.length > 0) {
    sections.push({
      title: d.optionalModulesTitle,
      tag: { label: d.modulesActiveTag(subscribedAddons.length), kind: 'module' },
      lines: subscribedAddons.map((a) => ({
        label: addonLabels[a].label,
        sublabel: addonLabels[a].description,
        amountEur: addonLabels[a].priceMonthlyEur,
        kind: 'module' as const,
      })),
    });
  }
  return sections;
}

export default function FacturesConcordePage() {
  const navigate = useNavigate();
  const { i18n } = useTranslation();
  const lang: Lang = i18n.language === 'en' ? 'en' : 'fr';
  const d = LANG[lang];
  const { planCode, addons } = useAuth();
  const addonLabels = getAddonLabels(lang);
  const subscribedAddons = (addons ?? []).filter((a) => addonLabels[a] != null);

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
        else setError((invRes.reason as any)?.response?.data?.error || d.fetchError);
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
        {d.back}
      </Button>

      <Typography variant="h4" sx={{ fontWeight: 800, color: '#0F1B33', mb: 0.5 }}>
        {d.pageTitle}
      </Typography>
      <Typography sx={{ color: '#6A7691', mb: 4 }}>
        {d.pageSubtitle}
      </Typography>

      {error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}

      <Box sx={{ display: { xs: 'block', md: 'grid' }, gridTemplateColumns: '2fr 1fr', gap: 3 }}>
        {/* Colonne gauche : facture à venir (reçu détaillé) + historique (reçus simples) */}
        <Box>
          {/* ── Facture à venir ── */}
          <Typography sx={{ fontSize: 12, fontWeight: 700, color: '#14346B', textTransform: 'uppercase', letterSpacing: '0.08em', mb: 1.5 }}>
            {d.upcomingLabel}{upcoming?.periodStart ? ` — ${fmtDate(upcoming.periodStart)}` : ''}
          </Typography>

          {hasLiveDetail ? (
            <Box sx={{ mb: 3 }}>
              <InvoiceReceipt
                title={d.upcomingReceiptTitle}
                cycleLabel={d.packLabel(sub!.plan!.displayName)}
                sections={buildUpcomingSections(sub!.plan!, sub!.usage!, subscribedAddons, d, addonLabels)}
              />
            </Box>
          ) : upcoming ? (
            <Box sx={{ mb: 3 }}>
              <InvoiceReceipt
                title={upcoming.description || d.defaultSubscription}
                cycleLabel={planCode ? d.packLabel(planCode) : undefined}
                sections={[{
                  title: d.subscriptionSectionTitle,
                  lines: [{
                    label: upcoming.description || d.defaultSubscription,
                    sublabel: (upcoming.periodStart || upcoming.periodEnd)
                      ? d.periodRange(fmtDate(upcoming.periodStart), fmtDate(upcoming.periodEnd))
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
              <Typography sx={{ color: '#6A7691' }}>{d.noUpcoming}</Typography>
            </Paper>
          )}

          {/* ── Historique ── */}
          {history.length > 0 && (
            <>
              <Typography sx={{ fontSize: 12, fontWeight: 700, color: '#6A7691', textTransform: 'uppercase', letterSpacing: '0.08em', mb: 1.5 }}>
                {d.historyLabel}
              </Typography>
              <Stack spacing={2.5}>
                {history.map((inv) => {
                  const sc = statusChip(inv.status, d);
                  return (
                    <Box key={inv.id}>
                      <InvoiceReceipt
                        title={`${d.invoiceOfPrefix}${fmtDate(inv.issuedAt)}`}
                        cycleLabel={sc.label}
                        totalLabel={d.totalPaid}
                        sections={[{
                          title: d.detailSectionTitle,
                          lines: [{
                            label: inv.description || d.defaultSubscription,
                            sublabel: (inv.periodStart || inv.periodEnd)
                              ? d.periodRange(fmtDate(inv.periodStart), fmtDate(inv.periodEnd))
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
                              {d.viewBtn}
                            </Button>
                          )}
                          {inv.invoicePdf && (
                            <Button
                              size="small" variant="contained"
                              endIcon={<DownloadIcon sx={{ fontSize: 14 }} />}
                              component={Link} href={inv.invoicePdf} target="_blank" rel="noopener noreferrer"
                              sx={{ textTransform: 'none', fontWeight: 700, borderRadius: '10px', bgcolor: '#14346B', '&:hover': { bgcolor: '#0f2c5c' } }}
                            >
                              {d.pdfBtn}
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
              {d.yourPackLabel}
            </Typography>
            <Typography sx={{ fontWeight: 800, color: '#0F1B33', mb: 0.5, fontSize: 18 }}>
              {sub?.plan?.displayName || planCode || d.noPack}
            </Typography>
            {(sub?.currentPeriodEndsAt || upcoming?.periodStart) && (
              <Typography sx={{ color: '#6A7691', fontSize: 13 }}>
                {d.nextDueDate} <strong>{fmtDate(sub?.currentPeriodEndsAt ?? upcoming?.periodStart ?? null)}</strong>
              </Typography>
            )}

            <Divider sx={{ my: 2 }} />

            <Typography sx={{ fontSize: 12, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em', mb: 1 }}>
              {d.invoiceCalcLabel}
            </Typography>
            <Typography sx={{ color: '#475569', fontSize: 13, lineHeight: 1.6 }}>
              {d.invoiceCalcText}
            </Typography>
          </Paper>
        </Box>
      </Box>
    </Box>
  );
}
