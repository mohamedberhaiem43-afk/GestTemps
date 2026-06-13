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
  // estimated=true : chiffrage calculé localement côté serveur (simulation Stripe
  // indisponible). On affiche alors une variation mensuelle indicative + une note,
  // au lieu du prorata exact. Le montant définitif est confirmé à la validation.
  estimated?: boolean;
  note?: string | null;
}

// Liens de paiement Stripe par pack × cycle (mêmes liens que la page d'accueil). Permettent
// de souscrire / changer de pack via le Checkout hébergé Stripe (essai 30 j inclus), en
// alternative au changement « en un clic » via l'API /billing/change-plan. Le webhook
// checkout.session.completed reconnaît le pack (price de base) → bascule le PlanCode et
// REMPLACE la subscription (l'ancien abonnement pack est annulé : pas de double-facturation).
const PACK_PAYMENT_LINKS: Record<PlanKey, { monthly: string; annual: string }> = {
  Starter: {
    monthly: 'https://buy.stripe.com/9B6dR21dX83v9JBcZX00002',
    annual: 'https://buy.stripe.com/aFa9AMcWFgA14ph2lj00003',
  },
  Standard: {
    monthly: 'https://buy.stripe.com/9B628k09TbfHaNF2lj00004',
    annual: 'https://buy.stripe.com/00w4gs2i197z7Bt1hf00005',
  },
  Premium: {
    monthly: 'https://buy.stripe.com/8x24gs1dX83v8Fxgc900006',
    annual: 'https://buy.stripe.com/4gMcMY4q91F7091cZX00007',
  },
};

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
  // Legacy : appelé après l'ancien changement « en un clic » via l'API. Le changement de
  // pack passe désormais par les Payment Links Stripe (le webhook met à jour le PlanCode),
  // donc ce callback n'est plus déclenché. Conservé optionnel pour compat des appelants.
  onSuccess?: (newPlan: string) => void;
  // Active la branche "changement en un clic" (preview prorata + bouton confirmation).
  // À mettre à false pour les tenants sans subscription Stripe (essais purs) : seul
  // le parcours « Voir le devis → DevisPackDialog → Stripe Checkout » est alors actif.
  canChangeInPlace?: boolean;
  // Callback déclenché au clic sur "Voir le devis" d'une carte. Si non fourni, la
  // modale retombe sur une navigation vers /dashboard/devis-pack (page legacy).
  // Le parent (MonAbonnementPage) l'utilise pour ouvrir DevisPackDialog par-dessus.
  onViewDevis?: (plan: 'Starter' | 'Standard' | 'Premium', cycle: 'monthly' | 'annual') => void;
  // Slug du tenant courant (info.slug) — injecté en ?client_reference_id={slug} dans les
  // Payment Links de pack pour que le webhook rattache le checkout au bon tenant. Repli
  // sur localStorage('tenantSlug') si absent.
  tenantSlug?: string | null;
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
    tagline: 'TPE & startups',
    baseEur: 69,
    rank: 1,
    intro: 'Ce pack comprend les avantages :',
    features: [
      'Pointage web',
      'Gestion RH essentielle (fiches, contrats)',
      'Gestion congés, RTT, absences',
      'Tableau de bord simplifié · exports PDF / Excel',
      'Notifications essentielles',
      '10 Go stockage sécurisé · Hébergement France OVH',
      'Multi utilisateurs',
    ],
  },
  Standard: {
    label: 'Standard',
    tagline: 'PME en croissance',
    baseEur: 119,
    rank: 2,
    intro: 'L\'intégralité du Pack Starter plus :',
    features: [
      'Tout le pack Starter',
      'Application mobile + géolocalisation',
      'Coffre numérique & signature électronique',
      'Import Excel en masse (employés, services, fonctions, rubriques…)',
      'Préparation paie · export paie',
      'Multi-sites simple',
      'Congés, RTT, CET, sanctions',
      'Notifications push / email · Reporting avancé',
      '50 Go stockage sécurisé · Hébergement France OVH',
      'Multi utilisateurs',
      'Idéal : PME en croissance · équipes terrain · structures multi-sites · gestion RH centralisée',
    ],
    popular: true,
  },
  // Code interne « Premium » conservé pour compat Stripe ; libellé commercial réaligné
  // sur « Premium » depuis 2026-05-27 (était « Business »).
  Premium: {
    label: 'Premium',
    tagline: 'Multi-filiales & sécurité avancée',
    baseEur: 249,
    rank: 3,
    intro: 'L\'intégralité du Pack Standard plus :',
    features: [
      'Tout le pack Standard',
      'Multi-filiales · tableaux de bord avancés',
      'Sécurité renforcée',
      'Audit logs avancés',
      'Supervision avancée',
      '200 Go stockage sécurisé · Hébergement France OVH',
      'Administrateurs illimités · Onboarding accompagné',
      'SLA prioritaire',
      'Idéal : PME structurées · groupes multi-sites · conformité & sécurité avancées · organisations en croissance',
    ],
  },
};

// Features perdues quand on passe d'un plan supérieur à un inférieur (pour le warning).
// Aligné avec PlanCatalog côté serveur — la source de vérité reste là-bas.
// 2026-05 : Starter inclut désormais le mobile + la gestion congés/autorisations, donc
// passer Standard→Starter ne fait plus perdre ces fonctionnalités. Ce qui reste exclusif
// Standard+ : géolocalisation, coffre, signature, multi-sites, dashboards avancés, missions.
const PLAN_FEATURES: Record<PlanKey, string[]> = {
  Starter:  ['Pointage web & mobile', 'Gestion RH essentielle', 'Gestion congés et absences', 'Tableau de bord simplifié', 'Notifications essentielles', 'Stockage sécurisé'],
  Standard: ['Application mobile', 'Géolocalisation', 'Coffre numérique', 'Signature électronique', 'Import Excel en masse', 'Préparation paie', 'Multi-sites simple', 'Reporting avancé', 'Notifications push / email', 'Tableaux de bord avancés'],
  Premium:  ['Multi-filiales', 'Tableaux de bord avancés', 'Sécurité renforcée', 'Audit logs avancés', 'Supervision avancée', 'Administrateurs illimités', 'SLA prioritaire', 'API & intégrations', 'Onboarding accompagné'],
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

export default function ChangePlanModal({ open, onClose, currentPlan, canChangeInPlace = true, onViewDevis, tenantSlug }: ChangePlanModalProps) {
  const navigate = useNavigate();
  const normalizedCurrent = (currentPlan ?? '').trim();
  const currentKey: PlanKey | null = (['Starter', 'Standard', 'Premium'] as PlanKey[]).find(
    (k) => k.toLowerCase() === normalizedCurrent.toLowerCase()
  ) ?? null;

  const [selected, setSelected] = useState<PlanKey | null>(null);
  // Cycle de facturation choisi dans la modale (toggle Mensuel / Annuel — image 2).
  // Défaut « annual » : l'engagement annuel est l'offre mise en avant (le moins cher).
  const [cycle, setCycle] = useState<'monthly' | 'annual'>('annual');
  const [preview, setPreview] = useState<PreviewResponse | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [previewing, setPreviewing] = useState(false);
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
          billingCycle: cycle,
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
  }, [selected, currentKey, open, canChangeInPlace, cycle]);

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

  const handleConfirm = () => {
    if (!selected) return;
    // Le changement de pack passe désormais par le Payment Link Stripe hébergé (et non
    // l'API /billing/change-plan) : le webhook checkout.session.completed bascule le PlanCode
    // et remplace l'abonnement. On ouvre le lien puis on ferme la modale.
    openPackStripeLink(selected);
    onClose();
  };

  const goToDevis = (key: PlanKey) => {
    if (onViewDevis) {
      // Parent va ouvrir DevisPackDialog par-dessus — on n'a plus à naviguer.
      // On ferme la modale "Choisissez votre pack" pour laisser place au devis.
      onClose();
      onViewDevis(key, cycle);
      return;
    }
    onClose();
    navigate(`/dashboard/devis-pack?plan=${key}&cycle=${cycle}`);
  };

  // Ouvre le Payment Link Stripe du pack (cycle courant) en y injectant le slug du tenant
  // (?client_reference_id={slug}) pour que le webhook bascule le PlanCode du bon tenant.
  // Voie de paiement HÉBERGÉE Stripe — alternative fiable au changement « en un clic » API
  // (ce dernier peut échouer si la subscription/customer/price n'existent pas dans le compte
  // Stripe actif, cf. resource_missing). Le webhook annule l'ancien abonnement pack.
  const openPackStripeLink = (key: PlanKey) => {
    const base = PACK_PAYMENT_LINKS[key]?.[cycle];
    if (!base) return;
    const slug = tenantSlug || (typeof window !== 'undefined' ? window.localStorage.getItem('tenantSlug') : '') || '';
    const url = slug ? `${base}?client_reference_id=${encodeURIComponent(slug)}` : base;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  return (
    <Dialog
      open={open}
      onClose={() => onClose()}
      maxWidth="lg"
      fullWidth
      PaperProps={{ sx: { borderRadius: '20px' } }}
    >
      <DialogTitle sx={{ fontWeight: 800, pb: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2, pr: 2, flexWrap: 'wrap' }}>
        <Typography variant="h5" sx={{ fontWeight: 800, color: '#0f172a' }}>
          Choisissez votre pack
        </Typography>
        <Stack direction="row" alignItems="center" spacing={1}>
          {/* Toggle Mensuel / Annuel (image 2) */}
          <Box sx={{ display: 'inline-flex', alignItems: 'center', background: '#eef3fb', border: '1px solid #dce6f6', borderRadius: '999px', p: '4px' }}>
            {(['monthly', 'annual'] as const).map((cy) => {
              const active = cycle === cy;
              return (
                <Box
                  key={cy}
                  component="button"
                  type="button"
                  onClick={() => setCycle(cy)}
                  sx={{
                    font: 'inherit', fontSize: 13, fontWeight: 700, border: 0, cursor: 'pointer',
                    px: 1.8, py: 0.8, borderRadius: '999px', display: 'flex', alignItems: 'center', gap: 0.75,
                    transition: '.2s', background: active ? '#14346B' : 'transparent', color: active ? '#fff' : '#6A7691',
                  }}
                >
                  {cy === 'monthly' ? 'Mensuel' : 'Annuel'}
                </Box>
              );
            })}
          </Box>
          <IconButton onClick={onClose} size="small" aria-label="Fermer">
            <CloseIcon />
          </IconButton>
        </Stack>
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
                  pt: (isPopular || isPremium || isCurrent) ? 4.5 : 3,
                  borderRadius: '16px',
                  border: isCurrent
                    ? '2px solid #16A34A'
                    : isSelected
                    ? `2px solid ${isPremium ? goldBorder : '#0040a1'}`
                    : isPremium
                      ? `2px solid ${goldBorder}`
                      : isPopular
                        ? '1.5px solid #0040a1'
                        : '1px solid #e2e8f0',
                  bgcolor: isCurrent ? '#f6fef9' : isPremium ? '#fffdf5' : '#fff',
                  cursor: cardClickable ? 'pointer' : 'default',
                  transition: 'all 0.2s',
                  display: 'flex',
                  flexDirection: 'column',
                  boxShadow: isCurrent ? '0 0 0 4px #E7F6ED' : isPremium ? '0 10px 30px rgba(212,175,55,0.18)' : 'none',
                  '&:hover': cardClickable ? {
                    borderColor: isPremium ? goldBorder : '#0040a1',
                    boxShadow: isPremium
                      ? '0 12px 36px rgba(212,175,55,0.28)'
                      : '0 4px 16px rgba(0, 64, 161, 0.1)',
                  } : {},
                }}
              >
                {isCurrent && (
                  <Box
                    sx={{
                      position: 'absolute', top: 12, left: '50%', transform: 'translateX(-50%)',
                      bgcolor: '#16A34A', color: '#fff', px: 1.5, py: 0.4, borderRadius: '999px',
                      fontWeight: 700, fontSize: 10, letterSpacing: '0.06em', whiteSpace: 'nowrap',
                    }}
                  >
                    ✓ VOTRE PACK ACTUEL · {cycle === 'annual' ? 'ANNUEL' : 'MENSUEL'}
                  </Box>
                )}
                {isPopular && !isPremium && !isCurrent && (
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
                {isPremium && !isCurrent && (
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
                  // Le prix affiché suit le toggle Mensuel / Annuel (image 2), toujours
                  // exprimé « par mois ». La boîte bleue rappelle les sièges inclus + l'overage.
                  const cat = catalog?.[key];
                  const annual = cat?.flatPriceAnnualMonthlyEur ?? meta.baseEur;
                  const monthly = cat?.flatPriceMonthlyEur ?? meta.baseEur;
                  const price = cycle === 'annual' ? annual : monthly;
                  return (
                    <Box sx={{ mb: 1.5 }}>
                      <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 0.5 }}>
                        <Typography sx={{ fontSize: 30, fontWeight: 800, letterSpacing: '-.02em', color: isPremium ? goldText : '#0f172a' }}>
                          {price.toFixed(0)} €
                        </Typography>
                        <Typography sx={{ color: '#64748b', fontSize: 13 }}>HT /mois</Typography>
                      </Box>
                      <Typography sx={{ fontSize: 12, color: '#64748b', mt: 0.3 }}>
                        {cycle === 'annual' ? 'engagement annuel' : 'sans engagement'}
                      </Typography>
                      {cat && (
                        <Box sx={{ mt: 1.5, bgcolor: '#EEF3FB', border: '1px solid #DCE6F6', borderRadius: '11px', px: 1.5, py: 1.25 }}>
                          <Typography sx={{ fontSize: 13, color: '#0F1B33' }}>
                            <strong>{cat.includedEmployees} salariés</strong> inclus
                          </Typography>
                          <Typography sx={{ fontSize: 12.5, color: '#E8870B', fontWeight: 600, mt: 0.3 }}>
                            + {cat.overageRatePerEmployeeEur.toFixed(2)} € / collaborateur supplémentaire
                          </Typography>
                        </Box>
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
                      bgcolor: '#E7F6ED !important',
                      color: '#15803d !important',
                      border: '1px solid #bfe6cd',
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
                  <Stack spacing={1} sx={{ mb: 2.5 }}>
                    {/* Action PRIMAIRE : souscription / changement de pack via le Payment Link
                        Stripe hébergé (essai 30 j inclus). Rattaché au tenant via
                        client_reference_id ; le webhook bascule le PlanCode et annule l'ancien
                        abonnement pack. Remplace l'ancien parcours API /billing/checkout (502). */}
                    <Button
                      fullWidth
                      variant="contained"
                      startIcon={<RocketLaunchIcon />}
                      onClick={(e) => { e.stopPropagation(); openPackStripeLink(key); }}
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
                        boxShadow: isPremium ? '0 6px 18px rgba(184,134,11,0.32)' : 'none',
                      }}
                    >
                      Souscrire via Stripe ({cycle === 'annual' ? 'annuel' : 'mensuel'})
                    </Button>
                    {/* Action SECONDAIRE : demander un devis personnalisé (équipe commerciale). */}
                    <Button
                      fullWidth
                      variant="outlined"
                      endIcon={<ArrowForwardIcon />}
                      onClick={(e) => { e.stopPropagation(); goToDevis(key); }}
                      sx={{
                        textTransform: 'none',
                        fontWeight: 700,
                        borderRadius: '10px',
                        py: 0.9,
                        fontSize: 13,
                        color: isPremium ? goldAccent : '#0040a1',
                        borderColor: isPremium ? goldBorder : '#9bbef0',
                        '&:hover': {
                          borderColor: isPremium ? goldAccent : '#0040a1',
                          bgcolor: isPremium ? '#fffaf0' : '#f0f5ff',
                        },
                      }}
                    >
                      Demander un devis
                    </Button>
                  </Stack>
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
                    {preview.estimated
                      ? 'Variation mensuelle estimée'
                      : 'Différentiel ajouté à votre prochaine facture'}
                  </Typography>
                  <Typography sx={{ fontWeight: 800, fontSize: 16, color: (preview.prorationAmount ?? 0) >= 0 ? '#0040a1' : '#059669' }}>
                    {preview.prorationAmount != null
                      ? (preview.prorationAmount > 0
                          ? `+ ${formatMoney(preview.prorationAmount, preview.currency)}${preview.estimated ? ' / mois' : ''}`
                          : `− ${formatMoney(Math.abs(preview.prorationAmount), preview.currency)}${preview.estimated ? ' / mois' : ''}`)
                      : '—'}
                  </Typography>
                </Box>
                {!preview.estimated && (
                  <>
                    <Divider />
                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Typography sx={{ fontSize: 13, color: '#64748b' }}>
                        Prochaine facture
                      </Typography>
                      <Typography sx={{ fontSize: 13, color: '#0f172a', fontWeight: 700 }}>
                        {formatMoney(preview.nextInvoiceTotal, preview.currency)} · {formatDate(preview.nextInvoiceAt)}
                      </Typography>
                    </Box>
                  </>
                )}
                {preview.estimated ? (
                  <Typography sx={{ fontSize: 12, color: '#92400e', mt: 0.5, fontStyle: 'italic' }}>
                    {preview.note ?? 'Estimation indicative — le montant proraté exact sera confirmé par Stripe à la validation.'}
                  </Typography>
                ) : (
                  <Typography sx={{ fontSize: 12, color: '#64748b', mt: 0.5 }}>
                    Calcul prorata-temporis basé sur {preview.activeEmployees} salarié(s) actif(s).
                    {(preview.prorationAmount ?? 0) < 0 && ' Le crédit sera déduit automatiquement.'}
                  </Typography>
                )}
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
        <Button onClick={onClose} sx={{ textTransform: 'none', fontWeight: 700 }}>
          Fermer
        </Button>
        {canChangeInPlace && selected && selected !== currentKey && (
          <Button
            variant="contained"
            onClick={handleConfirm}
            startIcon={<RocketLaunchIcon />}
            sx={{
              textTransform: 'none', fontWeight: 700, borderRadius: '12px', px: 3,
              background: isDowngrade ? undefined : 'linear-gradient(135deg, var(--brand-primary) 0%, var(--brand-primary-dark) 100%)',
            }}
            color={isDowngrade ? 'warning' : 'primary'}
          >
            {isDowngrade ? `Rétrograder vers ${selected} via Stripe →` : `Passer au pack ${selected} via Stripe →`}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}
