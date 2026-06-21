import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  Box, Paper, Typography, Button, Chip, Dialog, DialogTitle, DialogContent, DialogActions,
  RadioGroup, FormControlLabel, Radio, TextField, Alert, CircularProgress, Stack, Divider,
  LinearProgress, Slider,
} from '@mui/material';
import WarningAmberRoundedIcon from '@mui/icons-material/WarningAmberRounded';
import RocketLaunchIcon from '@mui/icons-material/RocketLaunch';
import CancelIcon from '@mui/icons-material/CancelOutlined';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import CreditCardIcon from '@mui/icons-material/CreditCard';
import GroupAddIcon from '@mui/icons-material/GroupAdd';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import apiInstance from '../API/apiInstance';
import { useAuth, type PlanFeatures } from '../helper/AuthProvider';
import ChangePlanModal from './ChangePlanModal';
import DevisPackDialog from './DevisPackDialog';
import StorageUsageCard from './StorageUsageCard';
import InvoiceReceipt, { type ReceiptSection } from './InvoiceReceipt';
import { getAddonLabels } from './moduleCatalog';

/**
 * Libellés user-friendly des feature flags PlanFeatures (cf. PlanCatalog côté backend).
 * Seules les features "fonctionnelles" (modules métier) apparaissent ici — les flags
 * de sécurité technique transparents pour l'utilisateur (deviceTrustEnforced,
 * screenshotProtection, certificatePinning) sont volontairement omis : ils sont
 * actifs en arrière-plan sur Premium et n'apportent rien à les afficher comme
 * "modules débloqués".
 */
// Icônes des feature flags (langue-agnostiques). Les libellés correspondants sont
// dans le dict bilingue (d.featureLabels[key]). L'ensemble des clés de cette map
// définit aussi les features rendues comme « modules débloqués » (cf. activeFeatureKeys).
const FEATURE_ICONS: Partial<Record<keyof PlanFeatures, string>> = {
  mobileApp: '📱',
  geolocation: '📍',
  digitalVault: '🗄️',
  electronicSignature: '✍️',
  multiSite: '🏢',
  multiSociete: '🏛️',
  advancedDashboards: '📊',
  ragAi: '🤖',
  advancedAuditLogs: '🔍',
  customBranding: '🎨',
  missions: '🗺️',
  compensationDays: '⏳',
  generalLeave: '🏖️',
  generalExit: '🚪',
  leaveManagement: '🌴',
  authorizationManagement: '📋',
  expenseReports: '🧾',
  breastfeedingManagement: '🍼',
  contractManagement: '📄',
  documentScanOcr: '📷',
  bulkImport: '⬆️',
};
type FeatureKey = keyof typeof FEATURE_ICONS;

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
  billingCycle?: 'monthly' | 'annual' | null;  // cycle réel dérivé de la subscription Stripe
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

const brandLabel = (brand: string | undefined, fallback: string) => {
  switch ((brand ?? '').toLowerCase()) {
    case 'visa': return 'Visa';
    case 'mastercard': return 'Mastercard';
    case 'amex': return 'American Express';
    case 'cb': return 'CB';
    case 'discover': return 'Discover';
    default: return brand ?? fallback;
  }
};

const formatDate = (d: string | null, locale: string) => {
  if (!d) return '—';
  try { return new Date(d).toLocaleDateString(locale, { day: '2-digit', month: 'long', year: 'numeric' }); }
  catch { return d; }
};

// Formatage monétaire FR aligné sur la maquette (« 249,00 € »). Centralisé ici
// pour la carte « facture en direct » (variante A) et le récap modules (variante C).
const eur = (n: number, locale: string) => n.toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';

type StatusColor = 'success' | 'warning' | 'error' | 'info' | 'default';
const statusLabel = (s: string, d: Dict): { label: string; color: StatusColor } => {
  switch (s) {
    case 'Active': return { label: d.statusActive, color: 'success' };
    case 'Trialing': return { label: d.statusTrialing, color: 'info' };
    case 'PastDue': return { label: d.statusPastDue, color: 'warning' };
    case 'PendingPayment': return { label: d.statusPendingPayment, color: 'warning' };
    case 'Suspended': return { label: d.statusSuspended, color: 'error' };
    case 'Cancelled': return { label: d.statusCancelled, color: 'error' };
    default: return { label: s, color: 'default' };
  }
};

// Durée canonique de l'essai gratuit côté backend (TrialPolicy.TrialDurationDays).
// Sert à calculer le pourcentage de progression du bandeau trial.
const TRIAL_DURATION_DAYS = 30;

// ── i18n : dictionnaire bilingue FR / EN (même pattern que ServicesPage / HomePage) ──
type Lang = 'fr' | 'en';

interface Dict {
  locale: string;
  // En-tête de page
  pageTitle: string;
  pageSubtitle: string;
  // Statuts
  statusActive: string;
  statusTrialing: string;
  statusPastDue: string;
  statusPendingPayment: string;
  statusSuspended: string;
  statusCancelled: string;
  // Libellés des features (modules débloqués)
  featureLabels: Partial<Record<FeatureKey, string>>;
  // Carte de paiement
  cardFallback: string;
  // Messages
  addonsUpdatedBase: string;
  addonsUpdatedStripe: string;
  addonsUpdatedContact: string;
  addonsNoChange: string;
  addonsUpdateError: string;
  loadSubscriptionError: string;
  portalOpenFailGeneric: string;
  portalOpenFailError: string;
  paymentCancelled: string;
  reactivationConfirmed: string;
  noPreviousPlan: string;
  checkoutInitError: string;
  reactivateError: string;
  resumeSuccess: string;
  resumeError: string;
  cancelError: string;
  noSeatLink: string;
  // Cancel result messages (interpolated)
  refundLine: (amount: string, currency: string) => string;
  cancelImmediate: (refundLine: string) => string;
  cancelScheduled: (date: string) => string;
  planChanged: (plan: string) => string;
  // Polling overlay
  pollingTitle: string;
  pollingBody: string;
  pollingTimeoutTitle: string;
  pollingTimeoutBody: string;
  // Bandeau trial
  trialRemaining: (firstName: string | null, days: number) => ReactNode;
  trialEnjoy: (days: number) => string;
  seePricing: string;
  // Carte formule actuelle
  currentPlan: string;
  noPlan: string;
  currentPeriodEnd: string;
  trialEnd: string;
  cancellationRequestedOn: string;
  // Carte « facture en direct »
  highEnd: string;
  yourPlanDetail: string;
  packPrefix: string;
  activeEmployees: (n: number) => string;
  nextDueOn: (date: string) => string;
  cycleMonthly: string;
  cycleAnnual: string;
  seatsOccupied: string;
  includedSuffix: (n: number) => string;
  includedMark: (n: number) => string;
  overSeatsWarning: (n: number, rate: string) => ReactNode;
  overageSynced: string;
  prebuySeatsHint: string;
  // Reçu (InvoiceReceipt sections)
  receiptBaseTitle: string;
  receiptPackLine: (name: string) => string;
  receiptIncludedSub: (n: number) => string;
  receiptExtraTitle: string;
  receiptOverTag: string;
  receiptSeatsBeyond: (n: number) => string;
  receiptOverageRate: (rate: string) => string;
  receiptOverageQty: (active: number, extra: number) => string;
  receiptModulesTitle: string;
  receiptModulesTag: (n: number) => string;
  receiptCycleLabel: (name: string, annual: boolean) => string;
  // Actions carte facture
  addEmployee: string;
  manageModules: string;
  changePlan: string;
  seatsNeedStripe: string;
  contactAdminModules: string;
  // Carte modules actifs
  yourActiveModules: string;
  featuresUnlocked: (n: number) => string;
  additionalModulesInline: (n: number) => string;
  includedInPack: (plan: string | null) => string;
  noModuleYet: string;
  additionalModulesSubscribed: string;
  manageOptionalModules: string;
  // Carte de paiement
  paymentCard: string;
  cardExpires: (mm: string, yyyy: number) => string;
  loadingDots: string;
  noCardSaved: string;
  redirecting: string;
  updateBtn: string;
  // Bandeaux résiliation
  scheduledCancelTitle: string;
  scheduledCancelBody: (date: string) => ReactNode;
  cancelledTitle: string;
  cancelledBody: ReactNode;
  // Carte Actions
  actions: string;
  seeOtherPacks: string;
  reactivateMyPlan: string;
  cancelTheCancellation: string;
  cancelMyPlan: string;
  onlyAdminsCanModify: (cancelled: boolean) => string;
  // Dialog résiliation
  cancelDialogIntro: string;
  cancelAtPeriodEndTitle: string;
  cancelAtPeriodEndBody: (date: string) => ReactNode;
  cancelImmediateTitle: string;
  cancelImmediateBody: string;
  cancelReasonLabel: string;
  cancelReasonPlaceholder: string;
  cancel: string;
  confirmCancelNow: string;
  scheduleCancel: string;
  // ChangePlanModal
  // Dialog gérer modules
  optionalModulesIntro: string;
  includedInPackChip: string;
  onQuote: string;
  perMonth: string;
  addViaStripe: string;
  invoiceImpact: string;
  perMonthHt: string;
  close: string;
  modulesActiveCount: (n: number) => string;
  save: string;
  // Dialog ajouter sièges
  addSeatsTitle: string;
  addSeatsIntro: string;
  overageRateForPack: (name: string) => string;
  perMonthPerEmployee: string;
  seatsToAdd: string;
  estimatedMonthlyExtra: string;
  addSeatsFootnote: string;
  continueOnStripe: string;
}

const FR: Dict = {
  locale: 'fr-FR',
  pageTitle: 'Mon abonnement',
  pageSubtitle: 'Gérez votre formule, suivez vos prochaines échéances et résiliez à tout moment.',
  statusActive: 'Actif',
  statusTrialing: 'Essai gratuit',
  statusPastDue: 'Paiement en retard',
  statusPendingPayment: 'Paiement requis',
  statusSuspended: 'Suspendu',
  statusCancelled: 'Résilié',
  featureLabels: {
    mobileApp: 'Application mobile',
    geolocation: 'Géolocalisation des pointages',
    digitalVault: 'Coffre-fort numérique',
    electronicSignature: 'Signature électronique',
    multiSite: 'Multi-site',
    multiSociete: 'Multi-société',
    advancedDashboards: 'Tableaux de bord avancés',
    ragAi: 'Assistant IA RH',
    advancedAuditLogs: 'Journaux d\'audit avancés',
    customBranding: 'Personnalisation de marque',
    missions: 'Gestion des missions',
    compensationDays: 'Jours de compensation',
    generalLeave: 'Congés généraux',
    generalExit: 'Autorisations de sortie générales',
    leaveManagement: 'Workflow congés',
    authorizationManagement: 'Workflow autorisations',
    expenseReports: 'Notes de frais',
    breastfeedingManagement: 'Gestion allaitement',
    contractManagement: 'Gestion des contrats',
    documentScanOcr: 'Scan OCR pièces d\'identité',
    bulkImport: 'Import Excel en masse',
  },
  cardFallback: 'Carte',
  addonsUpdatedBase: 'Modules mis à jour. ',
  addonsUpdatedStripe: 'La facturation sera ajustée à votre prochain cycle de facturation.',
  addonsUpdatedContact: 'Contactez notre équipe commerciale pour activer la facturation.',
  addonsNoChange: 'Aucun changement.',
  addonsUpdateError: 'Impossible de mettre à jour les modules. Réessayez.',
  loadSubscriptionError: 'Impossible de charger les informations d\'abonnement.',
  portalOpenFailGeneric: "Impossible d'ouvrir le portail de facturation Stripe.",
  portalOpenFailError: "Échec d'ouverture du portail de facturation.",
  paymentCancelled: 'Paiement annulé. Aucun prélèvement n\'a été effectué. Vous pouvez relancer la souscription à tout moment.',
  reactivationConfirmed: 'Réactivation confirmée. Redirection vers votre tableau de bord…',
  noPreviousPlan: "Aucune formule précédente enregistrée. Contactez le support.",
  checkoutInitError: "Impossible d'initialiser le paiement Stripe.",
  reactivateError: "Échec de la réactivation. Réessayez plus tard.",
  resumeSuccess: 'Résiliation annulée. Votre abonnement continuera normalement.',
  resumeError: 'Impossible d\'annuler la résiliation.',
  cancelError: 'Échec de la résiliation. Réessayez plus tard.',
  noSeatLink: 'Aucun lien de paiement collaborateur pour ce pack.',
  refundLine: (amount, currency) =>
    ` Un remboursement prorata temporis de ${amount} ${currency} a été émis vers votre carte (délai bancaire 5–10 jours).`,
  cancelImmediate: (refundLine) =>
    `Votre abonnement a été résilié immédiatement.${refundLine} Vous allez être déconnecté.`,
  cancelScheduled: (date) =>
    `Votre résiliation a bien été enregistrée. Vous gardez l'accès jusqu'au ${date}.`,
  planChanged: (plan) =>
    `Votre formule a été changée pour ${plan}. Le différentiel est ajusté sur votre prochaine facture.`,
  pollingTitle: 'Confirmation du paiement en cours…',
  pollingBody: 'Nous attendons la confirmation Stripe (généralement 2-5 secondes). Ne fermez pas cette page.',
  pollingTimeoutTitle: 'Confirmation retardée',
  pollingTimeoutBody: 'Le paiement a bien été enregistré côté Stripe, mais le webhook de confirmation tarde à arriver. Rafraîchissez la page dans une minute, ou contactez le support si l\'état reste « Résilié ».',
  trialRemaining: (firstName, days) => (
    <>
      {firstName ? `${firstName}, ` : ''}il vous reste <strong>{days}</strong> jour{days > 1 ? 's' : ''} sur votre période d'essai.
    </>
  ),
  trialEnjoy: (days) =>
    `Si vous aimez Concorde Workforce, vous pouvez activer votre abonnement dès maintenant et continuer à bénéficier de vos ${days} jours offerts.`,
  seePricing: 'Voir les tarifs →',
  currentPlan: 'Formule actuelle',
  noPlan: 'Aucune formule',
  currentPeriodEnd: 'Fin de la période en cours',
  trialEnd: 'Fin de l\'essai gratuit',
  cancellationRequestedOn: 'Résiliation demandée le',
  highEnd: 'Haut de gamme',
  yourPlanDetail: 'Votre formule en détail',
  packPrefix: 'Pack',
  activeEmployees: (n) => `${n} collaborateur${n > 1 ? 's' : ''} actif${n > 1 ? 's' : ''}`,
  nextDueOn: (date) => ` · prochaine échéance le ${date}`,
  cycleMonthly: 'Mensuel',
  cycleAnnual: 'Annuel',
  seatsOccupied: 'Sièges occupés',
  includedSuffix: (n) => ` / ${n} inclus`,
  includedMark: (n) => `${n} inclus`,
  overSeatsWarning: (n, rate) => (
    <>
      <Box component="b" sx={{ color: '#7a4708' }}>{n} collaborateur{n > 1 ? 's' : ''}</Box>
      {' '}au-delà du seuil · facturé{n > 1 ? 's' : ''} {rate} HT / mois chacun
    </>
  ),
  overageSynced: 'Facturation Stripe déjà synchronisée — aucune action requise.',
  prebuySeatsHint: 'Vous pouvez pré-acheter des sièges supplémentaires ci-dessous.',
  receiptBaseTitle: 'Abonnement de base',
  receiptPackLine: (name) => `Pack ${name}`,
  receiptIncludedSub: (n) => `${n} collaborateurs inclus`,
  receiptExtraTitle: 'Collaborateurs supplémentaires',
  receiptOverTag: 'DÉPASSEMENT',
  receiptSeatsBeyond: (n) => `Sièges au-delà de ${n}`,
  receiptOverageRate: (rate) => `${rate} HT / mois par collaborateur`,
  receiptOverageQty: (active, extra) => `${active} actifs → ${extra} supp.`,
  receiptModulesTitle: 'Modules optionnels',
  receiptModulesTag: (n) => `+${n} actif${n > 1 ? 's' : ''}`,
  receiptCycleLabel: (name, annual) => `Pack ${name} · ${annual ? 'Engagement annuel' : 'Engagement mensuel'}`,
  addEmployee: 'Ajouter un collaborateur',
  manageModules: 'Gérer mes modules',
  changePlan: 'Changer de pack →',
  seatsNeedStripe: 'L\'ajout de sièges nécessite un abonnement Stripe actif. Activez d\'abord votre formule.',
  contactAdminModules: 'Contactez un administrateur pour ajouter un collaborateur ou gérer les modules.',
  yourActiveModules: 'Vos modules actifs',
  featuresUnlocked: (n) => `${n} fonctionnalité${n > 1 ? 's' : ''} débloquée${n > 1 ? 's' : ''}`,
  additionalModulesInline: (n) => ` · ${n} module${n > 1 ? 's' : ''} additionnel${n > 1 ? 's' : ''}`,
  includedInPack: (plan) => `Inclus dans votre pack${plan ? ` ${plan}` : ''}`,
  noModuleYet: 'Aucun module n\'est encore activé. Choisissez un pack pour débloquer les fonctionnalités.',
  additionalModulesSubscribed: 'Modules additionnels souscrits à l\'inscription',
  manageOptionalModules: 'Gérer mes modules optionnels',
  paymentCard: 'Carte de paiement',
  cardExpires: (mm, yyyy) => `Expire ${mm}/${yyyy}`,
  loadingDots: 'Chargement…',
  noCardSaved: 'Aucune carte enregistrée',
  redirecting: 'Redirection…',
  updateBtn: 'Mettre à jour',
  scheduledCancelTitle: 'Résiliation programmée',
  scheduledCancelBody: (date) => (
    <>
      Votre abonnement sera arrêté le <strong>{date}</strong>.
      Vous conservez l'accès complet jusqu'à cette date.
    </>
  ),
  cancelledTitle: 'Abonnement résilié',
  cancelledBody: (
    <>
      Vos données sont conservées pendant <strong>90 jours</strong> à compter de la
      résiliation. Vous pouvez réactiver votre abonnement à tout moment dans ce délai —
      au-delà, un nouveau compte sera nécessaire (RGPD : conformité au droit à l'oubli).
    </>
  ),
  actions: 'Actions',
  seeOtherPacks: 'Voir les autres packs',
  reactivateMyPlan: 'Réactiver mon abonnement',
  cancelTheCancellation: 'Annuler la résiliation',
  cancelMyPlan: 'Résilier mon abonnement',
  onlyAdminsCanModify: (cancelled) =>
    `Seuls les administrateurs et managers peuvent modifier ${cancelled ? 'ou réactiver' : 'ou résilier'} l'abonnement.`,
  cancelDialogIntro: 'Choisissez le mode de résiliation. Vous pourrez annuler tant que la fin de période n\'est pas atteinte.',
  cancelAtPeriodEndTitle: 'À la fin de la période en cours',
  cancelAtPeriodEndBody: (date) => (
    <>
      Vous gardez l'accès jusqu'au {date}.
      Aucun nouveau prélèvement ne sera effectué. <strong>Recommandé.</strong>
    </>
  ),
  cancelImmediateTitle: 'Résiliation immédiate',
  cancelImmediateBody: 'L\'accès est coupé tout de suite et vous serez déconnecté. Aucun remboursement de la période en cours n\'est effectué.',
  cancelReasonLabel: 'Motif (optionnel)',
  cancelReasonPlaceholder: 'Aide-nous à nous améliorer en partageant la raison de votre départ.',
  cancel: 'Annuler',
  confirmCancelNow: 'Résilier maintenant',
  scheduleCancel: 'Programmer la résiliation',
  optionalModulesIntro: 'Les modules optionnels s\'activent uniquement via un paiement Stripe sécurisé (essai inclus). Cliquez sur « Ajouter via Stripe » : l\'accès et la fonctionnalité sont débloqués automatiquement dès la confirmation du paiement. Les modules déjà inclus dans votre pack sont signalés et ne sont pas refacturés.',
  includedInPackChip: 'Inclus dans le pack',
  onQuote: 'Sur devis',
  perMonth: '/mois',
  addViaStripe: 'Ajouter via Stripe →',
  invoiceImpact: 'Impact sur votre facture',
  perMonthHt: 'HT /mois',
  close: 'Fermer',
  modulesActiveCount: (n) => `${n} module${n > 1 ? 's' : ''} actif${n > 1 ? 's' : ''}`,
  save: 'Enregistrer',
  addSeatsTitle: 'Ajouter des collaborateurs',
  addSeatsIntro: 'Augmentez votre quota de collaborateurs autorisés via un paiement Stripe sécurisé. Chaque siège supplémentaire est facturé au tarif d\'overage de votre pack. Une fois le paiement validé, les collaborateurs correspondants pourront être créés sans confirmation supplémentaire.',
  overageRateForPack: (name) => `Tarif overage Pack ${name}`,
  perMonthPerEmployee: '/ mois / collaborateur',
  seatsToAdd: 'Sièges à ajouter',
  estimatedMonthlyExtra: 'Surcoût mensuel estimé',
  addSeatsFootnote: 'Vous finalisez le nombre de collaborateurs et le paiement sur la page Stripe sécurisée. Les sièges sont crédités à votre compte automatiquement, sans double-comptage.',
  continueOnStripe: 'Continuer sur Stripe →',
};

const EN: Dict = {
  locale: 'en-GB',
  pageTitle: 'My subscription',
  pageSubtitle: 'Manage your plan, track your upcoming due dates and cancel at any time.',
  statusActive: 'Active',
  statusTrialing: 'Free trial',
  statusPastDue: 'Payment overdue',
  statusPendingPayment: 'Payment required',
  statusSuspended: 'Suspended',
  statusCancelled: 'Cancelled',
  featureLabels: {
    mobileApp: 'Mobile app',
    geolocation: 'Clock-in geolocation',
    digitalVault: 'Digital vault',
    electronicSignature: 'Electronic signature',
    multiSite: 'Multi-site',
    multiSociete: 'Multi-company',
    advancedDashboards: 'Advanced dashboards',
    ragAi: 'HR AI Assistant',
    advancedAuditLogs: 'Advanced audit logs',
    customBranding: 'Custom branding',
    missions: 'Mission management',
    compensationDays: 'Time-off-in-lieu days',
    generalLeave: 'General leave',
    generalExit: 'General exit authorizations',
    leaveManagement: 'Leave workflow',
    authorizationManagement: 'Authorization workflow',
    expenseReports: 'Expense reports',
    breastfeedingManagement: 'Breastfeeding management',
    contractManagement: 'Contract management',
    documentScanOcr: 'ID document OCR scan',
    bulkImport: 'Bulk Excel import',
  },
  cardFallback: 'Card',
  addonsUpdatedBase: 'Modules updated. ',
  addonsUpdatedStripe: 'Billing will be adjusted on your next billing cycle.',
  addonsUpdatedContact: 'Contact our sales team to activate billing.',
  addonsNoChange: 'No change.',
  addonsUpdateError: 'Unable to update modules. Please try again.',
  loadSubscriptionError: 'Unable to load subscription information.',
  portalOpenFailGeneric: 'Unable to open the Stripe billing portal.',
  portalOpenFailError: 'Failed to open the billing portal.',
  paymentCancelled: 'Payment cancelled. No charge was made. You can restart the subscription at any time.',
  reactivationConfirmed: 'Reactivation confirmed. Redirecting to your dashboard…',
  noPreviousPlan: 'No previous plan on record. Please contact support.',
  checkoutInitError: 'Unable to initialize the Stripe payment.',
  reactivateError: 'Reactivation failed. Please try again later.',
  resumeSuccess: 'Cancellation reverted. Your subscription will continue normally.',
  resumeError: 'Unable to revert the cancellation.',
  cancelError: 'Cancellation failed. Please try again later.',
  noSeatLink: 'No additional-seat payment link for this plan.',
  refundLine: (amount, currency) =>
    ` A pro-rata refund of ${amount} ${currency} has been issued to your card (5–10 business days for bank processing).`,
  cancelImmediate: (refundLine) =>
    `Your subscription has been cancelled immediately.${refundLine} You will be logged out.`,
  cancelScheduled: (date) =>
    `Your cancellation has been recorded. You keep access until ${date}.`,
  planChanged: (plan) =>
    `Your plan has been changed to ${plan}. The difference is adjusted on your next invoice.`,
  pollingTitle: 'Confirming your payment…',
  pollingBody: 'We are waiting for Stripe confirmation (usually 2-5 seconds). Please do not close this page.',
  pollingTimeoutTitle: 'Confirmation delayed',
  pollingTimeoutBody: 'The payment was recorded on Stripe\'s side, but the confirmation webhook is taking longer than usual. Refresh the page in a minute, or contact support if the status remains "Cancelled".',
  trialRemaining: (firstName, days) => (
    <>
      {firstName ? `${firstName}, ` : ''}you have <strong>{days}</strong> day{days > 1 ? 's' : ''} left in your trial period.
    </>
  ),
  trialEnjoy: (days) =>
    `If you like Concorde Workforce, you can activate your subscription right now and keep enjoying your ${days} free days.`,
  seePricing: 'View pricing →',
  currentPlan: 'Current plan',
  noPlan: 'No plan',
  currentPeriodEnd: 'End of current period',
  trialEnd: 'End of free trial',
  cancellationRequestedOn: 'Cancellation requested on',
  highEnd: 'Top tier',
  yourPlanDetail: 'Your plan in detail',
  packPrefix: 'Pack',
  activeEmployees: (n) => `${n} active employee${n > 1 ? 's' : ''}`,
  nextDueOn: (date) => ` · next due date ${date}`,
  cycleMonthly: 'Monthly',
  cycleAnnual: 'Annual',
  seatsOccupied: 'Seats used',
  includedSuffix: (n) => ` / ${n} included`,
  includedMark: (n) => `${n} included`,
  overSeatsWarning: (n, rate) => (
    <>
      <Box component="b" sx={{ color: '#7a4708' }}>{n} employee{n > 1 ? 's' : ''}</Box>
      {' '}beyond the threshold · billed at {rate} excl. tax / month each
    </>
  ),
  overageSynced: 'Stripe billing already synced — no action required.',
  prebuySeatsHint: 'You can pre-purchase additional seats below.',
  receiptBaseTitle: 'Base subscription',
  receiptPackLine: (name) => `Pack ${name}`,
  receiptIncludedSub: (n) => `${n} employees included`,
  receiptExtraTitle: 'Additional employees',
  receiptOverTag: 'OVERAGE',
  receiptSeatsBeyond: (n) => `Seats beyond ${n}`,
  receiptOverageRate: (rate) => `${rate} excl. tax / month per employee`,
  receiptOverageQty: (active, extra) => `${active} active → ${extra} extra`,
  receiptModulesTitle: 'Optional modules',
  receiptModulesTag: (n) => `+${n} active`,
  receiptCycleLabel: (name, annual) => `Pack ${name} · ${annual ? 'Annual commitment' : 'Monthly commitment'}`,
  addEmployee: 'Add an employee',
  manageModules: 'Manage my modules',
  changePlan: 'Change plan →',
  seatsNeedStripe: 'Adding seats requires an active Stripe subscription. Activate your plan first.',
  contactAdminModules: 'Contact an administrator to add an employee or manage modules.',
  yourActiveModules: 'Your active modules',
  featuresUnlocked: (n) => `${n} feature${n > 1 ? 's' : ''} unlocked`,
  additionalModulesInline: (n) => ` · ${n} additional module${n > 1 ? 's' : ''}`,
  includedInPack: (plan) => `Included in your${plan ? ` ${plan}` : ''} plan`,
  noModuleYet: 'No module is enabled yet. Choose a plan to unlock features.',
  additionalModulesSubscribed: 'Additional modules subscribed at signup',
  manageOptionalModules: 'Manage my optional modules',
  paymentCard: 'Payment card',
  cardExpires: (mm, yyyy) => `Expires ${mm}/${yyyy}`,
  loadingDots: 'Loading…',
  noCardSaved: 'No card saved',
  redirecting: 'Redirecting…',
  updateBtn: 'Update',
  scheduledCancelTitle: 'Cancellation scheduled',
  scheduledCancelBody: (date) => (
    <>
      Your subscription will end on <strong>{date}</strong>.
      You keep full access until that date.
    </>
  ),
  cancelledTitle: 'Subscription cancelled',
  cancelledBody: (
    <>
      Your data is retained for <strong>90 days</strong> from the cancellation. You can
      reactivate your subscription at any time within this window — afterwards, a new
      account will be required (GDPR: compliance with the right to be forgotten).
    </>
  ),
  actions: 'Actions',
  seeOtherPacks: 'View other plans',
  reactivateMyPlan: 'Reactivate my subscription',
  cancelTheCancellation: 'Revert the cancellation',
  cancelMyPlan: 'Cancel my subscription',
  onlyAdminsCanModify: (cancelled) =>
    `Only administrators and managers can ${cancelled ? 'modify or reactivate' : 'modify or cancel'} the subscription.`,
  cancelDialogIntro: 'Choose how to cancel. You can revert as long as the period end has not been reached.',
  cancelAtPeriodEndTitle: 'At the end of the current period',
  cancelAtPeriodEndBody: (date) => (
    <>
      You keep access until {date}.
      No further charge will be made. <strong>Recommended.</strong>
    </>
  ),
  cancelImmediateTitle: 'Immediate cancellation',
  cancelImmediateBody: 'Access is cut off right away and you will be logged out. No refund is issued for the current period.',
  cancelReasonLabel: 'Reason (optional)',
  cancelReasonPlaceholder: 'Help us improve by sharing the reason for your departure.',
  cancel: 'Cancel',
  confirmCancelNow: 'Cancel now',
  scheduleCancel: 'Schedule cancellation',
  optionalModulesIntro: 'Optional modules can only be enabled through a secure Stripe payment (trial included). Click "Add via Stripe": access and the feature are unlocked automatically once the payment is confirmed. Modules already included in your plan are marked and are not billed again.',
  includedInPackChip: 'Included in plan',
  onQuote: 'On quote',
  perMonth: '/mo',
  addViaStripe: 'Add via Stripe →',
  invoiceImpact: 'Impact on your invoice',
  perMonthHt: 'excl. tax /mo',
  close: 'Close',
  modulesActiveCount: (n) => `${n} active module${n > 1 ? 's' : ''}`,
  save: 'Save',
  addSeatsTitle: 'Add employees',
  addSeatsIntro: 'Increase your authorized employee quota via a secure Stripe payment. Each additional seat is billed at your plan\'s overage rate. Once the payment is validated, the matching employees can be created without further confirmation.',
  overageRateForPack: (name) => `Overage rate · Pack ${name}`,
  perMonthPerEmployee: '/ month / employee',
  seatsToAdd: 'Seats to add',
  estimatedMonthlyExtra: 'Estimated monthly extra cost',
  addSeatsFootnote: 'You finalize the number of employees and the payment on the secure Stripe page. Seats are credited to your account automatically, with no double-counting.',
  continueOnStripe: 'Continue on Stripe →',
};

const LANG: Record<Lang, Dict> = { fr: FR, en: EN };

// Payment Links Stripe dédiés « Collaborateur supplémentaire pack {plan} » (mensuel : 4,90 /
// 6,90 / 9,90 € selon le pack). Acheter via ce lien crée un abonnement Stripe distinct pour
// les sièges, rattaché au tenant via ?client_reference_id={slug} → le webhook incrémente
// Tenant.LinkPurchasedSeats (relève le seuil d'overage, facturation séparée du user_supp du pack).
const SEAT_PAYMENT_LINKS: Record<string, string> = {
  Starter: 'https://buy.stripe.com/4gMeV67Cl2JbaNFgc90000h',
  Standard: 'https://buy.stripe.com/9B6dR2aOx0B31d5gc90000j',
  Premium: 'https://buy.stripe.com/14A6oAf4N97zaNF3pn0000i',
};

export default function MonAbonnementPage() {
  // navigate sert encore au redirect post-réactivation (finishSuccess → /dashboard).
  // Le bouton « Ajouter un collaborateur » a basculé sur un dialog inline (cf.
  // addSeatsDialogOpen plus bas) : on ne fait plus de navigate vers la page de
  // création employé puisque la demande utilisateur 2026-05-27 était explicitement
  // de NE PAS rediriger.
  const navigate = useNavigate();
  const { i18n } = useTranslation();
  const lang: Lang = i18n.language === 'en' ? 'en' : 'fr';
  const d = LANG[lang];
  // Map addons localisée (clé backend → { label, description, priceMonthlyEur }) dans la
  // langue courante. Remplace ADDON_LABELS (FR-only) pour tout libellé affiché.
  const addonLabels = getAddonLabels(lang);
  const { isAdmin, isManager, refreshAuth, userName, isTrialing, trialDaysRemaining, addons } = useAuth();
  const canManage = isAdmin || isManager;

  // Addons reconnus du catalogue (filtre défensif contre des valeurs serveur inattendues).
  // Conservé : alimente le reçu de facture (InvoiceReceipt) plus bas.
  const subscribedAddons = (addons ?? []).filter((a) => addonLabels[a] != null);

  // Prénom uniquement pour personnaliser le bandeau trial (« Mohamed, il vous reste… »).
  // userName est « Prénom Nom » concaténé côté serveur (Utiprn + Utinom).
  const firstName = (userName ?? '').trim().split(/\s+/)[0] || null;

  const [info, setInfo] = useState<SubscriptionInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Cycle affiché dans la carte « facture en direct » (variante A). Le toggle reste ajustable
  // pour prévisualiser le tarif mensuel vs annuel-mensualisé, mais on l'initialise sur le
  // cycle RÉELLEMENT souscrit (info.billingCycle, dérivé de la subscription Stripe) une fois
  // les infos chargées — au lieu de figer « mensuel » par défaut. Repli mensuel si inconnu.
  const [cycleA, setCycleA] = useState<Cycle>('monthly');
  const cycleInitDone = useRef(false);
  useEffect(() => {
    if (cycleInitDone.current) return;
    if (info?.billingCycle === 'annual' || info?.billingCycle === 'monthly') {
      setCycleA(info.billingCycle);
      cycleInitDone.current = true;
    }
  }, [info?.billingCycle]);

  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelMode, setCancelMode] = useState<'period_end' | 'immediate'>('period_end');
  const [cancelReason, setCancelReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [changePlanOpen, setChangePlanOpen] = useState(false);
  // Pré-sélection de la modale « Changer de pack » (deep-link depuis la grille tarifaire
  // de la home pour un utilisateur connecté : ?changePlan=premium&cycle=annual).
  const [changePlanInitial, setChangePlanInitial] = useState<{ plan: PlanKey | null; cycle: Cycle }>({ plan: null, cycle: 'annual' });
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
  // L'achat passe par le Payment Link Stripe dédié (openSeatStripeLink) : la quantité
  // se choisit sur la page Stripe, le webhook crédite les sièges (Tenant.LinkPurchasedSeats).
  const [addSeatsDialogOpen, setAddSeatsDialogOpen] = useState(false);
  const [addSeatsCount, setAddSeatsCount] = useState<number>(1);
  const [addSeatsError, setAddSeatsError] = useState<string | null>(null);
  const openAddSeatsDialog = () => {
    setAddSeatsCount(1);
    setAddSeatsError(null);
    setAddSeatsDialogOpen(true);
  };
  // L'ajout de collaborateurs passe par le Payment Link Stripe dédié au pack (et non par
  // l'API /billing/add-seats qui mute l'abonnement existant et échoue côté Stripe) : le
  // client choisit la quantité et paie sur la page Stripe hébergée ; le webhook crédite les
  // sièges au tenant (LinkPurchasedSeats). Le curseur ci-dessous sert à estimer le coût mensuel.
  // NB : un Payment Link n'accepte pas de quantité en paramètre d'URL — la quantité se choisit
  // sur la page Stripe.
  const openModuleStripeLink = (link: string) => {
    const slug = info?.slug || (typeof window !== 'undefined' ? window.localStorage.getItem('tenantSlug') : '') || '';
    const url = slug ? `${link}?client_reference_id=${encodeURIComponent(slug)}` : link;
    window.open(url, '_blank', 'noopener,noreferrer');
  };
  const seatLink = SEAT_PAYMENT_LINKS[info?.plan?.code || info?.planCode || ''];
  const openSeatStripeLink = () => {
    if (!seatLink) { setAddSeatsError(d.noSeatLink); return; }
    openModuleStripeLink(seatLink);
  };

  const fetchInfo = async (opts: { silent?: boolean } = {}): Promise<SubscriptionInfo | null> => {
    if (!opts.silent) setLoading(true);
    setError(null);
    try {
      const res = await apiInstance.get<SubscriptionInfo>('/billing/subscription');
      setInfo(res.data);
      return res.data;
    } catch (e: any) {
      setError(e?.response?.data?.error || d.loadSubscriptionError);
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
        setError(d.portalOpenFailGeneric);
      }
    } catch (e: any) {
      setError(e?.response?.data?.error || d.portalOpenFailError);
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
    setError(d.paymentCancelled);
    // Nettoyage du query param pour éviter qu'un refresh ne réaffiche le message
    // et pour neutraliser toute logique conditionnée à ?checkout=cancelled.
    const url = new URL(window.location.href);
    url.searchParams.delete('checkout');
    url.searchParams.delete('reactivate');
    window.history.replaceState({}, '', url.toString());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Deep-link depuis la grille tarifaire de la home (utilisateur connecté) :
  // ?changePlan=premium&cycle=annual → on pré-ouvre la modale « Changer de pack » sur le
  // pack/cycle choisi (cf. HomePage.goToCheckout — tunnel in-app unique, sans Payment Link
  // externe rouvrant un 2e essai). On nettoie l'URL ensuite.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const raw = (params.get('changePlan') ?? '').trim();
    if (!raw) return;
    const norm = raw.charAt(0).toUpperCase() + raw.slice(1).toLowerCase();
    const plan = (['Starter', 'Standard', 'Premium'].includes(norm) ? norm : null) as PlanKey | null;
    const cycle: Cycle = (params.get('cycle') ?? '').toLowerCase() === 'monthly' ? 'monthly' : 'annual';
    setChangePlanInitial({ plan, cycle });
    setChangePlanOpen(true);
    const url = new URL(window.location.href);
    url.searchParams.delete('changePlan');
    url.searchParams.delete('cycle');
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
      setSuccessMsg(d.reactivationConfirmed);
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
        ? d.refundLine(refundedAmount.toFixed(2), refundCurrency.toUpperCase())
        : '';
      setSuccessMsg(
        immediate
          ? d.cancelImmediate(refundLine)
          : d.cancelScheduled(formatDate(effectiveAt, d.locale))
      );
      await fetchInfo();
      if (immediate) {
        // Résiliation immédiate → l'accès tombe à 402 dès la prochaine requête. On laisse
        // 3s pour que l'utilisateur lise le message puis on force la déconnexion.
        setTimeout(() => { window.location.href = '/login'; }, 3000);
      }
    } catch (e: any) {
      setError(e?.response?.data?.error || d.cancelError);
    } finally {
      setSubmitting(false);
    }
  };

  const handleResume = async () => {
    setSubmitting(true);
    setError(null);
    try {
      await apiInstance.post('/billing/resume-subscription');
      setSuccessMsg(d.resumeSuccess);
      await fetchInfo();
    } catch (e: any) {
      setError(e?.response?.data?.error || d.resumeError);
    } finally {
      setSubmitting(false);
    }
  };

  // Réactivation : tenant Cancelled dans la fenêtre de rétention (90j). On lance un
  // nouveau Stripe Checkout — le webhook checkout.session.completed flippe Cancelled→Active
  // et préserve toutes les données du tenant (employés, contrats, pointages…).
  const handleReactivate = async () => {
    if (!info?.planCode) {
      setError(d.noPreviousPlan);
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
        setError(d.checkoutInitError);
      }
    } catch (e: any) {
      setError(e?.response?.data?.error || d.reactivateError);
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

  const st = info ? statusLabel(info.status, d) : null;
  const isCancelled = info?.status === 'Cancelled';
  const scheduledCancel = info?.cancelAtPeriodEnd === true;

  return (
    <Box sx={{ maxWidth: 980, mx: 'auto', p: { xs: 2, md: 4 } }}>
      <Typography variant="h4" sx={{ fontWeight: 800, color: '#0f172a', mb: 0.5 }}>
        {d.pageTitle}
      </Typography>
      <Typography sx={{ color: '#64748b', mb: 4 }}>
        {d.pageSubtitle}
      </Typography>

      {error && <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>{error}</Alert>}
      {successMsg && <Alert severity="success" sx={{ mb: 3 }} onClose={() => setSuccessMsg(null)}>{successMsg}</Alert>}
      {pollingReactivation && (
        <Alert severity="info" sx={{ mb: 3, alignItems: 'center' }}
          icon={<CircularProgress size={20} />}>
          <Typography sx={{ fontWeight: 700, mb: 0.5 }}>{d.pollingTitle}</Typography>
          <Typography sx={{ fontSize: 13 }}>
            {d.pollingBody}
          </Typography>
        </Alert>
      )}
      {pollingTimedOut && (
        <Alert severity="warning" sx={{ mb: 3 }} onClose={() => setPollingTimedOut(false)}>
          <Typography sx={{ fontWeight: 700, mb: 0.5 }}>{d.pollingTimeoutTitle}</Typography>
          <Typography sx={{ fontSize: 13 }}>
            {d.pollingTimeoutBody}
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
              {d.trialRemaining(firstName, daysLeft)}
            </Typography>
            <Typography sx={{ color: '#475569', fontSize: 14, mb: 2 }}>
              {d.trialEnjoy(TRIAL_DURATION_DAYS)}
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
                {d.seePricing}
              </Button>
            )}
          </Paper>
        );
      })()}

      <Paper elevation={0} sx={{ p: { xs: 3, md: 4 }, borderRadius: '20px', border: '1px solid #e2e8f0', mb: 3 }}>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={3} alignItems={{ md: 'center' }} justifyContent="space-between">
          <Box>
            <Typography sx={{ fontSize: 12, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', mb: 0.5 }}>
              {d.currentPlan}
            </Typography>
            <Typography variant="h5" sx={{ fontWeight: 800, color: '#0040a1' }}>
              {info?.planCode || d.noPlan}
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
              {d.currentPeriodEnd}
            </Typography>
            <Typography sx={{ fontWeight: 700, color: '#0f172a' }}>
              {formatDate(info?.currentPeriodEndsAt ?? null, d.locale)}
            </Typography>
          </Box>
          {info?.status === 'Trialing' && (
            <Box sx={{ flex: 1 }}>
              <Typography sx={{ fontSize: 12, color: '#64748b', textTransform: 'uppercase', fontWeight: 700, mb: 0.5 }}>
                {d.trialEnd}
              </Typography>
              <Typography sx={{ fontWeight: 700, color: '#0f172a' }}>
                {formatDate(info?.trialEndsAt ?? null, d.locale)}
              </Typography>
            </Box>
          )}
          {scheduledCancel && (
            <Box sx={{ flex: 1 }}>
              <Typography sx={{ fontSize: 12, color: '#64748b', textTransform: 'uppercase', fontWeight: 700, mb: 0.5 }}>
                {d.cancellationRequestedOn}
              </Typography>
              <Typography sx={{ fontWeight: 700, color: '#dc2626' }}>
                {formatDate(info?.cancellationRequestedAt ?? null, d.locale)}
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

        // Sections du reçu détaillé (variante B / image 1). Construites depuis les
        // données réelles : abonnement de base, dépassement de sièges, modules souscrits.
        const receiptSections: ReceiptSection[] = [
          {
            title: d.receiptBaseTitle,
            lines: [{
              label: d.receiptPackLine(plan.displayName),
              sublabel: d.receiptIncludedSub(plan.includedEmployees),
              amountEur: base,
              kind: 'base',
            }],
          },
        ];
        if (usage.extraEmployees > 0) {
          receiptSections.push({
            title: d.receiptExtraTitle,
            tag: { label: d.receiptOverTag, kind: 'over' },
            lines: [{
              label: d.receiptSeatsBeyond(plan.includedEmployees),
              sublabel: d.receiptOverageRate(eur(plan.overageRatePerEmployeeEur, d.locale)),
              qty: d.receiptOverageQty(usage.activeEmployees, usage.extraEmployees),
              amountEur: overageCost,
              kind: 'over',
            }],
          });
        }
        if (subscribedAddons.length > 0) {
          receiptSections.push({
            title: d.receiptModulesTitle,
            tag: { label: d.receiptModulesTag(subscribedAddons.length), kind: 'module' },
            lines: subscribedAddons.map((a) => ({
              label: addonLabels[a].label,
              sublabel: addonLabels[a].description,
              amountEur: addonLabels[a].priceMonthlyEur,
              kind: 'module' as const,
            })),
          });
        }
        const receiptCycleLabel = d.receiptCycleLabel(plan.displayName, cycleA === 'annual');

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
                      {d.yourPlanDetail}
                    </Typography>
                    <Stack direction="row" alignItems="center" spacing={1.25} sx={{ mt: 0.4 }}>
                      <Typography sx={{ fontSize: 24, fontWeight: 800, letterSpacing: '-.01em', color: '#0F1B33' }}>
                        {d.packPrefix} {plan.displayName}
                      </Typography>
                      {isPremium && (
                        <Box component="span" sx={{
                          fontSize: 10.5, fontWeight: 800, letterSpacing: '.06em', color: '#7a5a16',
                          background: 'linear-gradient(180deg,#fbe7b3,#f3d488)', border: '1px solid #e7c97e',
                          px: 1.1, py: '3px', borderRadius: '999px', textTransform: 'uppercase',
                        }}>
                          {d.highEnd}
                        </Box>
                      )}
                    </Stack>
                    <Typography sx={{ fontSize: 13, color: '#6A7691', mt: 0.5 }}>
                      {d.activeEmployees(usage.activeEmployees)}
                      {info.currentPeriodEndsAt ? d.nextDueOn(formatDate(info.currentPeriodEndsAt, d.locale)) : ''}
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
                        {cy === 'monthly' ? d.cycleMonthly : d.cycleAnnual}
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
                      {d.seatsOccupied}
                    </Typography>
                    <Typography sx={{ fontSize: 22, fontWeight: 800, color: '#0F1B33', fontVariantNumeric: 'tabular-nums' }}>
                      {usage.activeEmployees}
                      <Typography component="span" sx={{ fontSize: 14, color: '#6A7691', fontWeight: 600 }}>{d.includedSuffix(plan.includedEmployees)}</Typography>
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
                    <Typography sx={{ fontSize: 12.5, color: '#6A7691' }}>{d.includedMark(plan.includedEmployees)}</Typography>
                  </Stack>
                  {usage.isOverCapacity && (
                    <Stack direction="row" alignItems="center" spacing={1.1} sx={{
                      mt: 1.6, background: '#FCEFD9', border: '1px solid #f3d6a3', color: '#8a5208',
                      borderRadius: '10px', px: 1.5, py: 1.25, fontSize: 13, fontWeight: 600,
                    }}>
                      <WarningAmberRoundedIcon sx={{ fontSize: 18, color: '#8a5208' }} />
                      <Box component="span">
                        {d.overSeatsWarning(usage.extraEmployees, eur(plan.overageRatePerEmployeeEur, d.locale))}
                      </Box>
                    </Stack>
                  )}
                  <Typography sx={{ fontSize: 11.5, color: '#94a3b8', mt: 1.5 }}>
                    {usage.isOverCapacity
                      ? d.overageSynced
                      : d.prebuySeatsHint}
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
                    {d.addEmployee}
                  </Button>
                  <Button
                    variant="outlined"
                    onClick={() => setChangePlanOpen(true)}
                    sx={{
                      textTransform: 'none', fontWeight: 700, borderRadius: '12px', px: 2.5,
                      color: '#14346B', borderColor: '#E4EAF3', '&:hover': { borderColor: '#14346B' },
                    }}
                  >
                    {d.changePlan}
                  </Button>
                </Stack>
              )}
              {canManage && !info?.hasActiveStripeSubscription && (
                <Typography sx={{ fontSize: 12, color: '#94a3b8', fontStyle: 'italic', mt: 1 }}>
                  {d.seatsNeedStripe}
                </Typography>
              )}
              {!canManage && (
                <Typography sx={{ fontSize: 12, color: '#94a3b8', fontStyle: 'italic', mt: 2 }}>
                  {d.contactAdminModules}
                </Typography>
              )}
            </Box>
          </Paper>
        );
      })()}

      {/* Section « modules optionnels » retirée de la page d'abonnement (carte « Vos modules
          actifs » + popup « Gérer mes modules optionnels »). La gestion/souscription des
          modules ne se fait plus ici. */}

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
                {d.paymentCard}
              </Typography>
              {paymentMethod?.hasCard ? (
                <>
                  <Typography sx={{ fontWeight: 800, color: '#0f172a' }}>
                    {brandLabel(paymentMethod.brand, d.cardFallback)} •••• {paymentMethod.last4}
                  </Typography>
                  {paymentMethod.expMonth && paymentMethod.expYear && (
                    <Typography sx={{ color: '#64748b', fontSize: 13 }}>
                      {d.cardExpires(String(paymentMethod.expMonth).padStart(2, '0'), paymentMethod.expYear)}
                    </Typography>
                  )}
                </>
              ) : paymentMethod === null ? (
                <Typography sx={{ color: '#64748b', fontSize: 14 }}>{d.loadingDots}</Typography>
              ) : (
                <Typography sx={{ color: '#64748b', fontSize: 14 }}>
                  {d.noCardSaved}
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
              {openingPortal ? d.redirecting : d.updateBtn}
            </Button>
          )}
        </Stack>
      </Paper>

      {scheduledCancel && !isCancelled && (
        <Alert severity="warning" sx={{ mb: 3, borderRadius: '14px' }}>
          <Typography sx={{ fontWeight: 700, mb: 0.5 }}>{d.scheduledCancelTitle}</Typography>
          <Typography sx={{ fontSize: 14 }}>
            {d.scheduledCancelBody(formatDate(info?.currentPeriodEndsAt ?? null, d.locale))}
          </Typography>
        </Alert>
      )}

      {isCancelled && (
        <Alert severity="info" sx={{ mb: 3, borderRadius: '14px' }}>
          <Typography sx={{ fontWeight: 700, mb: 0.5 }}>{d.cancelledTitle}</Typography>
          <Typography sx={{ fontSize: 14 }}>
            {d.cancelledBody}
          </Typography>
        </Alert>
      )}

      <Paper elevation={0} sx={{ p: { xs: 3, md: 4 }, borderRadius: '20px', border: '1px solid #e2e8f0' }}>
        <Typography variant="h6" sx={{ fontWeight: 800, color: '#0f172a', mb: 2 }}>
          {d.actions}
        </Typography>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} flexWrap="wrap">
          {!isCancelled && (
            <Button
              variant="contained"
              startIcon={<RocketLaunchIcon />}
              onClick={() => setChangePlanOpen(true)}
              sx={{ textTransform: 'none', fontWeight: 700, borderRadius: '12px', px: 3 }}
            >
              {d.seeOtherPacks}
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
              {d.reactivateMyPlan}
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
              {d.cancelTheCancellation}
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
              {d.cancelMyPlan}
            </Button>
          )}
        </Stack>
        {!canManage && (
          <Typography sx={{ mt: 2, fontSize: 13, color: '#64748b' }}>
            {d.onlyAdminsCanModify(isCancelled)}
          </Typography>
        )}
      </Paper>

      <Dialog open={cancelOpen} onClose={() => !submitting && setCancelOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 800 }}>{d.cancelMyPlan}</DialogTitle>
        <DialogContent>
          <Typography sx={{ mb: 2, color: '#475569', fontSize: 14 }}>
            {d.cancelDialogIntro}
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
                    <Typography sx={{ fontWeight: 700 }}>{d.cancelAtPeriodEndTitle}</Typography>
                    <Typography sx={{ fontSize: 13, color: '#64748b' }}>
                      {d.cancelAtPeriodEndBody(formatDate(info?.currentPeriodEndsAt ?? null, d.locale))}
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
                    <Typography sx={{ fontWeight: 700 }}>{d.cancelImmediateTitle}</Typography>
                    <Typography sx={{ fontSize: 13, color: '#64748b' }}>
                      {d.cancelImmediateBody}
                    </Typography>
                  </Box>
                }
              />
            </Paper>
          </RadioGroup>
          <TextField
            label={d.cancelReasonLabel}
            value={cancelReason}
            onChange={(e) => setCancelReason(e.target.value)}
            multiline
            minRows={2}
            fullWidth
            sx={{ mt: 3 }}
            placeholder={d.cancelReasonPlaceholder}
          />
        </DialogContent>
        <DialogActions sx={{ p: 3, pt: 0 }}>
          <Button onClick={() => setCancelOpen(false)} disabled={submitting}>{d.cancel}</Button>
          <Button
            variant="contained"
            color="error"
            onClick={handleCancel}
            disabled={submitting}
            startIcon={submitting ? <CircularProgress size={16} color="inherit" /> : undefined}
            sx={{ textTransform: 'none', fontWeight: 700 }}
          >
            {cancelMode === 'immediate' ? d.confirmCancelNow : d.scheduleCancel}
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
        tenantSlug={info?.slug ?? null}
        initialSelected={changePlanInitial.plan}
        initialCycle={changePlanInitial.cycle}
        onViewDevis={(plan, cycle) => setDevisDialog({ plan, cycle })}
        onSuccess={async (newPlan) => {
          setChangePlanOpen(false);
          setSuccessMsg(d.planChanged(newPlan));
          // refreshAuth → /me recharge planCode + planFeatures (flags fusionnés via
          // GetEffectiveFeatures). SANS ça, le contexte global useAuth restait sur
          // l'ancien pack : la sidebar, les gates de features et le badge « votre pack »
          // affichaient encore Starter alors que le backend était déjà passé à Standard.
          // fetchInfo() ne rafraîchit QUE l'état local de cette page, pas le contexte auth.
          await Promise.all([fetchInfo(), refreshAuth()]);
        }}
      />

      <DevisPackDialog
        open={devisDialog !== null}
        onClose={() => setDevisDialog(null)}
        plan={devisDialog?.plan ?? null}
        cycle={devisDialog?.cycle ?? 'monthly'}
      />


      {/* ─── Dialog "Ajouter des collaborateurs" ────────────────────────────────
          Pré-achat de N sièges supplémentaires depuis la page abonnement (sans
          passer par /dashboard/profil-employe). À la confirmation : ouverture du
          Payment Link Stripe dédié au pack (la quantité se choisit sur la page
          Stripe) ; le webhook crédite les sièges au tenant (LinkPurchasedSeats).
          Le curseur ci-dessous sert à estimer le surcoût mensuel.
      */}
      <Dialog
        open={addSeatsDialogOpen}
        onClose={() => setAddSeatsDialogOpen(false)}
        maxWidth="xs"
        fullWidth
        PaperProps={{ sx: { borderRadius: '16px' } }}
      >
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1.5, pb: 1, fontWeight: 800 }}>
          <GroupAddIcon sx={{ color: '#0040a1' }} />
          {d.addSeatsTitle}
        </DialogTitle>
        <DialogContent dividers>
          {addSeatsError && (
            <Alert severity="error" sx={{ mb: 2, borderRadius: '10px' }} onClose={() => setAddSeatsError(null)}>
              {addSeatsError}
            </Alert>
          )}
          <Typography sx={{ fontSize: 13, color: '#475569', mb: 2.5, lineHeight: 1.55 }}>
            {d.addSeatsIntro}
          </Typography>

          {info?.plan && (
            <Box sx={{ p: 2, mb: 2.5, bgcolor: '#f8fafc', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
              <Typography sx={{ fontSize: 11, color: '#64748b', fontWeight: 700, textTransform: 'uppercase', mb: 0.5 }}>
                {d.overageRateForPack(info.plan.displayName)}
              </Typography>
              <Typography sx={{ fontSize: 16, fontWeight: 800, color: '#0040a1' }}>
                {info.plan.overageRatePerEmployeeEur.toFixed(2)} € HT
                <Typography component="span" sx={{ fontSize: 12, color: '#64748b', fontWeight: 600, ml: 0.5 }}>
                  {d.perMonthPerEmployee}
                </Typography>
              </Typography>
            </Box>
          )}

          {/* Curseur roulant pour le nombre de sièges (design image 3). Plage 1–50 ;
              au-delà, relancer l'opération (le backend accepte jusqu'à 500). */}
          <Box sx={{ my: 1.5 }}>
            <Box sx={{ textAlign: 'center', py: 1.25, bgcolor: '#eff6ff', borderRadius: '12px', border: '1px solid #bfdbfe', mb: 2 }}>
              <Typography sx={{ fontSize: 11, color: '#1e40af', fontWeight: 700, textTransform: 'uppercase' }}>
                {d.seatsToAdd}
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
                  {d.estimatedMonthlyExtra}
                </Typography>
                <Typography sx={{ fontSize: 20, fontWeight: 800, color: '#b45309' }}>
                  +{(addSeatsCount * info.plan.overageRatePerEmployeeEur).toFixed(2)} € HT
                </Typography>
              </Stack>
            </Box>
          )}

          <Typography sx={{ fontSize: 11.5, color: '#94a3b8', mt: 2, textAlign: 'center', lineHeight: 1.5 }}>
            {d.addSeatsFootnote}
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button
            onClick={() => setAddSeatsDialogOpen(false)}
            sx={{ textTransform: 'none', fontWeight: 700 }}
          >
            {d.cancel}
          </Button>
          {/* Le paiement passe par le Payment Link Stripe dédié : la quantité se choisit sur la
              page Stripe hébergée, le webhook crédite les sièges au tenant (LinkPurchasedSeats). */}
          <Button
            variant="contained"
            onClick={() => { openSeatStripeLink(); setAddSeatsDialogOpen(false); }}
            disabled={!seatLink}
            startIcon={<GroupAddIcon />}
            sx={{
              textTransform: 'none', fontWeight: 700, borderRadius: '10px',
              bgcolor: '#635BFF', '&:hover': { bgcolor: '#4f46e5' },
            }}
          >
            {d.continueOnStripe}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
