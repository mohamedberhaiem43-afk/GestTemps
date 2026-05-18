import { useEffect, useMemo, useState } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Button, Box, Typography, RadioGroup, FormControlLabel, Radio, Paper, Alert,
  CircularProgress, Chip, Stack, Divider,
} from '@mui/material';
import RocketLaunchIcon from '@mui/icons-material/RocketLaunch';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import { useNavigate } from 'react-router-dom';
import apiInstance from '../API/apiInstance';

/**
 * Modale de changement de plan pour un tenant avec abonnement Stripe actif.
 *
 * Workflow :
 *   1. L'admin choisit le nouveau plan (Starter / Standard / Premium) — le plan actuel
 *      est désactivé dans la liste.
 *   2. Au changement de sélection, on appelle /api/billing/preview-plan-change pour
 *      afficher le différentiel prorata-temporis ("Vous serez facturé 18,40 € sur
 *      votre prochaine facture du 12 juin").
 *   3. Si le nouveau plan est INFÉRIEUR à l'actuel, on affiche un warning listant
 *      les features perdues — l'admin doit explicitement confirmer (pas de blocage).
 *   4. Au clic Confirmer : POST /api/billing/change-plan, Stripe applique le change,
 *      le tenant.PlanCode est mis à jour côté master DB, l'UI refresh.
 *
 * Pas de blocage strict : la promesse commerciale "transition immédiate, différentiel
 * prorata-temporis" doit toujours pouvoir être tenue. L'admin est averti des risques
 * (downgrade avec features actives) mais reste libre de décider.
 */
type PlanKey = 'Starter' | 'Standard' | 'Premium';

interface PreviewResponse {
  currentPlan: string;
  newPlan: string;
  prorationAmount: number | null;
  currency: string | null;
  nextInvoiceAt: string | null;
  nextInvoiceTotal: number | null;
  billedSeats: number;
  activeEmployees: number;
}

interface ChangePlanModalProps {
  open: boolean;
  onClose: () => void;
  currentPlan: string | null;
  onSuccess: (newPlan: string) => void;
}

// Définition simplifiée (label + tagline + ordre commercial). Doit rester aligné avec
// ABRPOINT.Server.Tenancy.PlanCatalog côté backend — la source de vérité reste serveur.
const PLAN_META: Record<PlanKey, { label: string; tagline: string; baseEur: number; includedSeats: number; maxSeats: number; rank: number }> = {
  // Grille Early Launch 2026-05-17. Aligné avec ABRPOINT.Server.Tenancy.PlanCatalog.
  Starter:  { label: 'Starter',  tagline: 'Pointage simple, sans workflow RH',         baseEur: 29.50, includedSeats: 10, maxSeats: 30,  rank: 1 },
  Standard: { label: 'Standard', tagline: 'Mobile, géolocalisation, coffre numérique', baseEur: 54.00, includedSeats: 15, maxSeats: 100, rank: 2 },
  Premium:  { label: 'Premium',  tagline: 'Multi-filiales, sécurité avancée',          baseEur: 149.00, includedSeats: 30, maxSeats: 200, rank: 3 },
};

// Features perdues quand on passe d'un plan supérieur à un inférieur (pour le warning).
// Aligné avec PlanCatalog côté serveur — la source de vérité reste là-bas.
const PLAN_FEATURES: Record<PlanKey, string[]> = {
  Starter:  [],
  Standard: ['App mobile', 'Géolocalisation', 'Coffre numérique', 'Signature électronique', 'Multi-sites', 'Tableaux de bord avancés', 'Missions', 'Congés', 'Autorisations'],
  Premium:  ['App mobile', 'Géolocalisation', 'Coffre numérique', 'Signature électronique', 'Multi-sites', 'Multi-filiales', 'Tableaux de bord avancés', 'Assistant IA (RAG)', 'Audit avancé', 'Branding personnalisé', 'Sécurité mobile renforcée', 'Missions', 'Congés', 'Autorisations'],
};

function computeLostFeatures(current: PlanKey | null, target: PlanKey): string[] {
  if (!current) return [];
  const cur = PLAN_FEATURES[current] ?? [];
  const tgt = PLAN_FEATURES[target] ?? [];
  return cur.filter((f) => !tgt.includes(f));
}

function formatMoney(amount: number | null | undefined, currency: string | null | undefined): string {
  if (amount == null || !currency) return '—';
  try {
    return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: currency.toUpperCase() }).format(amount);
  } catch {
    return `${amount.toFixed(2)} ${currency.toUpperCase()}`;
  }
}

function formatDate(d: string | null | undefined): string {
  if (!d) return '—';
  try { return new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' }); }
  catch { return d; }
}

export default function ChangePlanModal({ open, onClose, currentPlan, onSuccess }: ChangePlanModalProps) {
  const navigate = useNavigate();
  const normalizedCurrent = (currentPlan ?? '').trim();
  const currentKey: PlanKey | null = (['Starter', 'Standard', 'Premium'] as PlanKey[]).find(
    (k) => k.toLowerCase() === normalizedCurrent.toLowerCase()
  ) ?? null;

  const [selected, setSelected] = useState<PlanKey | null>(null);
  const [preview, setPreview] = useState<PreviewResponse | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Reset state à chaque ouverture (sinon résidus du précédent flow)
  useEffect(() => {
    if (open) {
      setSelected(null);
      setPreview(null);
      setPreviewError(null);
      setSubmitError(null);
    }
  }, [open]);

  // Auto-preview à chaque changement de sélection. Debounced via le setSelected lui-même
  // (le user ne peut pas spammer plus vite qu'un clic). Pas besoin de useCallback.
  useEffect(() => {
    if (!open || !selected || selected === currentKey) {
      setPreview(null);
      setPreviewError(null);
      return;
    }
    let cancelled = false;
    (async () => {
      setPreviewing(true);
      setPreviewError(null);
      try {
        const res = await apiInstance.post<PreviewResponse>('/billing/preview-plan-change', {
          planCode: selected,
          billingCycle: 'monthly',
          userCount: 1, // le backend clampe sur Math.max(1, employés actifs)
        });
        if (!cancelled) setPreview(res.data);
      } catch (e: any) {
        if (!cancelled) {
          setPreview(null);
          setPreviewError(e?.response?.data?.error || 'Impossible de calculer le différentiel.');
        }
      } finally {
        if (!cancelled) setPreviewing(false);
      }
    })();
    return () => { cancelled = true; };
  }, [selected, currentKey, open]);

  const isDowngrade = useMemo(() => {
    if (!selected || !currentKey) return false;
    return PLAN_META[selected].rank < PLAN_META[currentKey].rank;
  }, [selected, currentKey]);

  const isUpgrade = useMemo(() => {
    if (!selected || !currentKey) return false;
    return PLAN_META[selected].rank > PLAN_META[currentKey].rank;
  }, [selected, currentKey]);

  const lostFeatures = useMemo(() => {
    if (!selected || !isDowngrade) return [] as string[];
    return computeLostFeatures(currentKey, selected);
  }, [selected, currentKey, isDowngrade]);

  const handleConfirm = async () => {
    if (!selected) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const res = await apiInstance.post('/billing/change-plan', {
        planCode: selected,
        billingCycle: 'monthly',
        userCount: 1,
      });
      const newPlan = res.data?.newPlan ?? selected;
      onSuccess(newPlan);
    } catch (e: any) {
      setSubmitError(e?.response?.data?.error || 'Échec du changement de plan. Réessayez plus tard.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onClose={() => !submitting && onClose()} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ fontWeight: 800, pb: 1 }}>
        Changer de formule
      </DialogTitle>
      <DialogContent>
        <Typography sx={{ mb: 2.5, color: '#475569', fontSize: 14 }}>
          Choisissez votre nouvelle formule. Les fonctionnalités sont mises à jour immédiatement
          et le différentiel est facturé/crédité prorata-temporis sur votre prochaine facture.
        </Typography>

        <RadioGroup value={selected ?? ''} onChange={(e) => setSelected(e.target.value as PlanKey)}>
          {(Object.keys(PLAN_META) as PlanKey[]).map((key) => {
            const meta = PLAN_META[key];
            const isCurrent = key === currentKey;
            const isSelected = key === selected;
            return (
              <Paper
                key={key}
                elevation={0}
                sx={{
                  p: 2, mb: 1.5, borderRadius: '12px',
                  border: isSelected ? '2px solid #0040a1' : '1px solid #e2e8f0',
                  background: isSelected ? '#f0f6ff' : isCurrent ? '#f8fafc' : '#fff',
                  opacity: isCurrent ? 0.7 : 1,
                  cursor: isCurrent ? 'not-allowed' : 'pointer',
                }}
                onClick={() => !isCurrent && setSelected(key)}
              >
                <Stack direction="row" spacing={1} alignItems="center">
                  <FormControlLabel
                    value={key}
                    disabled={isCurrent}
                    control={<Radio />}
                    sx={{ flex: 1, m: 0 }}
                    label={
                      <Box sx={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                          <Typography sx={{ fontWeight: 800, fontSize: 16 }}>{meta.label}</Typography>
                          {isCurrent && <Chip label="Plan actuel" size="small" sx={{ fontWeight: 700, bgcolor: '#e2e8f0' }} />}
                          <Typography sx={{ ml: 'auto', fontWeight: 800, color: '#0040a1' }}>
                            {meta.baseEur.toFixed(2)} € / mois
                          </Typography>
                        </Box>
                        <Typography sx={{ fontSize: 13, color: '#64748b', mt: 0.5 }}>
                          {meta.tagline} · {meta.includedSeats} inclus · jusqu'à {meta.maxSeats} max
                        </Typography>
                      </Box>
                    }
                  />
                  {/* Bouton « Voir le devis » : ouvre la page DevisPackPage avec le détail
                      des prochaines factures + souscription. Permet à l'utilisateur de
                      consulter le détail AVANT d'engager le changement (différentiel
                      prorata calculé dans le panel ci-dessous est utile pour les actifs ;
                      la page devis cible plutôt les essais ou prospects). Masqué pour le
                      plan actuel (qu'on ne peut pas re-souscrire). */}
                  {!isCurrent && (
                    <Button
                      size="small"
                      variant="outlined"
                      endIcon={<ArrowForwardIcon sx={{ fontSize: 14 }} />}
                      onClick={(e) => {
                        e.stopPropagation();
                        onClose();
                        navigate(`/dashboard/devis-pack?plan=${key}&cycle=monthly`);
                      }}
                      sx={{ textTransform: 'none', fontWeight: 700, borderRadius: '10px', flexShrink: 0 }}
                    >
                      Voir le devis
                    </Button>
                  )}
                </Stack>
              </Paper>
            );
          })}
        </RadioGroup>

        {/* Preview chiffré */}
        {selected && selected !== currentKey && (
          <Paper
            elevation={0}
            sx={{
              mt: 1, p: 2.5, borderRadius: '12px',
              border: '1px solid #bfdbfe',
              background: 'linear-gradient(135deg, #eff6ff 0%, #f0f9ff 100%)',
            }}
          >
            <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1.5 }}>
              {isUpgrade && <ArrowUpwardIcon sx={{ color: '#0040a1', fontSize: 18 }} />}
              {isDowngrade && <ArrowDownwardIcon sx={{ color: '#64748b', fontSize: 18 }} />}
              <Typography sx={{ fontSize: 12, fontWeight: 700, color: '#0040a1', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Estimation
              </Typography>
            </Stack>

            {previewing && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                <CircularProgress size={16} />
                <Typography sx={{ fontSize: 14, color: '#475569' }}>Calcul en cours…</Typography>
              </Box>
            )}

            {!previewing && previewError && (
              <Alert severity="error" sx={{ borderRadius: '8px' }}>{previewError}</Alert>
            )}

            {!previewing && !previewError && preview && (
              <Stack spacing={1}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography sx={{ fontSize: 14, color: '#475569' }}>
                    Différentiel ajouté à votre prochaine facture
                  </Typography>
                  <Typography sx={{ fontWeight: 800, fontSize: 16, color: (preview.prorationAmount ?? 0) >= 0 ? '#0040a1' : '#059669' }}>
                    {preview.prorationAmount != null
                      ? (preview.prorationAmount > 0
                          ? `+ ${formatMoney(preview.prorationAmount, preview.currency)}`
                          : `− ${formatMoney(Math.abs(preview.prorationAmount), preview.currency)}`)
                      : '—'}
                  </Typography>
                </Box>
                <Divider />
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography sx={{ fontSize: 13, color: '#64748b' }}>
                    Prochaine facture
                  </Typography>
                  <Typography sx={{ fontSize: 13, color: '#0f172a', fontWeight: 700 }}>
                    {formatMoney(preview.nextInvoiceTotal, preview.currency)} · {formatDate(preview.nextInvoiceAt)}
                  </Typography>
                </Box>
                <Typography sx={{ fontSize: 12, color: '#64748b', mt: 0.5 }}>
                  Calcul prorata-temporis basé sur {preview.activeEmployees} salarié(s) actif(s).
                  {(preview.prorationAmount ?? 0) < 0 && ' Le crédit sera déduit automatiquement.'}
                </Typography>
              </Stack>
            )}
          </Paper>
        )}

        {/* Warning downgrade */}
        {isDowngrade && lostFeatures.length > 0 && (
          <Alert
            severity="warning"
            icon={<WarningAmberIcon />}
            sx={{ mt: 2, borderRadius: '12px' }}
          >
            <Typography sx={{ fontWeight: 700, mb: 1 }}>
              Vous perdrez ces fonctionnalités :
            </Typography>
            <Box component="ul" sx={{ m: 0, pl: 2.5, fontSize: 13 }}>
              {lostFeatures.map((f) => <li key={f}>{f}</li>)}
            </Box>
            <Typography sx={{ fontSize: 12, color: '#92400e', mt: 1 }}>
              Les données associées sont conservées mais ces sections deviendront inaccessibles
              tant que vous restez sur ce plan.
            </Typography>
          </Alert>
        )}

        {submitError && <Alert severity="error" sx={{ mt: 2, borderRadius: '8px' }}>{submitError}</Alert>}
      </DialogContent>
      <DialogActions sx={{ p: 3, pt: 1 }}>
        <Button onClick={onClose} disabled={submitting}>Annuler</Button>
        <Button
          variant="contained"
          onClick={handleConfirm}
          disabled={submitting || !selected || selected === currentKey || previewing || !!previewError}
          startIcon={submitting ? <CircularProgress size={16} color="inherit" /> : <RocketLaunchIcon />}
          sx={{
            textTransform: 'none', fontWeight: 700, borderRadius: '12px', px: 3,
            background: isDowngrade ? undefined : 'linear-gradient(135deg, #0040a1 0%, #0056d2 100%)',
          }}
          color={isDowngrade ? 'warning' : 'primary'}
        >
          {isDowngrade ? `Rétrograder vers ${selected ?? ''}` : `Passer au pack ${selected ?? ''}`}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
