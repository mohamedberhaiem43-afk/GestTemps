import { useEffect, useMemo, useState } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Button, Box, Typography, Paper, Alert, IconButton,
  CircularProgress, Stack, Divider,
} from '@mui/material';
import RocketLaunchIcon from '@mui/icons-material/RocketLaunch';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CheckIcon from '@mui/icons-material/Check';
import CloseIcon from '@mui/icons-material/Close';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import { useNavigate } from 'react-router-dom';
import apiInstance from '../API/apiInstance';

/**
 * Modale "Choisissez votre pack" — affichée au clic sur « Voir les tarifs »
 * ou « Voir les autres packs » depuis la page abonnement.
 *
 * Présentation 3 colonnes inspirée du parcours Dougs : chaque pack expose son
 * prix, son tagline et la liste des fonctionnalités, avec un CTA principal
 * « Voir le devis → » qui ouvre DevisPackPage. Le pack courant est verrouillé
 * (« ✓ Pack choisi »).
 *
 * Pour les tenants déjà abonnés (Active/Trialing + StripeSubscriptionId) on
 * conserve aussi un parcours "changement en un clic" : cliquer sur la carte
 * sélectionne le pack, ce qui révèle le différentiel prorata-temporis sous les
 * cartes + un bouton de confirmation dans le footer. Cette branche est désactivée
 * pour les essais sans carte (qui doivent passer par /billing/checkout via le
 * devis pour transmettre un moyen de paiement à Stripe).
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

// Source de vérité côté serveur : PlanCatalog. Fetché à l'ouverture de la modale
// pour ne plus dupliquer les tarifs en dur dans le frontend (toute mise à jour de
// grille tarifaire ne nécessite ainsi qu'un déploiement backend).
interface PlanCatalogEntry {
  code: string;
  displayName: string;
  flatPriceMonthlyEur: number;
  flatPriceAnnualMonthlyEur: number;
  includedEmployees: number;
  includedAdmins: number | null;
  overageRatePerEmployeeEur: number;
  storageQuotaMb: number;
  // null depuis 2026-05-27 : plus de plafond commercial sur le stockage.
  // L'admin peut acheter des blocs de stockage supplémentaires sans limite.
  maxStorageMb: number | null;
  storageSupplementBlockEur: number;
}

interface ChangePlanModalProps {
  open: boolean;
  onClose: () => void;
  currentPlan: string | null;
  onSuccess: (newPlan: string) => void;
  // Active la branche "changement en un clic" (preview prorata + bouton confirmation).
  // À mettre à false pour les tenants sans subscription Stripe (essais purs) : seul
  // le parcours « Voir le devis → DevisPackDialog → Stripe Checkout » est alors actif.
  canChangeInPlace?: boolean;
  // Callback déclenché au clic sur "Voir le devis" d'une carte. Si non fourni, la
  // modale retombe sur une navigation vers /dashboard/devis-pack (page legacy).
  // Le parent (MonAbonnementPage) l'utilise pour ouvrir DevisPackDialog par-dessus.
  onViewDevis?: (plan: 'Starter' | 'Standard' | 'Premium', cycle: 'monthly' | 'annual') => void;
}

// Aligné avec ABRPOINT.Server.Tenancy.PlanCatalog (source de vérité côté serveur).
// On garde ici uniquement ce qui est nécessaire à l'affichage de la grille.
const PLAN_META: Record<PlanKey, {
  label: string;
  tagline: string;
  baseEur: number;
  rank: number;
  intro: string;
  features: string[];
  popular?: boolean;
}> = {
  // baseEur = prix d'engagement ANNUEL (équivalent mensuel) — c'est le « dès »
  // affiché sur les cartes, le plus bas affiché à l'utilisateur. Aligné avec
  // tarifs.txt 2026-05 : Starter 69 €, Standard 119 €, Premium 249 €.
  Starter: {
    label: 'Starter',
    tagline: 'Pour démarrer la digitalisation RH d\'une petite équipe — pointage web & mobile, congés et fiches employés.',
    baseEur: 69,
    rank: 1,
    intro: 'Ce pack comprend les avantages :',
    features: [
      'Pointage web & mobile',
      'Gestion RH essentielle (fiches, contrats)',
      'Gestion congés & absences',
      'Tableau de bord simplifié',
      'Notifications essentielles',
      '10 Go stockage sécurisé · Hébergement France OVH',
      '1 administrateur · support standard',
      'Jusqu\'à 10 salariés inclus',
      'Saisie manuelle uniquement (sans import Excel en masse)',
    ],
  },
  Standard: {
    label: 'Standard',
    tagline: 'Mobile, géolocalisation, coffre numérique, export paie et obligations RH.',
    baseEur: 119,
    rank: 2,
    intro: 'L\'intégralité du Pack Starter plus :',
    features: [
      'App mobile + géolocalisation',
      'Coffre numérique + signature électronique',
      'Import Excel en masse (employés, services, fonctions…)',
      'Export paie + préparation paie',
      'Gestion congés, missions, autorisations',
      'Tableaux de bord avancés · 25 salariés inclus · 50 Go stockage',
    ],
    popular: true,
  },
  // Code interne « Premium » conservé pour compat Stripe ; libellé commercial réaligné
  // sur « Premium » depuis 2026-05-27 (était « Business »).
  Premium: {
    label: 'Premium',
    tagline: 'Multi-filiales, assistant IA et sécurité avancée pour les grands comptes.',
    baseEur: 249,
    rank: 3,
    intro: 'L\'intégralité du Pack Standard plus :',
    features: [
      'Multi-filiales (sociétés illimitées)',
      'Assistant IA (RAG)',
      'Audit avancé + branding personnalisé',
      'Sécurité mobile renforcée · 50 salariés inclus · 200 Go stockage',
    ],
  },
};

// Features perdues quand on passe d'un plan supérieur à un inférieur (pour le warning).
// Aligné avec PlanCatalog côté serveur — la source de vérité reste là-bas.
// 2026-05 : Starter inclut désormais le mobile + la gestion congés/autorisations, donc
// passer Standard→Starter ne fait plus perdre ces fonctionnalités. Ce qui reste exclusif
// Standard+ : géolocalisation, coffre, signature, multi-sites, dashboards avancés, missions.
const PLAN_FEATURES: Record<PlanKey, string[]> = {
  Starter:  ['App mobile', 'Congés', 'Autorisations'],
  Standard: ['App mobile', 'Géolocalisation', 'Coffre numérique', 'Signature électronique', 'Multi-sites', 'Tableaux de bord avancés', 'Missions', 'Congés', 'Autorisations', 'Import Excel en masse'],
  Premium:  ['App mobile', 'Géolocalisation', 'Coffre numérique', 'Signature électronique', 'Multi-sites', 'Multi-filiales', 'Tableaux de bord avancés', 'Assistant IA (RAG)', 'Audit avancé', 'Branding personnalisé', 'Sécurité mobile renforcée', 'Missions', 'Congés', 'Autorisations', 'Import Excel en masse'],
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

export default function ChangePlanModal({ open, onClose, currentPlan, onSuccess, canChangeInPlace = true, onViewDevis }: ChangePlanModalProps) {
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
  // Catalogue tarifaire chargé depuis le backend (PlanCatalog). On garde les
  // valeurs en dur (PLAN_META) en fallback pour ne pas casser l'affichage si
  // l'API plans n'est pas joignable (offline, dev sans backend…).
  const [catalog, setCatalog] = useState<Record<PlanKey, PlanCatalogEntry> | null>(null);

  // Reset state à chaque ouverture (sinon résidus du précédent flow)
  useEffect(() => {
    if (open) {
      setSelected(null);
      setPreview(null);
      setPreviewError(null);
      setSubmitError(null);
    }
  }, [open]);

  // Fetch du catalogue tarifaire backend une fois à l'ouverture. Les prix affichés
  // viennent désormais de PlanCatalog côté serveur — toute mise à jour tarifaire
  // se propage sans redéploiement client.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      try {
        const { data } = await apiInstance.get<PlanCatalogEntry[]>('/billing/plans');
        if (cancelled) return;
        const map = data.reduce<Record<string, PlanCatalogEntry>>((acc, p) => {
          acc[p.code] = p;
          return acc;
        }, {});
        setCatalog({
          Starter: map['Starter'],
          Standard: map['Standard'],
          Premium: map['Premium'],
        });
      } catch {
        // best-effort — on garde les valeurs PLAN_META en dur en fallback.
      }
    })();
    return () => { cancelled = true; };
  }, [open]);

  // Auto-preview à chaque changement de sélection (seulement si on est en mode in-place).
  useEffect(() => {
    if (!open || !canChangeInPlace || !selected || selected === currentKey) {
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
  }, [selected, currentKey, open, canChangeInPlace]);

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

  const goToDevis = (key: PlanKey) => {
    if (onViewDevis) {
      // Parent va ouvrir DevisPackDialog par-dessus — on n'a plus à naviguer.
      // On ferme la modale "Choisissez votre pack" pour laisser place au devis.
      onClose();
      onViewDevis(key, 'monthly');
      return;
    }
    onClose();
    navigate(`/dashboard/devis-pack?plan=${key}&cycle=monthly`);
  };

  return (
    <Dialog
      open={open}
      onClose={() => !submitting && onClose()}
      maxWidth="lg"
      fullWidth
      PaperProps={{ sx: { borderRadius: '20px' } }}
    >
      <DialogTitle sx={{ fontWeight: 800, pb: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between', pr: 2 }}>
        <Typography variant="h5" sx={{ fontWeight: 800, color: '#0f172a' }}>
          Choisissez votre pack
        </Typography>
        <IconButton onClick={onClose} disabled={submitting} size="small" aria-label="Fermer">
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent sx={{ pt: 1 }}>
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', md: 'repeat(3, 1fr)' },
            gap: 2.5,
            mt: 2.5,
            alignItems: 'stretch',
          }}
        >
          {(Object.keys(PLAN_META) as PlanKey[]).map((key) => {
            const meta = PLAN_META[key];
            const isCurrent = key === currentKey;
            const isSelected = key === selected;
            const isPopular = meta.popular;
            const isPremium = key === 'Premium';
            const cardClickable = !isCurrent && canChangeInPlace;
            // Palette or pour Premium — utilisée à la fois pour le cadre, le titre,
            // le prix et le ruban « Haut de gamme ». Couleurs choisies pour rester
            // lisibles sur fond crème (#fffdf5) sans heurter le bleu Concorde.
            const goldBorder = '#d4af37';
            const goldText = '#92670a';
            const goldAccent = '#b8860b';
            return (
              <Paper
                key={key}
                elevation={0}
                onClick={() => cardClickable && setSelected(key)}
                sx={{
                  position: 'relative',
                  p: 3,
                  pt: (isPopular || isPremium) ? 4.5 : 3,
                  borderRadius: '16px',
                  border: isSelected
                    ? `2px solid ${isPremium ? goldBorder : '#0040a1'}`
                    : isPremium
                      ? `2px solid ${goldBorder}`
                      : isPopular
                        ? '1.5px solid #0040a1'
                        : '1px solid #e2e8f0',
                  bgcolor: isCurrent ? '#f8fafc' : isPremium ? '#fffdf5' : '#fff',
                  cursor: cardClickable ? 'pointer' : 'default',
                  transition: 'all 0.2s',
                  display: 'flex',
                  flexDirection: 'column',
                  boxShadow: isPremium ? '0 10px 30px rgba(212,175,55,0.18)' : 'none',
                  '&:hover': cardClickable ? {
                    borderColor: isPremium ? goldBorder : '#0040a1',
                    boxShadow: isPremium
                      ? '0 12px 36px rgba(212,175,55,0.28)'
                      : '0 4px 16px rgba(0, 64, 161, 0.1)',
                  } : {},
                }}
              >
                {isPopular && !isPremium && (
                  <Box
                    sx={{
                      position: 'absolute',
                      top: 12,
                      left: '50%',
                      transform: 'translateX(-50%)',
                      bgcolor: '#0f172a',
                      color: '#fff',
                      px: 1.5,
                      py: 0.4,
                      borderRadius: '999px',
                      fontWeight: 700,
                      fontSize: 10,
                      letterSpacing: '0.1em',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    ✦ POPULAIRE ✦
                  </Box>
                )}
                {isPremium && (
                  <Box
                    sx={{
                      position: 'absolute',
                      top: 12,
                      left: '50%',
                      transform: 'translateX(-50%)',
                      background: `linear-gradient(135deg, ${goldBorder} 0%, ${goldAccent} 100%)`,
                      color: '#fff',
                      px: 1.5,
                      py: 0.4,
                      borderRadius: '999px',
                      fontWeight: 700,
                      fontSize: 10,
                      letterSpacing: '0.1em',
                      whiteSpace: 'nowrap',
                      boxShadow: `0 4px 10px rgba(184,134,11,0.32)`,
                    }}
                  >
                    ★ HAUT DE GAMME
                  </Box>
                )}

                <Typography sx={{ fontSize: 20, fontWeight: 800, color: isPremium ? goldText : '#0f172a', mb: 0.5 }}>
                  Pack <Box component="span" sx={{ color: isPremium ? goldAccent : '#0040a1' }}>{meta.label}</Box>
                </Typography>

                {(() => {
                  // Prix issu du backend si fetch OK, sinon constante PLAN_META (fallback).
                  // Affichage : « dès {annuel} € HT/mois » + petit rappel mensuel pour
                  // rendre la grille tarifaire transparente (l'engagement annuel est
                  // moins cher, mais l'admin doit voir le prix mensuel sans engagement).
                  const cat = catalog?.[key];
                  const annual = cat?.flatPriceAnnualMonthlyEur ?? meta.baseEur;
                  const monthly = cat?.flatPriceMonthlyEur;
                  return (
                    <Box sx={{ mb: 1 }}>
                      <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 0.5 }}>
                        <Typography sx={{ color: '#64748b', fontSize: 14 }}>dès</Typography>
                        <Typography sx={{ fontSize: 28, fontWeight: 800, color: isPremium ? goldText : '#0f172a' }}>
                          {annual.toFixed(0)} €
                        </Typography>
                        <Typography sx={{ color: '#64748b', fontSize: 13 }}>HT/mois</Typography>
                      </Box>
                      {monthly != null && monthly !== annual && (
                        <Typography sx={{ fontSize: 11, color: '#64748b', mt: 0.5 }}>
                          ou <strong>{monthly.toFixed(0)} €</strong> HT/mois sans engagement
                        </Typography>
                      )}
                      {cat && (
                        <Typography sx={{ fontSize: 11, color: '#64748b', mt: 0.3 }}>
                          {cat.includedEmployees} salariés inclus · +{cat.overageRatePerEmployeeEur.toFixed(2)} € / collab. supp.
                        </Typography>
                      )}
                    </Box>
                  );
                })()}

                <Typography sx={{ color: '#475569', fontSize: 13, mb: 2.5, lineHeight: 1.5, minHeight: 56 }}>
                  {meta.tagline}
                </Typography>

                {isCurrent ? (
                  <Button
                    fullWidth
                    disabled
                    startIcon={<CheckIcon />}
                    sx={{
                      bgcolor: '#e2e8f0 !important',
                      color: '#475569 !important',
                      textTransform: 'none',
                      fontWeight: 700,
                      borderRadius: '10px',
                      py: 1.2,
                      mb: 2.5,
                    }}
                  >
                    Pack choisi
                  </Button>
                ) : (
                  <Button
                    fullWidth
                    variant="contained"
                    endIcon={<ArrowForwardIcon />}
                    onClick={(e) => { e.stopPropagation(); goToDevis(key); }}
                    sx={{
                      bgcolor: isPremium ? goldAccent : '#0040a1',
                      background: isPremium
                        ? `linear-gradient(135deg, ${goldBorder} 0%, ${goldAccent} 100%)`
                        : undefined,
                      '&:hover': isPremium
                        ? { background: `linear-gradient(135deg, ${goldAccent} 0%, #8a6508 100%)` }
                        : { bgcolor: '#003080' },
                      textTransform: 'none',
                      fontWeight: 700,
                      borderRadius: '10px',
                      py: 1.2,
                      mb: 2.5,
                      boxShadow: isPremium ? '0 6px 18px rgba(184,134,11,0.32)' : 'none',
                    }}
                  >
                    Voir le devis
                  </Button>
                )}

                <Divider sx={{ mb: 2 }} />

                <Typography sx={{ fontSize: 13, fontWeight: 700, color: isPremium ? goldText : '#0f172a', mb: 1.5 }}>
                  {meta.intro}
                </Typography>

                <Stack spacing={1.25} sx={{ flex: 1 }}>
                  {meta.features.map((f) => (
                    <Stack key={f} direction="row" spacing={1} alignItems="flex-start">
                      <CheckCircleIcon sx={{ color: isPremium ? goldAccent : '#0040a1', fontSize: 18, mt: 0.25, flexShrink: 0 }} />
                      <Typography sx={{ fontSize: 13, color: '#475569', lineHeight: 1.5 }}>
                        {f}
                      </Typography>
                    </Stack>
                  ))}
                </Stack>

                {isSelected && !isCurrent && canChangeInPlace && (
                  <Box sx={{ mt: 2, pt: 2, borderTop: '1px dashed #cbd5e1' }}>
                    <Typography sx={{ fontSize: 11, color: '#0040a1', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      ✓ Sélectionné — voir le différentiel ci-dessous
                    </Typography>
                  </Box>
                )}
              </Paper>
            );
          })}
        </Box>

        {/* Preview chiffré + warning downgrade — branche "in-place" uniquement */}
        {canChangeInPlace && selected && selected !== currentKey && (
          <Paper
            elevation={0}
            sx={{
              mt: 3, p: 2.5, borderRadius: '12px',
              border: '1px solid #bfdbfe',
              background: 'linear-gradient(135deg, #eff6ff 0%, #f0f9ff 100%)',
            }}
          >
            <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1.5 }}>
              {isUpgrade && <ArrowUpwardIcon sx={{ color: '#0040a1', fontSize: 18 }} />}
              {isDowngrade && <ArrowDownwardIcon sx={{ color: '#64748b', fontSize: 18 }} />}
              <Typography sx={{ fontSize: 12, fontWeight: 700, color: '#0040a1', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Estimation pour passer à {selected}
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

        {canChangeInPlace && isDowngrade && lostFeatures.length > 0 && (
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
      <DialogActions sx={{ p: 3, pt: 2 }}>
        <Button onClick={onClose} disabled={submitting} sx={{ textTransform: 'none', fontWeight: 700 }}>
          Fermer
        </Button>
        {canChangeInPlace && selected && selected !== currentKey && (
          <Button
            variant="contained"
            onClick={handleConfirm}
            disabled={submitting || previewing || !!previewError}
            startIcon={submitting ? <CircularProgress size={16} color="inherit" /> : <RocketLaunchIcon />}
            sx={{
              textTransform: 'none', fontWeight: 700, borderRadius: '12px', px: 3,
              background: isDowngrade ? undefined : 'linear-gradient(135deg, #0040a1 0%, #0056d2 100%)',
            }}
            color={isDowngrade ? 'warning' : 'primary'}
          >
            {isDowngrade ? `Rétrograder vers ${selected}` : `Passer au pack ${selected} en un clic`}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}
