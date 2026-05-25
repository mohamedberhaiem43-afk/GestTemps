import { useEffect, useState } from 'react';
import {
  Box, Paper, Typography, Button, Chip, Dialog, DialogTitle, DialogContent, DialogActions,
  RadioGroup, FormControlLabel, Radio, TextField, Alert, CircularProgress, Stack, Divider,
  LinearProgress,
} from '@mui/material';
import RocketLaunchIcon from '@mui/icons-material/RocketLaunch';
import CancelIcon from '@mui/icons-material/CancelOutlined';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import CreditCardIcon from '@mui/icons-material/CreditCard';
import { useNavigate } from 'react-router-dom';
import apiInstance from '../API/apiInstance';
import { useAuth } from '../helper/AuthProvider';
import ChangePlanModal from './ChangePlanModal';
import DevisPackDialog from './DevisPackDialog';
import StorageUsageCard from './StorageUsageCard';

type PlanKey = 'Starter' | 'Standard' | 'Premium';
type Cycle = 'monthly' | 'annual';

interface SubscriptionInfo {
  slug: string;
  companyName: string;
  status: string;
  planCode: string | null;
  trialEndsAt: string | null;
  currentPeriodEndsAt: string | null;
  cancelAtPeriodEnd: boolean;
  cancellationRequestedAt: string | null;
  hasActiveStripeSubscription: boolean;
}

interface PaymentMethodInfo {
  hasCard: boolean;
  brand?: string;       // "visa", "mastercard", "amex", "cb"…
  last4?: string;
  expMonth?: number;
  expYear?: number;
}

const brandLabel = (brand?: string) => {
  switch ((brand ?? '').toLowerCase()) {
    case 'visa': return 'Visa';
    case 'mastercard': return 'Mastercard';
    case 'amex': return 'American Express';
    case 'cb': return 'CB';
    case 'discover': return 'Discover';
    default: return brand ?? 'Carte';
  }
};

const formatDate = (d: string | null) => {
  if (!d) return '—';
  try { return new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' }); }
  catch { return d; }
};

const statusLabel = (s: string): { label: string; color: 'success' | 'warning' | 'error' | 'info' | 'default' } => {
  switch (s) {
    case 'Active': return { label: 'Actif', color: 'success' };
    case 'Trialing': return { label: 'Essai gratuit', color: 'info' };
    case 'PastDue': return { label: 'Paiement en retard', color: 'warning' };
    case 'PendingPayment': return { label: 'Paiement requis', color: 'warning' };
    case 'Suspended': return { label: 'Suspendu', color: 'error' };
    case 'Cancelled': return { label: 'Résilié', color: 'error' };
    default: return { label: s, color: 'default' };
  }
};

// Durée canonique de l'essai gratuit côté backend (TrialPolicy.TrialDurationDays).
// Sert à calculer le pourcentage de progression du bandeau trial.
const TRIAL_DURATION_DAYS = 30;

export default function MonAbonnementPage() {
  const navigate = useNavigate();
  const { isAdmin, isManager, refreshAuth, userName, isTrialing, trialDaysRemaining } = useAuth();
  const canManage = isAdmin || isManager;
  // Prénom uniquement pour personnaliser le bandeau trial (« Mohamed, il vous reste… »).
  // userName est « Prénom Nom » concaténé côté serveur (Utiprn + Utinom).
  const firstName = (userName ?? '').trim().split(/\s+/)[0] || null;

  const [info, setInfo] = useState<SubscriptionInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelMode, setCancelMode] = useState<'period_end' | 'immediate'>('period_end');
  const [cancelReason, setCancelReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [changePlanOpen, setChangePlanOpen] = useState(false);
  // Devis affiché en modale par-dessus la liste des packs (Dougs-style).
  // null = fermée ; non-null = ouverte sur le pack/cycle sélectionné.
  const [devisDialog, setDevisDialog] = useState<{ plan: PlanKey; cycle: Cycle } | null>(null);
  // Polling de confirmation post-Stripe : tant que `pollingReactivation` est vrai,
  // on affiche un overlay « Confirmation du paiement en cours » et on interroge
  // /billing/subscription jusqu'à ce que le webhook checkout.session.completed
  // ait flippé Status → Active (ou jusqu'au timeout).
  const [pollingReactivation, setPollingReactivation] = useState(false);
  const [pollingTimedOut, setPollingTimedOut] = useState(false);

  // Carte de paiement par défaut du customer Stripe — affichée masquée.
  // Lecture séparée de /billing/subscription pour ne pas alourdir cet endpoint
  // qui est aussi appelé par le widget de quota stockage côté topbar.
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethodInfo | null>(null);
  const [openingPortal, setOpeningPortal] = useState(false);

  const fetchInfo = async (opts: { silent?: boolean } = {}): Promise<SubscriptionInfo | null> => {
    if (!opts.silent) setLoading(true);
    setError(null);
    try {
      const res = await apiInstance.get<SubscriptionInfo>('/billing/subscription');
      setInfo(res.data);
      return res.data;
    } catch (e: any) {
      setError(e?.response?.data?.error || 'Impossible de charger les informations d\'abonnement.');
      return null;
    } finally {
      if (!opts.silent) setLoading(false);
    }
  };

  useEffect(() => { fetchInfo(); }, []);

  // Récupère la carte de paiement par défaut (brand + last4 + expiry). En cas d'échec
  // ou d'absence (tenant sans customer Stripe), on stocke { hasCard: false } et on
  // affiche un placeholder « Aucune carte enregistrée » dans la section dédiée.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await apiInstance.get<PaymentMethodInfo>('/billing/payment-method');
        if (!cancelled) setPaymentMethod(res.data);
      } catch {
        if (!cancelled) setPaymentMethod({ hasCard: false });
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Ouvre le Stripe Billing Portal pour permettre à l'admin de mettre à jour sa carte,
  // changer la méthode de paiement, télécharger ses factures côté Stripe. On délègue
  // 100% à Stripe pour rester PCI-DSS SAQ A (jamais de PAN côté Concorde).
  const handleOpenPortal = async () => {
    setOpeningPortal(true);
    setError(null);
    try {
      const origin = window.location.origin;
      const { data } = await apiInstance.post<{ url: string }>('/billing/portal-session', {
        returnUrl: `${origin}/dashboard/mon-abonnement`,
      });
      if (data?.url) {
        window.location.href = data.url;
      } else {
        setError("Impossible d'ouvrir le portail de facturation Stripe.");
      }
    } catch (e: any) {
      setError(e?.response?.data?.error || "Échec d'ouverture du portail de facturation.");
    } finally {
      setOpeningPortal(false);
    }
  };

  // Retour de Stripe après abandon du checkout (bouton « Annuler » Stripe).
  // Le cancelUrl de DevisPackDialog/handleReactivate ramène vers cette page avec
  // un query param marqueur. Avant : la page se rechargeait silencieusement et
  // l'utilisateur ne comprenait pas si son abandon avait été pris en compte —
  // certains relançaient un checkout 2s plus tard (cf. logs serveur 12:38:42).
  // On affiche maintenant une bannière explicite « Paiement annulé » et on
  // nettoie l'URL pour éviter toute relance involontaire au re-render.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const cancelled = params.get('checkout') === 'cancelled' || params.get('reactivate') === 'cancelled';
    if (!cancelled) return;
    setError('Paiement annulé. Aucun prélèvement n\'a été effectué. Vous pouvez relancer la souscription à tout moment.');
    // Nettoyage du query param pour éviter qu'un refresh ne réaffiche le message
    // et pour neutraliser toute logique conditionnée à ?checkout=cancelled.
    const url = new URL(window.location.href);
    url.searchParams.delete('checkout');
    url.searchParams.delete('reactivate');
    window.history.replaceState({}, '', url.toString());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Retour de Stripe après réactivation : on est redirigé ici avec `?reactivated=1&session_id=…`.
  // Stratégie en 2 temps pour ne plus dépendre uniquement du webhook asynchrone :
  //   1) Réconciliation active immédiate via POST /billing/confirm-checkout — on demande à
  //      Stripe (depuis le backend) si la session est payée et on bascule Status="Active"
  //      sur place. Couvre 95% des cas en <1s (le webhook peut tomber 30s+ plus tard).
  //   2) Si la réconciliation dit "payment_status != paid" (3DS en cours, SEPA…), on
  //      retombe sur l'ancien polling /billing/subscription jusqu'au flip Active.
  // Avant : on attendait passivement le webhook pendant 30s, ce qui affichait
  // « Confirmation retardée » à chaque latence Stripe → mauvaise UX et tickets support.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('reactivated') !== '1') return;
    const sessionId = params.get('session_id');
    let cancelled = false;
    setPollingReactivation(true);
    setPollingTimedOut(false);

    const finishSuccess = async () => {
      if (cancelled) return;
      setPollingReactivation(false);
      setSuccessMsg('Réactivation confirmée. Redirection vers votre tableau de bord…');
      try { await refreshAuth(); } catch { /* best-effort */ }
      setTimeout(() => navigate('/dashboard', { replace: true }), 1200);
    };

    const startPolling = () => {
      const start = Date.now();
      const MAX_MS = 30_000;
      const tick = async () => {
        if (cancelled) return;
        const data = await fetchInfo({ silent: true });
        if (cancelled) return;
        if (data?.status === 'Active') {
          await finishSuccess();
          return;
        }
        if (Date.now() - start > MAX_MS) {
          setPollingReactivation(false);
          setPollingTimedOut(true);
          return;
        }
        setTimeout(tick, 2500);
      };
      tick();
    };

    (async () => {
      // Étape 1 — réconciliation active si on a un session_id.
      if (sessionId) {
        try {
          const { data } = await apiInstance.post<{ status?: string; reconciled?: boolean; alreadyActive?: boolean }>(
            '/billing/confirm-checkout',
            { sessionId },
          );
          if (cancelled) return;
          if (data?.status === 'Active') {
            // Rafraîchit l'objet info affiché (chip, dates) avant le redirect.
            await fetchInfo({ silent: true });
            await finishSuccess();
            return;
          }
        } catch {
          // Réconciliation échouée → on tente le polling (le webhook peut tomber juste après).
        }
      }
      // Étape 2 — fallback polling.
      if (!cancelled) startPolling();
    })();

    return () => { cancelled = true; };
    // Volontairement vide : on ne déclenche la séquence qu'au premier mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCancel = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const res = await apiInstance.post('/billing/cancel-subscription', {
        immediate: cancelMode === 'immediate',
        reason: cancelReason.trim() || null,
      });
      const immediate = res.data?.immediate;
      const effectiveAt = res.data?.effectiveAt;
      const prorated = !!res.data?.prorated;
      const refundedAmount: number | null = typeof res.data?.refundedAmount === 'number' ? res.data.refundedAmount : null;
      const refundCurrency: string | null = typeof res.data?.refundCurrency === 'string' ? res.data.refundCurrency : null;
      setCancelOpen(false);
      setCancelReason('');
      const refundLine = prorated && refundedAmount != null && refundCurrency
        ? ` Un remboursement prorata temporis de ${refundedAmount.toFixed(2)} ${refundCurrency.toUpperCase()} a été émis vers votre carte (délai bancaire 5–10 jours).`
        : '';
      setSuccessMsg(
        immediate
          ? `Votre abonnement a été résilié immédiatement.${refundLine} Vous allez être déconnecté.`
          : `Votre résiliation a bien été enregistrée. Vous gardez l'accès jusqu'au ${formatDate(effectiveAt)}.`
      );
      await fetchInfo();
      if (immediate) {
        // Résiliation immédiate → l'accès tombe à 402 dès la prochaine requête. On laisse
        // 3s pour que l'utilisateur lise le message puis on force la déconnexion.
        setTimeout(() => { window.location.href = '/login'; }, 3000);
      }
    } catch (e: any) {
      setError(e?.response?.data?.error || 'Échec de la résiliation. Réessayez plus tard.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleResume = async () => {
    setSubmitting(true);
    setError(null);
    try {
      await apiInstance.post('/billing/resume-subscription');
      setSuccessMsg('Résiliation annulée. Votre abonnement continuera normalement.');
      await fetchInfo();
    } catch (e: any) {
      setError(e?.response?.data?.error || 'Impossible d\'annuler la résiliation.');
    } finally {
      setSubmitting(false);
    }
  };

  // Réactivation : tenant Cancelled dans la fenêtre de rétention (90j). On lance un
  // nouveau Stripe Checkout — le webhook checkout.session.completed flippe Cancelled→Active
  // et préserve toutes les données du tenant (employés, contrats, pointages…).
  const handleReactivate = async () => {
    if (!info?.planCode) {
      setError("Aucune formule précédente enregistrée. Contactez le support.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const origin = window.location.origin;
      const { data } = await apiInstance.post('/billing/checkout', {
        planCode: info.planCode,
        billingCycle: 'monthly',
        userCount: 1,
        // SuccessUrl doit retomber sur /mon-abonnement (PAS /dashboard) : le tenant
        // est encore Cancelled au moment du redirect, donc /dashboard renverrait 402
        // sur l'appel /Utilisateurs/me. /mon-abonnement reste accessible (route SPA
        // + l'API /billing/* est dans le bypass du tenant middleware) et poll le
        // webhook jusqu'au flip Active.
        successUrl: `${origin}/dashboard/mon-abonnement?reactivated=1&session_id={CHECKOUT_SESSION_ID}`,
        cancelUrl: `${origin}/dashboard/mon-abonnement?reactivate=cancelled`,
      });
      if (data?.url) {
        window.location.href = data.url;
      } else {
        setError("Impossible d'initialiser le paiement Stripe.");
      }
    } catch (e: any) {
      setError(e?.response?.data?.error || "Échec de la réactivation. Réessayez plus tard.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 400 }}>
        <CircularProgress />
      </Box>
    );
  }

  const st = info ? statusLabel(info.status) : null;
  const isCancelled = info?.status === 'Cancelled';
  const scheduledCancel = info?.cancelAtPeriodEnd === true;

  return (
    <Box sx={{ maxWidth: 980, mx: 'auto', p: { xs: 2, md: 4 } }}>
      <Typography variant="h4" sx={{ fontWeight: 800, color: '#0f172a', mb: 0.5 }}>
        Mon abonnement
      </Typography>
      <Typography sx={{ color: '#64748b', mb: 4 }}>
        Gérez votre formule, suivez vos prochaines échéances et résiliez à tout moment.
      </Typography>

      {error && <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>{error}</Alert>}
      {successMsg && <Alert severity="success" sx={{ mb: 3 }} onClose={() => setSuccessMsg(null)}>{successMsg}</Alert>}
      {pollingReactivation && (
        <Alert severity="info" sx={{ mb: 3, alignItems: 'center' }}
          icon={<CircularProgress size={20} />}>
          <Typography sx={{ fontWeight: 700, mb: 0.5 }}>Confirmation du paiement en cours…</Typography>
          <Typography sx={{ fontSize: 13 }}>
            Nous attendons la confirmation Stripe (généralement 2-5 secondes). Ne fermez pas cette page.
          </Typography>
        </Alert>
      )}
      {pollingTimedOut && (
        <Alert severity="warning" sx={{ mb: 3 }} onClose={() => setPollingTimedOut(false)}>
          <Typography sx={{ fontWeight: 700, mb: 0.5 }}>Confirmation retardée</Typography>
          <Typography sx={{ fontSize: 13 }}>
            Le paiement a bien été enregistré côté Stripe, mais le webhook de confirmation
            tarde à arriver. Rafraîchissez la page dans une minute, ou contactez le support
            si l'état reste « Résilié ».
          </Typography>
        </Alert>
      )}

      {/* Bandeau d'essai friendly — affiché EN PLUS de la carte « Formule actuelle » ci-dessous
          (les deux contiennent des infos complémentaires : ici la progression et un CTA
          vers les tarifs ; en dessous les dates exactes de fin de période/d'essai et le
          chip Status). N'apparaît que pour les tenants Trialing. */}
      {isTrialing && (() => {
        const daysLeft = Math.max(0, trialDaysRemaining ?? 0);
        const daysUsed = Math.max(0, Math.min(TRIAL_DURATION_DAYS, TRIAL_DURATION_DAYS - daysLeft));
        const progressPct = (daysUsed / TRIAL_DURATION_DAYS) * 100;
        return (
          <Paper elevation={0} sx={{
            p: { xs: 3, md: 4 }, mb: 3, borderRadius: '20px',
            border: '1px solid #cdd9ee', bgcolor: '#f1f5fb',
          }}>
            <LinearProgress
              variant="determinate"
              value={progressPct}
              sx={{
                height: 10, borderRadius: 99, mb: 2,
                bgcolor: '#dbe4f3',
                '& .MuiLinearProgress-bar': { bgcolor: '#0040a1', borderRadius: 99 },
              }}
            />
            <Typography sx={{ fontWeight: 800, color: '#0f172a', fontSize: 16, mb: 0.5 }}>
              {firstName ? `${firstName}, ` : ''}il vous reste <strong>{daysLeft}</strong> jour{daysLeft > 1 ? 's' : ''} sur votre période d'essai.
            </Typography>
            <Typography sx={{ color: '#475569', fontSize: 14, mb: 2 }}>
              Si vous aimez Concorde Workforce, vous pouvez activer votre abonnement dès
              maintenant et continuer à bénéficier de vos {TRIAL_DURATION_DAYS} jours offerts.
            </Typography>
            {canManage && (
              <Button
                variant="contained"
                onClick={() => setChangePlanOpen(true)}
                sx={{
                  textTransform: 'none', fontWeight: 700, borderRadius: '12px', px: 3,
                  bgcolor: '#0040a1', '&:hover': { bgcolor: '#003080' },
                }}
              >
                Voir les tarifs →
              </Button>
            )}
          </Paper>
        );
      })()}

      <Paper elevation={0} sx={{ p: { xs: 3, md: 4 }, borderRadius: '20px', border: '1px solid #e2e8f0', mb: 3 }}>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={3} alignItems={{ md: 'center' }} justifyContent="space-between">
          <Box>
            <Typography sx={{ fontSize: 12, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', mb: 0.5 }}>
              Formule actuelle
            </Typography>
            <Typography variant="h5" sx={{ fontWeight: 800, color: '#0040a1' }}>
              {info?.planCode || 'Aucune formule'}
            </Typography>
            <Typography sx={{ color: '#475569', fontSize: 14, mt: 0.5 }}>
              {info?.companyName}
            </Typography>
          </Box>
          {st && (
            <Chip
              label={st.label}
              color={st.color === 'default' ? undefined : st.color}
              sx={{ fontWeight: 700, alignSelf: { xs: 'flex-start', md: 'center' } }}
            />
          )}
        </Stack>

        <Divider sx={{ my: 3 }} />

        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={3}>
          <Box sx={{ flex: 1 }}>
            <Typography sx={{ fontSize: 12, color: '#64748b', textTransform: 'uppercase', fontWeight: 700, mb: 0.5 }}>
              Fin de la période en cours
            </Typography>
            <Typography sx={{ fontWeight: 700, color: '#0f172a' }}>
              {formatDate(info?.currentPeriodEndsAt ?? null)}
            </Typography>
          </Box>
          {info?.status === 'Trialing' && (
            <Box sx={{ flex: 1 }}>
              <Typography sx={{ fontSize: 12, color: '#64748b', textTransform: 'uppercase', fontWeight: 700, mb: 0.5 }}>
                Fin de l'essai gratuit
              </Typography>
              <Typography sx={{ fontWeight: 700, color: '#0f172a' }}>
                {formatDate(info?.trialEndsAt ?? null)}
              </Typography>
            </Box>
          )}
          {scheduledCancel && (
            <Box sx={{ flex: 1 }}>
              <Typography sx={{ fontSize: 12, color: '#64748b', textTransform: 'uppercase', fontWeight: 700, mb: 0.5 }}>
                Résiliation demandée le
              </Typography>
              <Typography sx={{ fontWeight: 700, color: '#dc2626' }}>
                {formatDate(info?.cancellationRequestedAt ?? null)}
              </Typography>
            </Box>
          )}
        </Stack>
      </Paper>

      <StorageUsageCard onUpgradeClick={() => setChangePlanOpen(true)} />

      {/* Section Carte de paiement — affichage masqué (PCI-DSS) + mise à jour via Stripe Portal. */}
      <Paper elevation={0} sx={{ p: { xs: 3, md: 4 }, borderRadius: '20px', border: '1px solid #e2e8f0', mb: 3 }}>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={3} alignItems={{ md: 'center' }} justifyContent="space-between">
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Box sx={{
              width: 48, height: 48, borderRadius: '12px', bgcolor: '#eef2f8',
              color: '#0040a1', display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <CreditCardIcon />
            </Box>
            <Box>
              <Typography sx={{ fontSize: 12, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', mb: 0.5 }}>
                Carte de paiement
              </Typography>
              {paymentMethod?.hasCard ? (
                <>
                  <Typography sx={{ fontWeight: 800, color: '#0f172a' }}>
                    {brandLabel(paymentMethod.brand)} •••• {paymentMethod.last4}
                  </Typography>
                  {paymentMethod.expMonth && paymentMethod.expYear && (
                    <Typography sx={{ color: '#64748b', fontSize: 13 }}>
                      Expire {String(paymentMethod.expMonth).padStart(2, '0')}/{paymentMethod.expYear}
                    </Typography>
                  )}
                </>
              ) : paymentMethod === null ? (
                <Typography sx={{ color: '#64748b', fontSize: 14 }}>Chargement…</Typography>
              ) : (
                <Typography sx={{ color: '#64748b', fontSize: 14 }}>
                  Aucune carte enregistrée
                </Typography>
              )}
            </Box>
          </Box>
          {canManage && (
            <Button
              variant="outlined"
              onClick={handleOpenPortal}
              disabled={openingPortal}
              sx={{ textTransform: 'none', fontWeight: 700, borderRadius: '12px', px: 3, alignSelf: { xs: 'flex-start', md: 'center' } }}
            >
              {openingPortal ? 'Redirection…' : 'Mettre à jour'}
            </Button>
          )}
        </Stack>
      </Paper>

      {scheduledCancel && !isCancelled && (
        <Alert severity="warning" sx={{ mb: 3, borderRadius: '14px' }}>
          <Typography sx={{ fontWeight: 700, mb: 0.5 }}>Résiliation programmée</Typography>
          <Typography sx={{ fontSize: 14 }}>
            Votre abonnement sera arrêté le <strong>{formatDate(info?.currentPeriodEndsAt ?? null)}</strong>.
            Vous conservez l'accès complet jusqu'à cette date.
          </Typography>
        </Alert>
      )}

      {isCancelled && (
        <Alert severity="info" sx={{ mb: 3, borderRadius: '14px' }}>
          <Typography sx={{ fontWeight: 700, mb: 0.5 }}>Abonnement résilié</Typography>
          <Typography sx={{ fontSize: 14 }}>
            Vos données sont conservées pendant <strong>90 jours</strong> à compter de la
            résiliation. Vous pouvez réactiver votre abonnement à tout moment dans ce délai —
            au-delà, un nouveau compte sera nécessaire (RGPD : conformité au droit à l'oubli).
          </Typography>
        </Alert>
      )}

      <Paper elevation={0} sx={{ p: { xs: 3, md: 4 }, borderRadius: '20px', border: '1px solid #e2e8f0' }}>
        <Typography variant="h6" sx={{ fontWeight: 800, color: '#0f172a', mb: 2 }}>
          Actions
        </Typography>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} flexWrap="wrap">
          {!isCancelled && (
            <Button
              variant="contained"
              startIcon={<RocketLaunchIcon />}
              onClick={() => setChangePlanOpen(true)}
              sx={{ textTransform: 'none', fontWeight: 700, borderRadius: '12px', px: 3 }}
            >
              Voir les autres packs
            </Button>
          )}
          {isCancelled && canManage && (
            <Button
              variant="contained"
              color="success"
              startIcon={<RestartAltIcon />}
              disabled={submitting}
              onClick={handleReactivate}
              sx={{ textTransform: 'none', fontWeight: 700, borderRadius: '12px', px: 3 }}
            >
              Réactiver mon abonnement
            </Button>
          )}
          {scheduledCancel && !isCancelled && canManage && (
            <Button
              variant="outlined"
              color="success"
              startIcon={<RestartAltIcon />}
              disabled={submitting}
              onClick={handleResume}
              sx={{ textTransform: 'none', fontWeight: 700, borderRadius: '12px', px: 3 }}
            >
              Annuler la résiliation
            </Button>
          )}
          {!isCancelled && !scheduledCancel && canManage && (
            <Button
              variant="outlined"
              color="error"
              startIcon={<CancelIcon />}
              onClick={() => setCancelOpen(true)}
              sx={{ textTransform: 'none', fontWeight: 700, borderRadius: '12px', px: 3 }}
            >
              Résilier mon abonnement
            </Button>
          )}
        </Stack>
        {!canManage && (
          <Typography sx={{ mt: 2, fontSize: 13, color: '#64748b' }}>
            Seuls les administrateurs et managers peuvent modifier {isCancelled ? 'ou réactiver' : 'ou résilier'} l'abonnement.
          </Typography>
        )}
      </Paper>

      <Dialog open={cancelOpen} onClose={() => !submitting && setCancelOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 800 }}>Résilier mon abonnement</DialogTitle>
        <DialogContent>
          <Typography sx={{ mb: 2, color: '#475569', fontSize: 14 }}>
            Choisissez le mode de résiliation. Vous pourrez annuler tant que la fin de période n'est pas atteinte.
          </Typography>
          <RadioGroup
            value={cancelMode}
            onChange={(e) => setCancelMode(e.target.value as 'period_end' | 'immediate')}
          >
            <Paper
              elevation={0}
              sx={{
                p: 2, mb: 1.5, borderRadius: '12px',
                border: cancelMode === 'period_end' ? '2px solid #0040a1' : '1px solid #e2e8f0',
                background: cancelMode === 'period_end' ? '#f0f6ff' : '#fff',
              }}
            >
              <FormControlLabel
                value="period_end"
                control={<Radio />}
                label={
                  <Box>
                    <Typography sx={{ fontWeight: 700 }}>À la fin de la période en cours</Typography>
                    <Typography sx={{ fontSize: 13, color: '#64748b' }}>
                      Vous gardez l'accès jusqu'au {formatDate(info?.currentPeriodEndsAt ?? null)}.
                      Aucun nouveau prélèvement ne sera effectué. <strong>Recommandé.</strong>
                    </Typography>
                  </Box>
                }
              />
            </Paper>
            <Paper
              elevation={0}
              sx={{
                p: 2, borderRadius: '12px',
                border: cancelMode === 'immediate' ? '2px solid #dc2626' : '1px solid #e2e8f0',
                background: cancelMode === 'immediate' ? '#fef2f2' : '#fff',
              }}
            >
              <FormControlLabel
                value="immediate"
                control={<Radio />}
                label={
                  <Box>
                    <Typography sx={{ fontWeight: 700 }}>Résiliation immédiate</Typography>
                    <Typography sx={{ fontSize: 13, color: '#64748b' }}>
                      L'accès est coupé tout de suite et vous serez déconnecté.
                      Aucun remboursement de la période en cours n'est effectué.
                    </Typography>
                  </Box>
                }
              />
            </Paper>
          </RadioGroup>
          <TextField
            label="Motif (optionnel)"
            value={cancelReason}
            onChange={(e) => setCancelReason(e.target.value)}
            multiline
            minRows={2}
            fullWidth
            sx={{ mt: 3 }}
            placeholder="Aide-nous à nous améliorer en partageant la raison de votre départ."
          />
        </DialogContent>
        <DialogActions sx={{ p: 3, pt: 0 }}>
          <Button onClick={() => setCancelOpen(false)} disabled={submitting}>Annuler</Button>
          <Button
            variant="contained"
            color="error"
            onClick={handleCancel}
            disabled={submitting}
            startIcon={submitting ? <CircularProgress size={16} color="inherit" /> : undefined}
            sx={{ textTransform: 'none', fontWeight: 700 }}
          >
            {cancelMode === 'immediate' ? 'Résilier maintenant' : 'Programmer la résiliation'}
          </Button>
        </DialogActions>
      </Dialog>

      <ChangePlanModal
        open={changePlanOpen}
        onClose={() => setChangePlanOpen(false)}
        currentPlan={info?.planCode ?? null}
        // Branche "changement en un clic" (preview prorata + bouton confirmation) :
        // uniquement disponible quand il existe déjà une subscription Stripe à muter.
        // Pour les essais sans carte, la modale agit en pure vitrine et seul le CTA
        // « Voir le devis → » mène à un parcours payant via Stripe Checkout.
        canChangeInPlace={
          info?.hasActiveStripeSubscription === true &&
          (info?.status === 'Active' || info?.status === 'Trialing')
        }
        onViewDevis={(plan, cycle) => setDevisDialog({ plan, cycle })}
        onSuccess={(newPlan) => {
          setChangePlanOpen(false);
          setSuccessMsg(`Votre formule a été changée pour ${newPlan}. Le différentiel est ajusté sur votre prochaine facture.`);
          fetchInfo();
        }}
      />

      <DevisPackDialog
        open={devisDialog !== null}
        onClose={() => setDevisDialog(null)}
        plan={devisDialog?.plan ?? null}
        cycle={devisDialog?.cycle ?? 'monthly'}
      />
    </Box>
  );
}
