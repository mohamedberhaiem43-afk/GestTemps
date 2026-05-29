import { useEffect, useState } from 'react';
import {
  Box, Paper, Typography, Button, Chip, Dialog, DialogTitle, DialogContent, DialogActions,
  RadioGroup, FormControlLabel, Radio, TextField, Alert, CircularProgress, Stack, Divider,
  LinearProgress, Switch, Slider,
} from '@mui/material';
import WarningAmberRoundedIcon from '@mui/icons-material/WarningAmberRounded';
import RocketLaunchIcon from '@mui/icons-material/RocketLaunch';
import CancelIcon from '@mui/icons-material/CancelOutlined';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import CreditCardIcon from '@mui/icons-material/CreditCard';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ExtensionIcon from '@mui/icons-material/Extension';
import GroupAddIcon from '@mui/icons-material/GroupAdd';
import { useNavigate } from 'react-router-dom';
import apiInstance from '../API/apiInstance';
import { useAuth, type PlanFeatures } from '../helper/AuthProvider';
import ChangePlanModal from './ChangePlanModal';
import DevisPackDialog from './DevisPackDialog';
import StorageUsageCard from './StorageUsageCard';
import InvoiceReceipt, { type ReceiptSection } from './InvoiceReceipt';
import { MODULE_CATALOG, ADDON_LABELS, type ModuleDef } from './moduleCatalog';

/**
 * Libellés user-friendly des feature flags PlanFeatures (cf. PlanCatalog côté backend).
 * Seules les features "fonctionnelles" (modules métier) apparaissent ici — les flags
 * de sécurité technique transparents pour l'utilisateur (deviceTrustEnforced,
 * screenshotProtection, certificatePinning) sont volontairement omis : ils sont
 * actifs en arrière-plan sur Premium et n'apportent rien à les afficher comme
 * "modules débloqués".
 */
const FEATURE_LABELS: Partial<Record<keyof PlanFeatures, { label: string; icon: string }>> = {
  mobileApp: { label: 'Application mobile', icon: '📱' },
  geolocation: { label: 'Géolocalisation des pointages', icon: '📍' },
  digitalVault: { label: 'Coffre-fort numérique', icon: '🗄️' },
  electronicSignature: { label: 'Signature électronique', icon: '✍️' },
  multiSite: { label: 'Multi-site', icon: '🏢' },
  multiSociete: { label: 'Multi-société', icon: '🏛️' },
  advancedDashboards: { label: 'Tableaux de bord avancés', icon: '📊' },
  ragAi: { label: 'Assistant IA RH', icon: '🤖' },
  advancedAuditLogs: { label: 'Journaux d\'audit avancés', icon: '🔍' },
  customBranding: { label: 'Personnalisation de marque', icon: '🎨' },
  missions: { label: 'Gestion des missions', icon: '🗺️' },
  compensationDays: { label: 'Jours de compensation', icon: '⏳' },
  generalLeave: { label: 'Congés généraux', icon: '🏖️' },
  generalExit: { label: 'Autorisations de sortie générales', icon: '🚪' },
  leaveManagement: { label: 'Workflow congés', icon: '🌴' },
  authorizationManagement: { label: 'Workflow autorisations', icon: '📋' },
  expenseReports: { label: 'Notes de frais', icon: '🧾' },
  breastfeedingManagement: { label: 'Gestion allaitement', icon: '🍼' },
  contractManagement: { label: 'Gestion des contrats', icon: '📄' },
  documentScanOcr: { label: 'Scan OCR pièces d\'identité', icon: '📷' },
  bulkImport: { label: 'Import Excel en masse', icon: '⬆️' },
};

// Catalogue des modules optionnels + map dérivée des addons : source unique partagée
// avec FacturesConcordePage (cf. moduleCatalog.ts).

type PlanKey = 'Starter' | 'Standard' | 'Premium';
type Cycle = 'monthly' | 'annual';

// Définition du pack courant — exposée par /billing/subscription depuis 2026-05
// pour que l'UI affiche les prix / effectif inclus / overage SANS dupliquer la
// grille PlanCatalog côté front (risque de divergence à chaque ajustement
// tarifaire). Tous les montants sont en € HT.
interface PlanInfo {
  code: string;
  displayName: string;
  flatPriceMonthlyEur: number;
  flatPriceAnnualMonthlyEur: number;
  includedEmployees: number;
  includedAdmins: number | null;       // null = illimité (Premium)
  overageRatePerEmployeeEur: number;
  storageQuotaMb: number;
  // 2026-05-27 : plus de plafond commercial sur le stockage (null = illimité).
  // L'admin peut étendre par blocs supplémentaires (storageSupplementBlockEur).
  maxStorageMb: number | null;
  storageSupplementBlockEur: number;
}

interface UsageInfo {
  activeEmployees: number;
  includedEmployees: number | null;
  extraEmployees: number;              // > 0 = overage facturé via Stripe user_supp
  extraCostMonthlyEur: number;
  isOverCapacity: boolean;
}

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
  plan?: PlanInfo | null;              // null si tenant sans PlanCode défini
  usage?: UsageInfo | null;
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

// Formatage monétaire FR aligné sur la maquette (« 249,00 € »). Centralisé ici
// pour la carte « facture en direct » (variante A) et le récap modules (variante C).
const eur = (n: number) => n.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';

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
  // navigate sert encore au redirect post-réactivation (finishSuccess → /dashboard).
  // Le bouton « Ajouter un collaborateur » a basculé sur un dialog inline (cf.
  // addSeatsDialogOpen plus bas) : on ne fait plus de navigate vers la page de
  // création employé puisque la demande utilisateur 2026-05-27 était explicitement
  // de NE PAS rediriger.
  const navigate = useNavigate();
  const { isAdmin, isManager, refreshAuth, userName, isTrialing, trialDaysRemaining, planCode, planFeatures, addons } = useAuth();
  const canManage = isAdmin || isManager;

  // Liste des features TRUE à afficher comme "modules débloqués" dans la carte récap.
  // Filtrée sur FEATURE_LABELS pour exclure les flags techniques non user-facing
  // (deviceTrustEnforced & co.) et garantir un libellé propre pour chacune.
  const activeFeatureKeys = (Object.keys(FEATURE_LABELS) as (keyof PlanFeatures)[])
    .filter((k) => Boolean(planFeatures?.[k]));
  // Addons reconnus du catalogue (filtre défensif contre des valeurs serveur inattendues).
  const subscribedAddons = (addons ?? []).filter((a) => ADDON_LABELS[a] != null);

  // Un module est « inclus dans le pack » si sa feature est active dans planFeatures
  // SANS qu'un addon souscrit en soit la cause — donc fournie par le pack lui-même
  // (ex. Premium inclut ragAi, customBranding…). Ces modules s'affichent « inclus /
  // actif » (interrupteur verrouillé) au lieu d'être proposés à l'achat.
  const moduleIsIncludedByPack = (m: ModuleDef): boolean => {
    if (!m.feature || !planFeatures?.[m.feature]) return false;
    if (m.addonKey && subscribedAddons.includes(m.addonKey)) return false;
    return true;
  };
  // Prénom uniquement pour personnaliser le bandeau trial (« Mohamed, il vous reste… »).
  // userName est « Prénom Nom » concaténé côté serveur (Utiprn + Utinom).
  const firstName = (userName ?? '').trim().split(/\s+/)[0] || null;

  const [info, setInfo] = useState<SubscriptionInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Cycle affiché dans la carte « facture en direct » (variante A). Le cycle réellement
  // souscrit n'est pas exposé par /billing/subscription : ce toggle sert donc à prévisualiser
  // le tarif de base mensuel vs annuel-mensualisé dans le total ESTIMÉ. Les autres lignes
  // (overage, modules) reflètent l'usage réel. Défaut : mensuel (= tarif catalogue de base).
  const [cycleA, setCycleA] = useState<Cycle>('monthly');

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

  // Dialog "Ajouter des collaborateurs" : permet à l'admin de pré-acheter N sièges
  // supplémentaires sans passer par la page de création employé. Chaque siège
  // pré-acheté est facturé via Stripe user_supp au tarif d'overage du pack. Les
  // employés correspondants peuvent être créés plus tard sans nouvelle confirmation.
  // Cf. POST /billing/add-seats côté backend (BillingController.AddSeats).
  const [addSeatsDialogOpen, setAddSeatsDialogOpen] = useState(false);
  const [addSeatsCount, setAddSeatsCount] = useState<number>(1);
  const [addSeatsSubmitting, setAddSeatsSubmitting] = useState(false);
  const [addSeatsError, setAddSeatsError] = useState<string | null>(null);
  const openAddSeatsDialog = () => {
    setAddSeatsCount(1);
    setAddSeatsError(null);
    setAddSeatsDialogOpen(true);
  };
  const submitAddSeats = async () => {
    if (addSeatsCount <= 0) { setAddSeatsError('Le nombre de sièges doit être supérieur à 0.'); return; }
    setAddSeatsSubmitting(true);
    setAddSeatsError(null);
    try {
      const { data } = await apiInstance.post<{
        purchasedExtraSeats: number;
        billedQuantity: number;
        monthlyCostEur: number;
        overageRatePerSeat: number;
      }>('/billing/add-seats', { count: addSeatsCount });
      setAddSeatsDialogOpen(false);
      setSuccessMsg(
        `${addSeatsCount} siège${addSeatsCount > 1 ? 's' : ''} ajouté${addSeatsCount > 1 ? 's' : ''} avec succès. ` +
        `Votre prochaine facture inclura ${data.monthlyCostEur.toFixed(2)} € HT/mois pour les ${data.billedQuantity} collaborateur${data.billedQuantity > 1 ? 's' : ''} supplémentaire${data.billedQuantity > 1 ? 's' : ''}.`
      );
      await fetchInfo({ silent: true });
    } catch (e: any) {
      setAddSeatsError(e?.response?.data?.error || 'Impossible d\'ajouter des sièges. Réessayez plus tard.');
    } finally {
      setAddSeatsSubmitting(false);
    }
  };

  // Dialog "Gérer mes modules optionnels" : ouvert depuis la carte "Vos modules actifs".
  // Le brouillon contient la sélection en cours avant validation — sans toucher au state
  // global tant que l'admin n'a pas confirmé via le bouton "Enregistrer".
  const [addonsDialogOpen, setAddonsDialogOpen] = useState(false);
  const [addonsDraft, setAddonsDraft] = useState<string[]>([]);
  const [addonsSubmitting, setAddonsSubmitting] = useState(false);
  const [addonsError, setAddonsError] = useState<string | null>(null);
  const toggleAddonInDraft = (key: string) => {
    setAddonsDraft((cur) => cur.includes(key) ? cur.filter((k) => k !== key) : [...cur, key]);
  };
  const openAddonsDialog = () => {
    setAddonsDraft(subscribedAddons);
    setAddonsError(null);
    setAddonsDialogOpen(true);
  };
  const saveAddons = async () => {
    setAddonsSubmitting(true);
    setAddonsError(null);
    try {
      // Vérifie si les addons ont changé
      const addonsChanged = addonsDraft.sort().join(',') !== subscribedAddons.sort().join(',');
      
      // Sauvegarde les addons en base de données
      await apiInstance.put('/billing/addons', { addons: addonsDraft });
      
      // refreshAuth → /me recharge planFeatures (avec les flags fusionnés) ET addons,
      // ce qui réactualise la sidebar (via Navigation/planAllows) et la carte de récap.
      await refreshAuth();
      setAddonsDialogOpen(false);
      
      // Message de succès avec détail du changement
      if (addonsChanged) {
        setSuccessMsg(
          'Modules mis à jour. ' +
          (info?.hasActiveStripeSubscription 
            ? 'La facturation sera ajustée à votre prochain cycle de facturation.' 
            : 'Contactez notre équipe commerciale pour activer la facturation.')
        );
      } else {
        setSuccessMsg('Aucun changement.');
      }
    } catch (e: any) {
      setAddonsError(e?.response?.data?.error || 'Impossible de mettre à jour les modules. Réessayez.');
    } finally {
      setAddonsSubmitting(false);
    }
  };
  // Récap chiffré pour le total en pied du dialog. Les addons sont facturés mensuellement
  // côté Stripe ; quand le tenant a un engagement annuel, on affiche aussi le total × 12
  // (cohérent avec la demande utilisateur 2026-05-26 "× 12 sur plan annuel").
  // billingCycle n'est pas exposé en /me — on tombe sur 'monthly' par défaut faute de mieux.
  // Pour ne pas bloquer ce fix sur une refacto plus large, on lit l'info via SubscriptionInfo
  // si elle est étendue plus tard ; pour l'instant on affiche les deux totaux côte à côte.
  const draftMonthlyTotal = addonsDraft.reduce((sum, k) => sum + (ADDON_LABELS[k]?.priceMonthlyEur ?? 0), 0);

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

      {/* ─── Détail du pack et effectif ────────────────────────────────────────
          Carte exposant les conditions tarifaires actuelles du tenant (tarif
          mensuel/annuel, effectif inclus, tarif overage par employé, quota
          stockage) + l'usage temps réel des sièges. Source de vérité :
          /api/billing/subscription { plan, usage } — alignée sur PlanCatalog
          côté backend, donc plus de risque de divergence avec HomePage.tsx
          quand on bouge un prix.

          Permet aussi à l'admin d'AJOUTER un collaborateur depuis cette page
          (CTA en bas). Si l'effectif dépasse le seuil inclus du pack, le
          surplus est automatiquement facturé via l'item Stripe user_supp à
          chaque ajout (cf. EmployesController ligne 785 + EmployeeBillingSync).
      */}
      {/* ─── Carte « facture en direct » (maquette variante A + B intégrée) ────────
          Récap visuel du pack avec jauge de sièges RÉELLE (usage.activeEmployees)
          et total ESTIMÉ recalculé en direct : base (mensuel/annuel selon le toggle)
          + overage réel + modules réellement actifs. La décomposition ligne par ligne
          (variante B) est intégrée dans la carte navy du total. Aucun slider de démo :
          les chiffres reflètent ce qui est réellement facturé. */}
      {info?.plan && info?.usage && (() => {
        const plan = info.plan!;
        const usage = info.usage!;
        const isPremium = `${plan.code ?? ''} ${plan.displayName ?? ''}`.toLowerCase().includes('premium');
        const base = cycleA === 'annual' ? plan.flatPriceAnnualMonthlyEur : plan.flatPriceMonthlyEur;
        const overageCost = usage.extraCostMonthlyEur || usage.extraEmployees * plan.overageRatePerEmployeeEur;
        const scale = Math.max(plan.includedEmployees, usage.activeEmployees, 1);
        const usedPct = (Math.min(usage.activeEmployees, plan.includedEmployees) / scale) * 100;
        const overPct = (Math.max(0, usage.activeEmployees - plan.includedEmployees) / scale) * 100;
        const annualSavePct = plan.flatPriceMonthlyEur > 0
          ? Math.round((1 - plan.flatPriceAnnualMonthlyEur / plan.flatPriceMonthlyEur) * 100)
          : 0;

        // Sections du reçu détaillé (variante B / image 1). Construites depuis les
        // données réelles : abonnement de base, dépassement de sièges, modules souscrits.
        const receiptSections: ReceiptSection[] = [
          {
            title: 'Abonnement de base',
            lines: [{
              label: `Pack ${plan.displayName}`,
              sublabel: `${plan.includedEmployees} collaborateurs inclus`,
              amountEur: base,
              kind: 'base',
            }],
          },
        ];
        if (usage.extraEmployees > 0) {
          receiptSections.push({
            title: 'Collaborateurs supplémentaires',
            tag: { label: 'DÉPASSEMENT', kind: 'over' },
            lines: [{
              label: `Sièges au-delà de ${plan.includedEmployees}`,
              sublabel: `${eur(plan.overageRatePerEmployeeEur)} HT / mois par collaborateur`,
              qty: `${usage.activeEmployees} actifs → ${usage.extraEmployees} supp.`,
              amountEur: overageCost,
              kind: 'over',
            }],
          });
        }
        if (subscribedAddons.length > 0) {
          receiptSections.push({
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
        const receiptCycleLabel = `Pack ${plan.displayName} · ${cycleA === 'annual' ? 'Engagement annuel' : 'Engagement mensuel'}`;

        return (
          <Paper elevation={0} sx={{
            borderRadius: '18px', border: '1px solid #E4EAF3', mb: 3, overflow: 'hidden',
            boxShadow: '0 1px 2px rgba(20,52,107,.06), 0 12px 32px -16px rgba(20,52,107,.28)',
          }}>
            <Box sx={{ p: { xs: 2.5, md: 3.5 } }}>
              {/* En-tête : identité du pack + toggle cycle */}
              <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ sm: 'flex-start' }} spacing={2}>
                <Stack direction="row" spacing={1.75}>
                  <Box sx={{
                    width: 48, height: 48, borderRadius: '14px', flex: 'none',
                    background: 'linear-gradient(135deg,#22489a,#14346B)',
                    display: 'grid', placeItems: 'center', boxShadow: '0 8px 18px -8px rgba(20,52,107,.6)',
                  }}>
                    <RocketLaunchIcon sx={{ color: '#fff', fontSize: 24 }} />
                  </Box>
                  <Box>
                    <Typography sx={{ fontSize: 11, fontWeight: 700, letterSpacing: '.14em', textTransform: 'uppercase', color: '#6A7691' }}>
                      Votre formule en détail
                    </Typography>
                    <Stack direction="row" alignItems="center" spacing={1.25} sx={{ mt: 0.4 }}>
                      <Typography sx={{ fontSize: 24, fontWeight: 800, letterSpacing: '-.01em', color: '#0F1B33' }}>
                        Pack {plan.displayName}
                      </Typography>
                      {isPremium && (
                        <Box component="span" sx={{
                          fontSize: 10.5, fontWeight: 800, letterSpacing: '.06em', color: '#7a5a16',
                          background: 'linear-gradient(180deg,#fbe7b3,#f3d488)', border: '1px solid #e7c97e',
                          px: 1.1, py: '3px', borderRadius: '999px', textTransform: 'uppercase',
                        }}>
                          Haut de gamme
                        </Box>
                      )}
                    </Stack>
                    <Typography sx={{ fontSize: 13, color: '#6A7691', mt: 0.5 }}>
                      {usage.activeEmployees} collaborateur{usage.activeEmployees > 1 ? 's' : ''} actif{usage.activeEmployees > 1 ? 's' : ''}
                      {info.currentPeriodEndsAt ? ` · prochaine échéance le ${formatDate(info.currentPeriodEndsAt)}` : ''}
                    </Typography>
                  </Box>
                </Stack>

                {/* Toggle cycle (prévisualisation tarif de base) */}
                <Box sx={{
                  display: 'inline-flex', alignItems: 'center', flex: 'none',
                  background: '#EEF3FB', border: '1px solid #DCE6F6', borderRadius: '999px', p: '4px',
                }}>
                  {(['monthly', 'annual'] as Cycle[]).map((cy) => {
                    const active = cycleA === cy;
                    return (
                      <Box
                        key={cy}
                        component="button"
                        type="button"
                        onClick={() => setCycleA(cy)}
                        sx={{
                          font: 'inherit', fontSize: 13, fontWeight: 700, border: 0, cursor: 'pointer',
                          px: 1.9, py: 0.9, borderRadius: '999px', display: 'flex', alignItems: 'center', gap: 0.9,
                          transition: '.2s',
                          background: active ? '#14346B' : 'transparent',
                          color: active ? '#fff' : '#6A7691',
                          boxShadow: active ? '0 4px 12px -4px rgba(20,52,107,.5)' : 'none',
                        }}
                      >
                        {cy === 'monthly' ? 'Mensuel' : 'Annuel'}
                        {cy === 'annual' && annualSavePct > 0 && (
                          <Box component="span" sx={{
                            fontSize: 10, fontWeight: 800, color: '#fff', px: 0.75, py: '2px', borderRadius: '6px',
                            bgcolor: active ? 'rgba(255,255,255,.22)' : '#16A34A',
                          }}>
                            −{annualSavePct}%
                          </Box>
                        )}
                      </Box>
                    );
                  })}
                </Box>
              </Stack>

              {/* Jauge de sièges (données réelles) + reçu détaillé « Détail de votre facture » (image 1) */}
              <Box sx={{ mt: 3 }}>
                {/* Bloc jauge de sièges — données RÉELLES */}
                <Box sx={{ border: '1px solid #E4EAF3', borderRadius: '14px', p: 2.25 }}>
                  <Stack direction="row" justifyContent="space-between" alignItems="center">
                    <Typography sx={{ fontSize: 12, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: '#6A7691' }}>
                      Sièges occupés
                    </Typography>
                    <Typography sx={{ fontSize: 22, fontWeight: 800, color: '#0F1B33', fontVariantNumeric: 'tabular-nums' }}>
                      {usage.activeEmployees}
                      <Typography component="span" sx={{ fontSize: 14, color: '#6A7691', fontWeight: 600 }}> / {plan.includedEmployees} inclus</Typography>
                    </Typography>
                  </Stack>
                  <Box sx={{
                    height: 14, borderRadius: '8px', background: '#EEF3FB', mt: 1.75, mb: 0.75,
                    display: 'flex', overflow: 'hidden', border: '1px solid #DCE6F6',
                  }}>
                    <Box sx={{ width: `${usedPct}%`, background: 'linear-gradient(90deg,#22489a,#14346B)', transition: '.35s' }} />
                    <Box sx={{ width: `${overPct}%`, background: 'repeating-linear-gradient(45deg,#E8870B,#E8870B 6px,#f5a23d 6px,#f5a23d 12px)', transition: '.35s' }} />
                  </Box>
                  <Stack direction="row" justifyContent="space-between">
                    <Typography sx={{ fontSize: 12.5, color: '#6A7691' }}>0</Typography>
                    <Typography sx={{ fontSize: 12.5, color: '#6A7691' }}>{plan.includedEmployees} inclus</Typography>
                  </Stack>
                  {usage.isOverCapacity && (
                    <Stack direction="row" alignItems="center" spacing={1.1} sx={{
                      mt: 1.6, background: '#FCEFD9', border: '1px solid #f3d6a3', color: '#8a5208',
                      borderRadius: '10px', px: 1.5, py: 1.25, fontSize: 13, fontWeight: 600,
                    }}>
                      <WarningAmberRoundedIcon sx={{ fontSize: 18, color: '#8a5208' }} />
                      <Box component="span">
                        <Box component="b" sx={{ color: '#7a4708' }}>{usage.extraEmployees} collaborateur{usage.extraEmployees > 1 ? 's' : ''}</Box>
                        {' '}au-delà du seuil · facturé{usage.extraEmployees > 1 ? 's' : ''} {eur(plan.overageRatePerEmployeeEur)} HT / mois chacun
                      </Box>
                    </Stack>
                  )}
                  <Typography sx={{ fontSize: 11.5, color: '#94a3b8', mt: 1.5 }}>
                    {usage.isOverCapacity
                      ? 'Facturation Stripe déjà synchronisée — aucune action requise.'
                      : 'Vous pouvez pré-acheter des sièges supplémentaires ci-dessous.'}
                  </Typography>
                </Box>

                {/* Reçu détaillé « Détail de votre facture » (image 1) — remplace l'ancien total navy */}
                <Box sx={{ mt: 2.5 }}>
                  <InvoiceReceipt sections={receiptSections} cycleLabel={receiptCycleLabel} />
                </Box>
              </Box>

              {/* Actions — handlers Stripe inchangés */}
              {canManage && (
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ mt: 2.75, flexWrap: 'wrap' }}>
                  <Button
                    variant="contained"
                    onClick={openAddSeatsDialog}
                    startIcon={<GroupAddIcon />}
                    disabled={!info?.hasActiveStripeSubscription}
                    sx={{
                      textTransform: 'none', fontWeight: 700, borderRadius: '12px', px: 2.5,
                      bgcolor: '#14346B', boxShadow: '0 8px 18px -8px rgba(20,52,107,.6)', '&:hover': { bgcolor: '#0f2c5c' },
                    }}
                  >
                    Ajouter un collaborateur
                  </Button>
                  <Button
                    variant="contained"
                    onClick={openAddonsDialog}
                    startIcon={<ExtensionIcon />}
                    sx={{
                      textTransform: 'none', fontWeight: 700, borderRadius: '12px', px: 2.5,
                      background: 'linear-gradient(135deg,#8b46f0,#6d28d9)', boxShadow: '0 8px 18px -8px rgba(124,58,237,.6)',
                      '&:hover': { background: 'linear-gradient(135deg,#7d3ae0,#5f23c2)' },
                    }}
                  >
                    Gérer mes modules
                  </Button>
                  <Button
                    variant="outlined"
                    onClick={() => setChangePlanOpen(true)}
                    sx={{
                      textTransform: 'none', fontWeight: 700, borderRadius: '12px', px: 2.5,
                      color: '#14346B', borderColor: '#E4EAF3', '&:hover': { borderColor: '#14346B' },
                    }}
                  >
                    Changer de pack →
                  </Button>
                </Stack>
              )}
              {canManage && !info?.hasActiveStripeSubscription && (
                <Typography sx={{ fontSize: 12, color: '#94a3b8', fontStyle: 'italic', mt: 1 }}>
                  L'ajout de sièges nécessite un abonnement Stripe actif. Activez d'abord votre formule.
                </Typography>
              )}
              {!canManage && (
                <Typography sx={{ fontSize: 12, color: '#94a3b8', fontStyle: 'italic', mt: 2 }}>
                  Contactez un administrateur pour ajouter un collaborateur ou gérer les modules.
                </Typography>
              )}
            </Box>
          </Paper>
        );
      })()}

      {/* ─── Modules actifs ────────────────────────────────────────────────────
          Récapitulatif des fonctionnalités débloquées par le pack ET par les
          addons souscrits au signup (cf. Tenant.Addons CSV). Source de vérité :
          /me → planFeatures (flags fusionnés via GetEffectiveFeatures) + addons
          (liste brute des modules souscrits en plus du pack). Les deux sont
          affichés distinctement pour que l'admin voie ce qui vient du pack vs
          ce qui a été activé en plus à la souscription.
      */}
      {planFeatures && (
        <Paper elevation={0} sx={{ p: { xs: 3, md: 4 }, borderRadius: '20px', border: '1px solid #e2e8f0', mb: 3 }}>
          <Stack direction="row" alignItems="center" spacing={2} sx={{ mb: 3 }}>
            <Box sx={{
              width: 48, height: 48, borderRadius: '12px', bgcolor: '#eef2f8',
              color: '#0040a1', display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <CheckCircleIcon />
            </Box>
            <Box>
              <Typography sx={{ fontSize: 12, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Vos modules actifs
              </Typography>
              <Typography sx={{ fontSize: 16, fontWeight: 800, color: '#0f172a' }}>
                {activeFeatureKeys.length} fonctionnalité{activeFeatureKeys.length > 1 ? 's' : ''} débloquée{activeFeatureKeys.length > 1 ? 's' : ''}
                {subscribedAddons.length > 0 && (
                  <Typography component="span" sx={{ fontSize: 13, fontWeight: 600, color: '#7c3aed', ml: 1 }}>
                    · {subscribedAddons.length} module{subscribedAddons.length > 1 ? 's' : ''} additionnel{subscribedAddons.length > 1 ? 's' : ''}
                  </Typography>
                )}
              </Typography>
            </Box>
          </Stack>

          {/* Bloc "Inclus dans votre pack" — affiche toutes les features actives, qu'elles
              viennent du pack ou d'un addon (les flags sont déjà mergés côté backend via
              GetEffectiveFeatures). C'est la vue "ce à quoi j'ai accès aujourd'hui". */}
          <Box sx={{ mb: subscribedAddons.length > 0 ? 3 : 0 }}>
            <Typography sx={{ fontSize: 13, fontWeight: 700, color: '#475569', mb: 1.5 }}>
              Inclus dans votre pack{planCode ? ` ${planCode}` : ''}
            </Typography>
            {activeFeatureKeys.length === 0 ? (
              <Typography sx={{ fontSize: 13, color: '#94a3b8' }}>
                Aucun module n'est encore activé. Choisissez un pack pour débloquer les fonctionnalités.
              </Typography>
            ) : (
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                {activeFeatureKeys.map((k) => {
                  const meta = FEATURE_LABELS[k];
                  // Skip rendering if no label is defined (safety fallback)
                  if (!meta) {
                    console.warn(`Missing label for feature: ${k}`);
                    return null;
                  }
                  return (
                    <Chip
                      key={k}
                      label={`${meta.icon} ${meta.label}`}
                      sx={{
                        bgcolor: '#eff6ff', color: '#1e40af', fontWeight: 600,
                        borderRadius: '10px', border: '1px solid #bfdbfe',
                        '& .MuiChip-label': { px: 1.5 },
                      }}
                    />
                  );
                })}
              </Box>
            )}
          </Box>

          {/* Bloc "Modules additionnels" — affiché uniquement si le tenant a souscrit
              des addons en plus du pack (cf. Tenant.Addons CSV). Distinction visuelle
              en violet pour ne pas confondre avec les modules natifs du pack. */}
          {subscribedAddons.length > 0 && (
            <Box>
              <Divider sx={{ mb: 2.5 }} />
              <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1.5 }}>
                <ExtensionIcon sx={{ fontSize: 18, color: '#7c3aed' }} />
                <Typography sx={{ fontSize: 13, fontWeight: 700, color: '#7c3aed' }}>
                  Modules additionnels souscrits à l'inscription
                </Typography>
              </Stack>
              <Stack spacing={1.5}>
                {subscribedAddons.map((a) => {
                  const meta = ADDON_LABELS[a];
                  return (
                    <Box
                      key={a}
                      sx={{
                        p: 1.75, bgcolor: '#faf5ff', borderRadius: '12px',
                        border: '1px solid #e9d5ff',
                      }}
                    >
                      <Typography sx={{ fontWeight: 700, color: '#6d28d9', fontSize: 14 }}>
                        {meta.label}
                      </Typography>
                      <Typography sx={{ fontSize: 12.5, color: '#7c3aed', mt: 0.25, lineHeight: 1.45 }}>
                        {meta.description}
                      </Typography>
                    </Box>
                  );
                })}
              </Stack>
            </Box>
          )}

          {canManage && (
            <Box sx={{ mt: 3, pt: 2, borderTop: '1px dashed #e2e8f0', display: 'flex', flexWrap: 'wrap', gap: 2, alignItems: 'center' }}>
              <Button
                variant="contained"
                onClick={openAddonsDialog}
                startIcon={<ExtensionIcon />}
                sx={{ textTransform: 'none', fontWeight: 700, borderRadius: '10px', bgcolor: '#7c3aed', '&:hover': { bgcolor: '#6d28d9' } }}
              >
                Gérer mes modules optionnels
              </Button>
              <Button
                variant="text"
                onClick={() => setChangePlanOpen(true)}
                sx={{ textTransform: 'none', fontWeight: 700, color: '#0040a1' }}
              >
                Changer de pack →
              </Button>
            </Box>
          )}
        </Paper>
      )}

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

      {/* ─── Dialog "Gérer mes modules optionnels" ───────────────────────────
          Permet à l'admin de cocher/décocher les addons disponibles. Au save :
          PUT /billing/addons → backend met à jour Tenant.Addons → refreshAuth
          recharge planFeatures (fusion pack+addons via GetEffectiveFeatures).
          La sidebar reflète immédiatement les nouveaux accès (Navigation utilise
          planAllows qui lit le contexte useAuth fraîchement rafraîchi).
          ⚠ Pas de sync Stripe pour l'instant — cf. BillingController.UpdateAddons.
      */}
      <Dialog
        open={addonsDialogOpen}
        onClose={() => !addonsSubmitting && setAddonsDialogOpen(false)}
        maxWidth="sm"
        fullWidth
        PaperProps={{ sx: { borderRadius: '16px' } }}
      >
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1.5, pb: 1 }}>
          <ExtensionIcon sx={{ color: '#7c3aed' }} />
          <Typography component="span" sx={{ fontSize: 18, fontWeight: 800 }}>
            Gérer mes modules optionnels
          </Typography>
        </DialogTitle>
        <DialogContent dividers sx={{ p: 0 }}>
          {addonsError && (
            <Alert severity="error" sx={{ m: 2, borderRadius: '10px' }} onClose={() => setAddonsError(null)}>
              {addonsError}
            </Alert>
          )}
          <Typography sx={{ px: 3, pt: 2, pb: 1, fontSize: 13, color: '#64748b' }}>
            Cochez les modules que vous souhaitez activer. Les fonctionnalités correspondantes
            apparaissent immédiatement dans la sidebar après validation. La facturation Stripe
            n'est pas modifiée tant qu'un SKU dédié n'est pas configuré — vous activez d'abord
            l'accès, votre commercial peut ensuite ajuster votre facture si besoin.
          </Typography>
          <Stack divider={<Divider />}>
            {MODULE_CATALOG.map((m) => {
              // Inclus par le pack → coché + verrouillé (pas re-facturé). Sinon
              // activable seulement si c'est un addon backend valide (addonKey).
              const included = moduleIsIncludedByPack(m);
              const toggleable = !!m.addonKey && !included;
              const checked = included || (m.addonKey ? addonsDraft.includes(m.addonKey) : false);
              return (
                <Stack
                  key={m.label}
                  direction="row"
                  alignItems="center"
                  spacing={2}
                  sx={{
                    px: 3, py: 2,
                    bgcolor: checked ? '#F3EEFE' : 'transparent',
                    opacity: (!toggleable && !included) ? 0.75 : 1,
                    transition: 'background-color 0.15s',
                  }}
                >
                  {/* Interrupteur (variante C). Verrouillé si inclus dans le pack ou
                      si le module n'est pas un addon activable (stockage / domaine). */}
                  <Switch
                    checked={checked}
                    disabled={!toggleable}
                    onChange={() => { if (m.addonKey) toggleAddonInDraft(m.addonKey); }}
                    sx={{
                      '& .MuiSwitch-switchBase.Mui-checked': { color: '#7C3AED' },
                      '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': { backgroundColor: '#7C3AED', opacity: 1 },
                    }}
                  />
                  <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                    <Stack direction="row" alignItems="center" spacing={1} sx={{ flexWrap: 'wrap' }}>
                      <Typography sx={{ fontWeight: 700, color: '#0F1B33', fontSize: 14 }}>
                        {m.label}
                      </Typography>
                      {included && (
                        <Chip
                          size="small"
                          label="Inclus dans le pack"
                          sx={{ height: 18, fontSize: 10.5, fontWeight: 700, bgcolor: '#E7F6ED', color: '#15803d' }}
                        />
                      )}
                    </Stack>
                    <Typography sx={{ fontSize: 12, color: '#6A7691', lineHeight: 1.45, mt: 0.25 }}>
                      {m.description}{m.note ? ` · ${m.note}` : ''}
                    </Typography>
                  </Box>
                  {/* Prix MENSUEL uniquement. Barré si inclus (déjà couvert par le pack). */}
                  <Box sx={{ textAlign: 'right', flexShrink: 0 }}>
                    <Typography sx={{
                      fontWeight: 800, fontSize: 15,
                      color: included ? '#15803d' : '#7C3AED',
                      textDecoration: included ? 'line-through' : 'none',
                    }}>
                      +{m.priceMonthlyEur}€
                      <Typography component="span" sx={{ fontSize: 11, color: '#94a3b8', fontWeight: 500 }}>
                        {' '}/mois
                      </Typography>
                    </Typography>
                  </Box>
                </Stack>
              );
            })}
          </Stack>
          {/* Impact en direct (variante C) — mensuel uniquement */}
          <Box sx={{ px: 3, py: 2, bgcolor: '#EEF3FB', borderTop: '1px solid #DCE6F6' }}>
            <Stack direction="row" justifyContent="space-between" alignItems="center">
              <Typography sx={{ fontSize: 13, color: '#6A7691' }}>
                Impact sur votre facture
              </Typography>
              <Box sx={{ textAlign: 'right' }}>
                <Typography sx={{ fontWeight: 800, color: '#14346B', fontSize: 19, fontVariantNumeric: 'tabular-nums' }}>
                  {draftMonthlyTotal > 0 ? '+' : ''}{eur(draftMonthlyTotal)} HT /mois
                </Typography>
                <Typography sx={{ fontSize: 11.5, color: '#7C3AED', fontWeight: 700 }}>
                  {addonsDraft.length} module{addonsDraft.length > 1 ? 's' : ''} actif{addonsDraft.length > 1 ? 's' : ''}
                </Typography>
              </Box>
            </Stack>
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button
            onClick={() => setAddonsDialogOpen(false)}
            disabled={addonsSubmitting}
            sx={{ textTransform: 'none', fontWeight: 700 }}
          >
            Annuler
          </Button>
          <Button
            variant="contained"
            onClick={saveAddons}
            disabled={addonsSubmitting}
            sx={{
              textTransform: 'none', fontWeight: 700, borderRadius: '10px',
              bgcolor: '#7c3aed', '&:hover': { bgcolor: '#6d28d9' },
            }}
          >
            {addonsSubmitting ? <CircularProgress size={20} sx={{ color: '#fff' }} /> : 'Enregistrer'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ─── Dialog "Ajouter des collaborateurs" ────────────────────────────────
          Pré-achat de N sièges supplémentaires depuis la page abonnement (sans
          passer par /dashboard/profil-employe). À la confirmation : appel
          POST /billing/add-seats qui pousse user_supp dans Stripe + stocke le
          floor dans la metadata `extra_seats_purchased`. La sync quotidienne
          (EmployeeBillingSyncService) respecte ce floor donc les sièges payés
          d'avance ne sont jamais déduits.
      */}
      <Dialog
        open={addSeatsDialogOpen}
        onClose={() => !addSeatsSubmitting && setAddSeatsDialogOpen(false)}
        maxWidth="xs"
        fullWidth
        PaperProps={{ sx: { borderRadius: '16px' } }}
      >
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1.5, pb: 1, fontWeight: 800 }}>
          <GroupAddIcon sx={{ color: '#0040a1' }} />
          Ajouter des collaborateurs
        </DialogTitle>
        <DialogContent dividers>
          {addSeatsError && (
            <Alert severity="error" sx={{ mb: 2, borderRadius: '10px' }} onClose={() => setAddSeatsError(null)}>
              {addSeatsError}
            </Alert>
          )}
          <Typography sx={{ fontSize: 13, color: '#475569', mb: 2.5, lineHeight: 1.55 }}>
            Augmentez immédiatement votre quota de collaborateurs autorisés. Chaque
            siège supplémentaire est facturé à votre prochaine échéance Stripe au
            tarif d'overage de votre pack. Les collaborateurs correspondants pourront
            être créés ultérieurement sans confirmation supplémentaire.
          </Typography>

          {info?.plan && (
            <Box sx={{ p: 2, mb: 2.5, bgcolor: '#f8fafc', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
              <Typography sx={{ fontSize: 11, color: '#64748b', fontWeight: 700, textTransform: 'uppercase', mb: 0.5 }}>
                Tarif overage Pack {info.plan.displayName}
              </Typography>
              <Typography sx={{ fontSize: 16, fontWeight: 800, color: '#0040a1' }}>
                {info.plan.overageRatePerEmployeeEur.toFixed(2)} € HT
                <Typography component="span" sx={{ fontSize: 12, color: '#64748b', fontWeight: 600, ml: 0.5 }}>
                  / mois / collaborateur
                </Typography>
              </Typography>
            </Box>
          )}

          {/* Curseur roulant pour le nombre de sièges (design image 3). Plage 1–50 ;
              au-delà, relancer l'opération (le backend accepte jusqu'à 500). */}
          <Box sx={{ my: 1.5 }}>
            <Box sx={{ textAlign: 'center', py: 1.25, bgcolor: '#eff6ff', borderRadius: '12px', border: '1px solid #bfdbfe', mb: 2 }}>
              <Typography sx={{ fontSize: 11, color: '#1e40af', fontWeight: 700, textTransform: 'uppercase' }}>
                Sièges à ajouter
              </Typography>
              <Typography sx={{ fontSize: 32, fontWeight: 800, color: '#0040a1', lineHeight: 1 }}>
                +{addSeatsCount}
              </Typography>
            </Box>
            <Box sx={{ px: 1.5 }}>
              <Slider
                value={addSeatsCount}
                min={1}
                max={50}
                step={1}
                disabled={addSeatsSubmitting}
                valueLabelDisplay="auto"
                marks={[{ value: 1, label: '1' }, { value: 25, label: '25' }, { value: 50, label: '50' }]}
                onChange={(_, v) => setAddSeatsCount(Array.isArray(v) ? v[0] : v)}
                sx={{
                  color: '#0040a1',
                  '& .MuiSlider-thumb': { width: 22, height: 22, boxShadow: '0 2px 8px rgba(0,64,161,.4)' },
                  '& .MuiSlider-rail': { opacity: 0.3 },
                }}
              />
            </Box>
          </Box>

          {/* Récap chiffré du coût mensuel additionnel pour les sièges ajoutés */}
          {info?.plan && (
            <Box sx={{ mt: 2, p: 2, bgcolor: '#fffbeb', borderRadius: '12px', border: '1px solid #fde68a' }}>
              <Stack direction="row" justifyContent="space-between" alignItems="center">
                <Typography sx={{ fontSize: 13, color: '#92400e', fontWeight: 700 }}>
                  Surcoût mensuel estimé
                </Typography>
                <Typography sx={{ fontSize: 20, fontWeight: 800, color: '#b45309' }}>
                  +{(addSeatsCount * info.plan.overageRatePerEmployeeEur).toFixed(2)} € HT
                </Typography>
              </Stack>
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button
            onClick={() => setAddSeatsDialogOpen(false)}
            disabled={addSeatsSubmitting}
            sx={{ textTransform: 'none', fontWeight: 700 }}
          >
            Annuler
          </Button>
          <Button
            variant="contained"
            onClick={submitAddSeats}
            disabled={addSeatsSubmitting || addSeatsCount < 1}
            startIcon={addSeatsSubmitting ? <CircularProgress size={16} color="inherit" /> : <GroupAddIcon />}
            sx={{
              textTransform: 'none', fontWeight: 700, borderRadius: '10px',
              bgcolor: '#0040a1', '&:hover': { bgcolor: '#003080' },
            }}
          >
            {addSeatsSubmitting ? 'Validation…' : `Confirmer +${addSeatsCount} siège${addSeatsCount > 1 ? 's' : ''}`}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
