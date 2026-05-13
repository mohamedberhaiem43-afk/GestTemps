import { useEffect, useState } from 'react';
import {
  Box, Paper, Typography, Button, Chip, Dialog, DialogTitle, DialogContent, DialogActions,
  RadioGroup, FormControlLabel, Radio, TextField, Alert, CircularProgress, Stack, Divider,
} from '@mui/material';
import RocketLaunchIcon from '@mui/icons-material/RocketLaunch';
import CancelIcon from '@mui/icons-material/CancelOutlined';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import { useNavigate } from 'react-router-dom';
import apiInstance from '../API/apiInstance';
import { useAuth } from '../helper/AuthProvider';

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

export default function MonAbonnementPage() {
  const navigate = useNavigate();
  const { isAdmin, isManager } = useAuth();
  const canManage = isAdmin || isManager;

  const [info, setInfo] = useState<SubscriptionInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelMode, setCancelMode] = useState<'period_end' | 'immediate'>('period_end');
  const [cancelReason, setCancelReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const fetchInfo = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiInstance.get<SubscriptionInfo>('/billing/subscription');
      setInfo(res.data);
    } catch (e: any) {
      setError(e?.response?.data?.error || 'Impossible de charger les informations d\'abonnement.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchInfo(); }, []);

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
      setError("Aucune formule précédente trouvée. Contactez le support.");
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
        successUrl: `${origin}/dashboard?reactivated=1&session_id={CHECKOUT_SESSION_ID}`,
        cancelUrl: `${origin}/dashboard/abonnement?reactivate=cancelled`,
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
              onClick={() => navigate('/dashboard/plan-configuration')}
              sx={{ textTransform: 'none', fontWeight: 700, borderRadius: '12px', px: 3 }}
            >
              Changer de formule
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
    </Box>
  );
}
