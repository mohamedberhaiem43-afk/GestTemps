import { useEffect, useMemo, useState } from 'react';
import {
  Box, Paper, Typography, Button, Stack, Divider, Alert, CircularProgress, Checkbox, FormControlLabel,
} from '@mui/material';
import { useLocation, useNavigate } from 'react-router-dom';
import ArrowBackIcon from '@mui/icons-material/ArrowBackIosNew';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import LightbulbOutlinedIcon from '@mui/icons-material/LightbulbOutlined';
import apiInstance from '../API/apiInstance';
import { useAuth } from '../helper/AuthProvider';

/**
 * Page « Devis pack » — détail des prochaines échéances avant souscription/changement.
 * URL : /dashboard/devis-pack?plan=Starter|Standard|Premium&cycle=monthly|annual
 *
 * Affiche une timeline avec les 2 prochaines factures (mois courant + suivant) en
 * mettant en évidence l'avantage « 1 mois offert » pour les tenants encore en essai
 * (la première facture est offerte si la date de fin d'essai tombe après l'émission).
 *
 * Le clic sur « Souscrire » redirige vers Stripe Checkout (POST /api/billing/checkout),
 * qui collecte la carte de paiement côté Stripe (PCI-DSS scope minimal). Aucune
 * donnée carte n'est saisie côté Concorde.
 */

type PlanKey = 'Starter' | 'Standard' | 'Premium';
type Cycle = 'monthly' | 'annual';

const PLAN_PRICES: Record<PlanKey, { monthly: number; annual: number; tagline: string }> = {
  Starter:  { monthly: 29.50, annual: 23.60, tagline: 'TPE & startups' },
  Standard: { monthly: 54.00, annual: 43.20, tagline: 'PME en croissance' },
  Premium:  { monthly: 149.00, annual: 119.20, tagline: 'Multi-filiales & sécurité avancée' },
};

const VAT_RATE = 0.20; // TVA 20 % France (à ajuster si tenant ≠ FR ultérieurement).

const fmtEuro = (amount: number) =>
  new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(amount);

const fmtDate = (d: Date) =>
  d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });

const fmtDateLong = (d: Date) =>
  d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });

function endOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0);
}
function startOfNextMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth() + 1, 1);
}

interface SubscriptionInfo {
  planCode: string | null;
  status: string;
  trialEndsAt: string | null;
  hasActiveStripeSubscription: boolean;
}

export default function DevisPackPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { isTrialing } = useAuth();

  // Parsing du plan + cycle depuis la query string. Normalisation de la casse pour
  // matcher PLAN_PRICES (« starter » → « Starter »).
  const queryParams = new URLSearchParams(location.search);
  const rawPlan = (queryParams.get('plan') ?? '').trim();
  const rawCycle = (queryParams.get('cycle') ?? 'monthly').toLowerCase();
  const plan: PlanKey | null = ((): PlanKey | null => {
    const normalized = rawPlan.charAt(0).toUpperCase() + rawPlan.slice(1).toLowerCase();
    return (['Starter', 'Standard', 'Premium'] as PlanKey[]).includes(normalized as PlanKey)
      ? (normalized as PlanKey)
      : null;
  })();
  const cycle: Cycle = rawCycle === 'annual' ? 'annual' : 'monthly';

  const [info, setInfo] = useState<SubscriptionInfo | null>(null);
  const [confirmed, setConfirmed] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await apiInstance.get<SubscriptionInfo>('/billing/subscription');
        if (!cancelled) setInfo(res.data);
      } catch {
        if (!cancelled) setInfo(null);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Calcul des 2 prochaines factures. Si le tenant est encore en essai, on positionne
  // la première facture au lendemain de la fin d'essai (et on applique la remise
  // « 1 mois offert » qui couvre la période d'essai déjà consommée). Sinon, première
  // facture aujourd'hui.
  const invoices = useMemo(() => {
    if (!plan) return [];
    const price = PLAN_PRICES[plan][cycle];
    const firstInvoiceDate = (info?.trialEndsAt && isTrialing)
      ? new Date(info.trialEndsAt)
      : new Date();
    const firstPeriodEnd = endOfMonth(firstInvoiceDate);
    const secondInvoiceDate = startOfNextMonth(firstInvoiceDate);
    const secondPeriodEnd = endOfMonth(secondInvoiceDate);

    return [
      {
        date: firstInvoiceDate,
        periodStart: firstInvoiceDate,
        periodEnd: firstPeriodEnd,
        lines: [
          { label: `Abonnement Pack ${plan}`, amount: price },
          // Promo « 1 mois offert » correspondant à la période d'essai consommée.
          // On l'affiche uniquement si le tenant est en Trialing (sinon plein tarif dès J1).
          ...(isTrialing ? [{ label: 'Offre commerciale — 1 mois offert', amount: -price }] : []),
        ],
      },
      {
        date: secondInvoiceDate,
        periodStart: secondInvoiceDate,
        periodEnd: secondPeriodEnd,
        lines: [
          { label: `Abonnement Pack ${plan}`, amount: price },
        ],
      },
    ];
  }, [plan, cycle, info, isTrialing]);

  const handleSouscrire = async () => {
    if (!plan) return;
    if (!confirmed) {
      setError('Merci de confirmer que vos factures correspondent à la période indiquée.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const origin = window.location.origin;
      const { data } = await apiInstance.post<{ url: string }>('/billing/checkout', {
        planCode: plan,
        billingCycle: cycle,
        userCount: 1,
        successUrl: `${origin}/dashboard/mon-abonnement?subscribed=1&session_id={CHECKOUT_SESSION_ID}`,
        cancelUrl: `${origin}/dashboard/devis-pack?plan=${plan}&cycle=${cycle}&checkout=cancelled`,
      });
      if (data?.url) {
        window.location.href = data.url;
      } else {
        setError("Impossible d'initialiser le paiement Stripe.");
      }
    } catch (e: any) {
      setError(e?.response?.data?.error || 'Échec d\'initialisation du paiement.');
    } finally {
      setSubmitting(false);
    }
  };

  if (!plan) {
    return (
      <Box sx={{ maxWidth: 980, mx: 'auto', p: { xs: 2, md: 4 } }}>
        <Alert severity="warning" sx={{ borderRadius: '14px' }}>
          Pack invalide ou manquant. Retournez à la page « Mon abonnement » pour choisir un pack.
        </Alert>
        <Button onClick={() => navigate('/dashboard/mon-abonnement')} sx={{ mt: 2, textTransform: 'none', fontWeight: 700 }}>
          ← Retour à Mon abonnement
        </Button>
      </Box>
    );
  }

  const monthlyPrice = PLAN_PRICES[plan][cycle];

  return (
    <Box sx={{ maxWidth: 1100, mx: 'auto', p: { xs: 2, md: 4 } }}>
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
        Aperçu du devis pour le Pack <strong>{plan}</strong> ({cycle === 'monthly' ? 'mensuel' : 'annuel'}).
      </Typography>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <Box sx={{ display: { xs: 'block', md: 'grid' }, gridTemplateColumns: '1.6fr 1fr', gap: 3 }}>
        {/* Colonne gauche : timeline des 2 prochaines factures */}
        <Box>
          {invoices.map((inv, idx) => {
            const subtotal = inv.lines.reduce((s, l) => s + l.amount, 0);
            const ttc = subtotal * (1 + VAT_RATE);
            const isFirst = idx === 0;
            return (
              <Box key={idx} sx={{ position: 'relative', pl: 4, mb: 4 }}>
                {/* Trait vertical de la timeline */}
                <Box sx={{
                  position: 'absolute', left: 6, top: 8, bottom: -28, width: 2,
                  bgcolor: isFirst ? '#0040a1' : '#cbd5e1',
                  display: idx === invoices.length - 1 ? 'none' : 'block',
                }} />
                {/* Point de la timeline */}
                <Box sx={{
                  position: 'absolute', left: 0, top: 4, width: 14, height: 14, borderRadius: '50%',
                  bgcolor: isFirst ? '#0040a1' : '#cbd5e1',
                  border: '2px solid #fff', boxShadow: '0 0 0 1px ' + (isFirst ? '#0040a1' : '#cbd5e1'),
                }} />

                <Typography sx={{ fontWeight: 800, color: '#0f172a', fontSize: 16, mb: 2 }}>
                  le {fmtDateLong(inv.date)}
                </Typography>

                {inv.lines.map((line, li) => (
                  <Box key={li} sx={{ mb: li === inv.lines.length - 1 ? 1.5 : 1 }}>
                    <Stack direction="row" alignItems="center" sx={{ mb: li === 0 ? 0.25 : 0 }}>
                      <Typography sx={{ color: '#0f172a', fontSize: 14, flex: 1 }}>
                        {line.label}
                      </Typography>
                      <Box sx={{ flex: 1, mx: 2, borderTop: '1px solid #e2e8f0', height: 1 }} />
                      <Typography sx={{ fontWeight: 700, color: line.amount < 0 ? '#0d8c3e' : '#0f172a', fontSize: 14 }}>
                        {fmtEuro(line.amount)}
                      </Typography>
                    </Stack>
                    {li === 0 && (
                      <Typography sx={{ color: '#64748b', fontSize: 12 }}>
                        du {fmtDate(inv.periodStart)} au {fmtDate(inv.periodEnd)}
                      </Typography>
                    )}
                  </Box>
                ))}

                <Box sx={{ textAlign: 'right', mt: 1 }}>
                  <Typography sx={{ fontWeight: 700, color: '#0f172a', fontSize: 14 }}>
                    Total HT : {fmtEuro(subtotal)}
                  </Typography>
                  <Typography sx={{ color: '#475569', fontSize: 13 }}>
                    Total TTC : {fmtEuro(ttc)}
                  </Typography>
                </Box>
              </Box>
            );
          })}
        </Box>

        {/* Colonne droite : récap pack + bloc explicatif */}
        <Box>
          <Paper elevation={0} sx={{
            p: 2.5, borderRadius: '14px', border: '1px solid #e2e8f0', mb: 2,
          }}>
            <Stack direction="row" spacing={1.5} alignItems="flex-start">
              <CheckCircleOutlineIcon sx={{ color: '#0040a1', mt: 0.25 }} />
              <Box>
                <Typography sx={{ fontWeight: 800, color: '#0f172a', mb: 0.5 }}>
                  Votre pack : {plan}
                </Typography>
                <Typography sx={{ color: '#475569', fontSize: 13 }}>
                  Abonnement à <strong>{fmtEuro(monthlyPrice)} HT / mois</strong>
                </Typography>
                <Typography sx={{ color: '#64748b', fontSize: 12, mt: 0.5 }}>
                  {PLAN_PRICES[plan].tagline}
                </Typography>
              </Box>
            </Stack>
          </Paper>

          <Paper elevation={0} sx={{
            p: 2.5, borderRadius: '14px', bgcolor: '#eff5fb', border: '1px solid #cdd9ee',
          }}>
            <Stack direction="row" spacing={1.5} alignItems="flex-start">
              <LightbulbOutlinedIcon sx={{ color: '#0040a1', mt: 0.25 }} />
              <Box>
                <Typography sx={{ fontWeight: 800, color: '#0f172a', mb: 1 }}>
                  Calcul de votre facture
                </Typography>
                <Typography sx={{ color: '#475569', fontSize: 13, mb: 1, lineHeight: 1.6 }}>
                  Votre abonnement Concorde Workforce couvre la période indiquée sur chaque
                  facture (mensualité au prorata si vous changez de pack en cours de période).
                </Typography>
                {isTrialing && (
                  <Typography sx={{ color: '#475569', fontSize: 13, lineHeight: 1.6 }}>
                    Comme vous êtes encore en période d'essai, votre <strong>premier mois</strong>
                    {' '}est offert (avoir « 1 mois offert ») — la première facture réelle sera
                    {' '}prélevée le <strong>{fmtDateLong(invoices[1]?.date ?? new Date())}</strong>.
                  </Typography>
                )}
              </Box>
            </Stack>
          </Paper>
        </Box>
      </Box>

      {/* Footer fixe : checkbox de confirmation + boutons Annuler / Souscrire */}
      <Paper elevation={0} sx={{
        mt: 3, p: 2, borderRadius: '14px', border: '1px solid #e2e8f0',
        display: 'flex', flexDirection: { xs: 'column', md: 'row' },
        alignItems: { md: 'center' }, justifyContent: 'space-between', gap: 2,
      }}>
        <FormControlLabel
          control={<Checkbox checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} />}
          label={(
            <Typography sx={{ fontSize: 13, color: '#475569' }}>
              Je confirme que mes factures sont relatives à la période du{' '}
              <strong>{fmtDateLong(invoices[0]?.periodStart ?? new Date())}</strong>
              {' '}au <strong>{fmtDateLong(invoices[invoices.length - 1]?.periodEnd ?? new Date())}</strong>.
            </Typography>
          )}
        />
        <Stack direction="row" spacing={1.5}>
          <Button
            variant="outlined"
            onClick={() => navigate('/dashboard/mon-abonnement')}
            sx={{ textTransform: 'none', fontWeight: 700, borderRadius: '10px', px: 3 }}
          >
            Annuler
          </Button>
          <Button
            variant="contained"
            disabled={!confirmed || submitting}
            onClick={handleSouscrire}
            sx={{
              textTransform: 'none', fontWeight: 700, borderRadius: '10px', px: 3,
              bgcolor: '#0040a1', '&:hover': { bgcolor: '#003080' },
            }}
          >
            {submitting ? <CircularProgress size={18} sx={{ color: '#fff' }} /> : 'Souscrire'}
          </Button>
        </Stack>
      </Paper>

      <Divider sx={{ my: 4 }} />
      <Typography sx={{ color: '#94a3b8', fontSize: 12, textAlign: 'center' }}>
        Le paiement est traité par Stripe (PCI-DSS niveau 1). Vos données bancaires ne
        transitent jamais par Concorde Workforce.
      </Typography>
    </Box>
  );
}
