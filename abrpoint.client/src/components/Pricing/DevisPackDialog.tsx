import { useEffect, useMemo, useState } from 'react';
import {
  Dialog, DialogContent, Box, Paper, Typography, Button, Stack, Alert,
  CircularProgress, Checkbox, FormControlLabel, IconButton,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBackIosNew';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import LightbulbOutlinedIcon from '@mui/icons-material/LightbulbOutlined';
import CloseIcon from '@mui/icons-material/Close';
import apiInstance from '../API/apiInstance';
import { useAuth } from '../helper/AuthProvider';

/**
 * Dialogue « Vos prochaines factures » — devis détaillé pour un pack donné,
 * affiché en modale par-dessus la page abonnement (cf. parcours Dougs).
 *
 * Reprend exactement la logique de DevisPackPage mais en version dialogue : la
 * navigation « Retour » et le bouton « Annuler » ferment la modale au lieu de
 * naviguer. Le bouton « Souscrire » redirige toujours vers Stripe Checkout.
 */

type PlanKey = 'Starter' | 'Standard' | 'Premium';
type Cycle = 'monthly' | 'annual';

// Grille tarifs.txt 2026-05 — alignée avec ABRPOINT.Server.Tenancy.PlanCatalog.
// Le ratio annuel/mensuel n'est PAS uniforme entre les packs : on stocke les deux
// prix explicitement. Code interne « Premium » conservé pour la compat Stripe,
// libellé commercial = « Business » côté UI.
const PLAN_PRICES: Record<PlanKey, { monthly: number; annual: number; tagline: string }> = {
  Starter:  { monthly: 99,  annual: 69,  tagline: 'TPE & startups' },
  Standard: { monthly: 219, annual: 119, tagline: 'PME en croissance' },
  Premium:  { monthly: 449, annual: 249, tagline: 'Multi-filiales & sécurité avancée' },
};

const VAT_RATE = 0.20;

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

interface DevisPackDialogProps {
  open: boolean;
  onClose: () => void;
  plan: PlanKey | null;
  cycle?: Cycle;
}

export default function DevisPackDialog({ open, onClose, plan, cycle = 'monthly' }: DevisPackDialogProps) {
  const { isTrialing } = useAuth();

  const [info, setInfo] = useState<SubscriptionInfo | null>(null);
  const [confirmed, setConfirmed] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset state à chaque ouverture pour éviter les résidus du flow précédent
  // (ex : un échec Souscrire affiche encore son erreur lors d'un nouvel open).
  useEffect(() => {
    if (open) {
      setConfirmed(true);
      setError(null);
      setSubmitting(false);
    }
  }, [open]);

  // Fetch info abonnement une fois à chaque ouverture pour récupérer trialEndsAt.
  // (silencieux : si l'API échoue, on assume "pas d'essai" et on affiche un devis
  // standard sans la remise « 1 mois offert ».)
  useEffect(() => {
    if (!open) return;
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
  }, [open]);

  // 2 prochaines factures à plein tarif. L'essai gratuit n'apparaît PAS dans le
  // devis : il est tout simplement non facturé (pas de "1 mois offert" en ligne
  // d'avoir). Pour un tenant encore en essai, la première facture tombe à la fin
  // d'essai (= date à partir de laquelle Stripe commence à facturer) ; pour un
  // tenant déjà payant, la première facture tombe immédiatement.
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
        cancelUrl: `${origin}/dashboard/mon-abonnement?checkout=cancelled`,
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

  const monthlyPrice = plan ? PLAN_PRICES[plan][cycle] : 0;
  const tagline = plan ? PLAN_PRICES[plan].tagline : '';

  return (
    <Dialog
      open={open}
      onClose={() => !submitting && onClose()}
      maxWidth="lg"
      fullWidth
      PaperProps={{ sx: { borderRadius: '20px' } }}
    >
      <DialogContent sx={{ p: { xs: 2.5, md: 4 } }}>
        {/* Header : ← Retour à gauche, croix de fermeture à droite */}
        <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
          <Button
            startIcon={<ArrowBackIcon sx={{ fontSize: 14 }} />}
            onClick={onClose}
            disabled={submitting}
            sx={{ textTransform: 'none', color: '#0040a1', fontWeight: 600, px: 0 }}
          >
            Retour
          </Button>
          <IconButton size="small" onClick={onClose} disabled={submitting} aria-label="Fermer">
            <CloseIcon />
          </IconButton>
        </Stack>

        <Typography variant="h4" sx={{ fontWeight: 800, color: '#0f172a', mb: 0.5 }}>
          Vos prochaines factures
        </Typography>
        {plan && (
          <Typography sx={{ color: '#64748b', mb: 3 }}>
            Aperçu du devis pour le Pack <strong>{plan}</strong>{' '}
            ({cycle === 'monthly' ? 'mensuel' : 'annuel'}).
          </Typography>
        )}

        {!plan && (
          <Alert severity="warning" sx={{ borderRadius: '14px', mb: 2 }}>
            Pack invalide ou manquant.
          </Alert>
        )}

        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

        {plan && (
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
                p: 2.5, borderRadius: '14px', border: '1px solid #e2e8f0', mb: 2, bgcolor: '#f8fafc',
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
                      {tagline}
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
                        Votre <strong>période d'essai gratuite</strong> n'est pas facturée et
                        n'apparaît donc pas dans ce devis. La toute première facture sera
                        {' '}prélevée le <strong>{fmtDateLong(invoices[0]?.date ?? new Date())}</strong>,
                        {' '}date de fin de votre essai.
                      </Typography>
                    )}
                  </Box>
                </Stack>
              </Paper>
            </Box>
          </Box>
        )}

        {/* Footer : confirmation + boutons */}
        {plan && (
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
                onClick={onClose}
                disabled={submitting}
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
        )}

        <Typography sx={{ color: '#94a3b8', fontSize: 12, textAlign: 'center', mt: 3 }}>
          Le paiement est traité par Stripe (PCI-DSS niveau 1). Vos données bancaires ne
          transitent jamais par Concorde Workforce.
        </Typography>
      </DialogContent>
    </Dialog>
  );
}
