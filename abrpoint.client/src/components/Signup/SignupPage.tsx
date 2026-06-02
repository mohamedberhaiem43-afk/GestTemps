import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import apiInstance from '../API/apiInstance';
import { sendSupportMessage } from '../../services/ContactService';
import { useAuth } from '../helper/AuthProvider';
import { type PlanKey, type Cycle, type AddonKey } from './PlanPicker';
import './Signup.css';

const SLUG_REGEX = /^[a-z0-9](?:[a-z0-9-]{1,28}[a-z0-9])?$/;

type SlugStatus = 'idle' | 'checking' | 'available' | 'taken' | 'invalid' | 'reserved';
type EmailStatus = 'idle' | 'checking' | 'available' | 'taken' | 'invalid';

// Filtre « email professionnel uniquement » RETIRÉ (2026-05) — la contrainte bloquait
// trop de prospects légitimes (indépendants, associations, petites structures sans
// domaine propre). Remplacé par la vérification email obligatoire au signup : l'OTP
// 6 chiffres envoyé sur l'adresse saisie prouve que l'utilisateur en a le contrôle.
// Cf. /verify-email + UtilisateursController.VerifyEmail côté serveur.
// Statuts SIRET — reflètent les codes renvoyés par /api/signup/check-siret :
//   format/checksum → ID mal formé localement (format dépend du pays) ;
//   not_found/closed → API Sirene ne reconnaît pas l'établissement ou il est fermé ;
//   already_used → un autre tenant actif utilise déjà ce numéro (anti-fraude).
type SiretStatus = 'idle' | 'checking' | 'available' | 'format' | 'checksum' | 'not_found' | 'closed' | 'already_used' | 'invalid';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// ─────────────────────────────────────────────────────────────────────────
// Multi-pays (2026-05) : 5 pays supportés au signup. La config détermine le
// label/placeholder/regex du champ ID + le message d'aide. Le mapping est
// CALÉ sur les validations côté backend (SiretValidator.ValidateXxx) — toute
// modification ici doit être propagée là-bas et vice-versa.
// ─────────────────────────────────────────────────────────────────────────
type CountryCode = 'FR' | 'BE' | 'MA' | 'SN' | 'TN';

interface CountryConfig {
  code: CountryCode;
  label: string; // libellé FR
  cca3: string;  // pour matcher avec restcountries (drapeau)
  idLabel: string;
  // Nombre de "caractères" attendus dans le format de base (sert au compteur et au
  // helper). Pour les ID 100% numériques (FR/BE/MA/SN) c'est aussi le nombre de
  // chiffres exacts. Pour TN (alphanumérique) c'est la longueur minimale (8 chars =
  // matricule de base 1234567A ; la forme longue jusqu'à 13 chars reste acceptée).
  idDigits: number;
  idPlaceholder: string;
  idHelper: string;
  apiValidated: boolean; // true = format + API publique ; false = format uniquement
  // True quand le format inclut des lettres (TN). Influe sur : (1) le filtre de saisie
  // qui autorise [A-Za-z] en plus des chiffres, (2) la regex de validation côté client,
  // (3) la longueur max acceptée dans l'input. Default false = numérique pur.
  idAlphanumeric?: boolean;
  // Regex stricte appliquée à la valeur normalisée (uppercase, sans espaces/tirets/points).
  // Default = `^[0-9]{idDigits}$` pour les ID numériques. Override pour TN qui accepte
  // une forme courte 8 chars OU une forme longue 10-13 chars avec codes TVA/établissement.
  idRegex?: RegExp;
  // Longueur max saisissable (caractères bruts, espaces/séparateurs inclus). Default
  // = idDigits + 6 (suffisant pour le formatage usuel). TN peut nécessiter plus pour
  // accommoder la forme complète "1234567/A/M/001".
  idMaxInputLength?: number;
}

const COUNTRY_CONFIG: Record<CountryCode, CountryConfig> = {
  FR: {
    code: 'FR', label: 'France', cca3: 'FRA',
    idLabel: 'SIRET de l\'entreprise',
    idDigits: 14,
    idPlaceholder: '14 chiffres — ex. 123 456 789 00012',
    idHelper: 'Vérifié contre le référentiel Sirene (API gouvernementale).',
    apiValidated: true,
  },
  BE: {
    code: 'BE', label: 'Belgique', cca3: 'BEL',
    idLabel: 'Numéro BCE (Banque-Carrefour des Entreprises)',
    idDigits: 10,
    idPlaceholder: '10 chiffres — ex. 0123456789',
    idHelper: 'Vérifié contre le registre BCE (cbeapi.be) + clé de contrôle mod 97.',
    apiValidated: true,
  },
  MA: {
    code: 'MA', label: 'Maroc', cca3: 'MAR',
    idLabel: 'ICE (Identifiant Commun de l\'Entreprise)',
    idDigits: 15,
    idPlaceholder: '15 chiffres — ex. 001234567000089',
    idHelper: 'Validation du format uniquement (15 chiffres). Aucune API publique fiable n\'est disponible côté DGI.',
    apiValidated: false,
  },
  SN: {
    code: 'SN', label: 'Sénégal', cca3: 'SEN',
    idLabel: 'NINEA (Numéro d\'Identification Nationale)',
    idDigits: 9,
    idPlaceholder: '9 chiffres — ex. 123456789',
    idHelper: 'Validation du format uniquement (9 chiffres). Aucune API publique n\'est disponible côté ADEPME.',
    apiValidated: false,
  },
  TN: {
    code: 'TN', label: 'Tunisie', cca3: 'TUN',
    idLabel: 'Matricule Fiscal',
    idDigits: 8, // forme courte = 7 chiffres + 1 lettre clé
    idPlaceholder: 'ex. 1234567A (court) ou 1234567AAM001 (complet)',
    idHelper: 'Format DGI : 7 chiffres + 1 lettre clé, suivis optionnellement des codes TVA/catégorie/établissement. Aucune API publique disponible.',
    apiValidated: false,
    idAlphanumeric: true,
    // 7 chiffres + 1 lettre clé, plus optionnellement 1-3 lettres (TVA/catégorie) +
    // 0-3 chiffres (établissement). Couvre la forme courte `1234567A` (8 chars) et
    // les formes complètes `1234567AAM`, `1234567AAM001`, etc. (jusqu'à 13 chars).
    idRegex: /^[0-9]{7}[A-Z]([A-Z]{1,3}[0-9]{0,3})?$/,
    idMaxInputLength: 20, // marge pour les séparateurs "1234567 / A / M / 001"
  },
};

const SUPPORTED_COUNTRIES: CountryCode[] = ['FR', 'BE', 'MA', 'SN', 'TN'];

// Drapeaux emoji pour l'indicateur visuel du sélecteur de pays (les <option> natives
// ne peuvent pas afficher d'image). Léger, sans dépendance réseau.
const COUNTRY_FLAGS: Record<CountryCode, string> = {
  FR: '🇫🇷', BE: '🇧🇪', MA: '🇲🇦', SN: '🇸🇳', TN: '🇹🇳',
};

// ── i18n — dictionnaire local FR/EN (même pattern que ServicesPage.tsx) ─────
type Lang = 'fr' | 'en';

// Libellés d'affichage dépendant du pays. SEULS les textes visibles sont
// traduits ici ; les valeurs métier (code pays, regex, idDigits…) restent dans
// COUNTRY_CONFIG et ne changent jamais selon la langue.
interface CountryStrings {
  label: string;       // libellé du pays dans le <select>
  idLabel: string;     // libellé du champ identifiant entreprise
  idPlaceholder: string;
  idHelper: string;
}

interface Dict {
  // NAV / header
  alreadyRegistered: string;
  loginArrow: string;
  titleCreate: string;
  titleTrial: string;
  subtitleFromPricing: string;
  subtitleTrialPrefix: string; // texte avant le nom produit (gras)
  trustNoCard: string;
  trustHostedFr: string;
  // Sections
  choosePlan: string;
  planHint: string;
  yourCompany: string;
  yourAdminAccount: string;
  // Pays + ID
  countryLabel: string;
  idOneTrial: string; // suffixe « Un seul essai gratuit par numéro. »
  officialAddress: string;
  // Email
  emailLabel: string;
  emailPlaceholder: string;
  emailHelperDefault: string;
  // Nom entreprise
  companyLabel: string;
  companyPlaceholder: string;
  companyHelper: string;
  // Secteur
  sectorLabel: string;
  sectorPlaceholder: string;
  // Slug
  slugLabel: string;
  slugPlaceholder: string;
  slugFallback: string; // « votre-slug » de remplacement
  // Prénom / nom
  firstNameLabel: string;
  firstNamePlaceholder: string;
  lastNameLabel: string;
  lastNamePlaceholder: string;
  // Mot de passe
  passwordLabel: string;
  passwordPlaceholder: string;
  pwRuleLen: string;
  pwRuleUpper: string;
  pwRuleSpecial: string;
  // Captcha
  captchaLabel: string;
  captchaSub: string;
  captchaPlaceholder: string;
  captchaRefreshTitle: string;
  // CGU
  termsAcceptPrefix: string;
  termsLinkCgu: string;
  termsAnd: string;
  termsLinkPrivacy: string;
  termsOf: string; // « de Concorde Workforce. »
  // Submit
  submitCreating: string;
  submitContinuePayment: string;
  submitStartTrial: string;
  submitSubNote: string;
  // Login (bas de page)
  alreadyHaveAccount: string;
  loginCta: string;
  // Footer
  footerCgu: string;
  footerPrivacy: string;
  footerLegal: string;
  // Statuts SIRET (helper)
  siretCheckingSirene: string;   // « Vérification auprès du référentiel Sirene… »
  siretCheckingBce: string;      // « Vérification auprès du registre BCE… »
  siretCheckingFormat: string;   // « Vérification du format et de l'unicité… »
  siretRecognized: (name: string) => string;
  siretValid: (idName: string) => string;
  siretFormatNumeric: (digits: number) => string;
  siretFormatAlphanumeric: (placeholder: string) => string;
  siretChecksumFr: string;
  siretChecksumBe: string;
  siretChecksumGeneric: string;
  siretNotFound: string;
  siretClosed: string;
  siretAlreadyUsed: string;
  siretInvalid: string;
  // Statuts email (helper)
  emailChecking: string;
  emailAvailable: string;
  emailTaken: string;
  emailInvalid: string;
  // Statuts slug (helper)
  slugChecking: string;
  slugAvailable: (slug: string) => string;
  slugTaken: string;
  slugReserved: string;
  slugInvalid: string;
  slugInconclusive: string;
  // Erreurs submit
  errTooManyRequests: string;
  errCancelledReactivatable: string;
  errSignupFailed: string;
  // Message support interne (envoyé au backend — voir contrainte : reste FR métier)
  // Libellés des pays + champ identifiant (dépendant du pays)
  countries: Record<CountryCode, CountryStrings>;
}

const FR: Dict = {
  alreadyRegistered: 'Déjà inscrit ?',
  loginArrow: 'Se connecter →',
  titleCreate: 'Créer mon compte',
  titleTrial: 'Démarrer mon essai gratuit',
  subtitleFromPricing: "Étape 1 sur 2 — 30 jours gratuits sans CB. Votre moyen de paiement sera pré-enregistré à l'étape suivante (aucun débit avant la fin de l'essai).",
  subtitleTrialPrefix: '30 jours, sans carte bancaire',
  trustNoCard: '✓ Sans carte bancaire',
  trustHostedFr: '🛡️ Données hébergées en France',
  choosePlan: 'Choisissez votre formule',
  planHint: "30 jours d'essai gratuit sans carte bancaire. Vous pourrez comparer les détails des packs et activer des modules plus tard depuis « Mon abonnement ».",
  yourCompany: 'Votre entreprise',
  yourAdminAccount: 'Votre compte administrateur',
  countryLabel: "Pays de l'entreprise",
  idOneTrial: 'Un seul essai gratuit par numéro.',
  officialAddress: 'Adresse officielle',
  emailLabel: 'Adresse email',
  emailPlaceholder: 'vous@entreprise.com',
  emailHelperDefault: 'Un code à 6 chiffres vous sera envoyé pour confirmer votre inscription.',
  companyLabel: "Nom de l'entreprise",
  companyPlaceholder: 'Raison sociale',
  companyHelper: "Auto-rempli depuis l'API officielle quand l'identifiant est reconnu.",
  sectorLabel: "Secteur d'activité",
  sectorPlaceholder: 'Ex : Conseil en gestion, BTP, Restauration…',
  slugLabel: 'Adresse de votre espace',
  slugPlaceholder: 'votre-slug',
  slugFallback: 'votre-slug',
  firstNameLabel: 'Prénom',
  firstNamePlaceholder: 'Prénom',
  lastNameLabel: 'Nom',
  lastNamePlaceholder: 'Nom de famille',
  passwordLabel: 'Mot de passe',
  passwordPlaceholder: '8 caractères minimum',
  pwRuleLen: '8 caractères minimum',
  pwRuleUpper: '1 majuscule (recommandé)',
  pwRuleSpecial: '1 caractère spécial (recommandé)',
  captchaLabel: 'Vérification anti-robot',
  captchaSub: 'Anti-robot',
  captchaPlaceholder: 'Votre réponse',
  captchaRefreshTitle: 'Nouvelle question',
  termsAcceptPrefix: "J'accepte les",
  termsLinkCgu: "Conditions Générales d'Utilisation du service",
  termsAnd: 'et la',
  termsLinkPrivacy: 'Politique de Confidentialité',
  termsOf: 'de Concorde Workforce.',
  submitCreating: 'Création de votre espace…',
  submitContinuePayment: 'Continuer vers le paiement →',
  submitStartTrial: 'Démarrer mon essai gratuit →',
  submitSubNote: "Aucune carte bancaire requise · La facturation démarre après l'essai",
  alreadyHaveAccount: 'Vous avez déjà un compte ?',
  loginCta: 'Se connecter',
  footerCgu: "Conditions Générales d'Utilisation",
  footerPrivacy: 'Politique de Confidentialité',
  footerLegal: 'Mentions Légales',
  siretCheckingSirene: 'Vérification auprès du référentiel Sirene…',
  siretCheckingBce: 'Vérification auprès du registre BCE…',
  siretCheckingFormat: "Vérification du format et de l'unicité…",
  siretRecognized: (name) => `Entreprise reconnue : ${name}.`,
  siretValid: (idName) => `${idName} valide.`,
  siretFormatNumeric: (digits) => `Le numéro doit contenir ${digits} chiffres.`,
  siretFormatAlphanumeric: (placeholder) => `Format invalide. Attendu : ${placeholder}.`,
  siretChecksumFr: 'Numéro invalide (clé de contrôle SIRET).',
  siretChecksumBe: 'Numéro invalide (clé de contrôle mod 97).',
  siretChecksumGeneric: 'Numéro invalide (clé de contrôle ).',
  siretNotFound: 'Aucune entreprise enregistrée pour ce numéro dans le référentiel.',
  siretClosed: 'Cet établissement est administrativement fermé.',
  siretAlreadyUsed: "Un compte existe déjà pour ce numéro. Connectez-vous depuis l'écran de login.",
  siretInvalid: 'Numéro non valide.',
  emailChecking: 'Vérification…',
  emailAvailable: 'Email disponible.',
  emailTaken: 'Cet email est déjà utilisé.',
  emailInvalid: "Format d'email invalide.",
  slugChecking: 'Vérification…',
  slugAvailable: (slug) => `${slug}.concorde.com est disponible.`,
  slugTaken: 'Ce slug est déjà utilisé.',
  slugReserved: 'Ce slug est réservé.',
  slugInvalid: '3 à 30 caractères : a-z, 0-9, tirets. Ne pas commencer/finir par tiret.',
  slugInconclusive: 'Vérification non concluante — le serveur tranchera à la soumission.',
  errTooManyRequests: 'Trop de requêtes. Veuillez réessayer dans quelques instants.',
  errCancelledReactivatable: 'Votre compte a été résilié. Connectez-vous pour le réactiver et reprendre votre abonnement (vos données sont conservées 90 jours).',
  errSignupFailed: 'Inscription échouée. Réessayez.',
  countries: {
    FR: {
      label: 'France',
      idLabel: "SIRET de l'entreprise",
      idPlaceholder: '14 chiffres — ex. 123 456 789 00012',
      idHelper: 'Vérifié contre le référentiel Sirene (API gouvernementale).',
    },
    BE: {
      label: 'Belgique',
      idLabel: 'Numéro BCE (Banque-Carrefour des Entreprises)',
      idPlaceholder: '10 chiffres — ex. 0123456789',
      idHelper: 'Vérifié contre le registre BCE (cbeapi.be) + clé de contrôle mod 97.',
    },
    MA: {
      label: 'Maroc',
      idLabel: "ICE (Identifiant Commun de l'Entreprise)",
      idPlaceholder: '15 chiffres — ex. 001234567000089',
      idHelper: "Validation du format uniquement (15 chiffres). Aucune API publique fiable n'est disponible côté DGI.",
    },
    SN: {
      label: 'Sénégal',
      idLabel: "NINEA (Numéro d'Identification Nationale)",
      idPlaceholder: '9 chiffres — ex. 123456789',
      idHelper: "Validation du format uniquement (9 chiffres). Aucune API publique n'est disponible côté ADEPME.",
    },
    TN: {
      label: 'Tunisie',
      idLabel: 'Matricule Fiscal',
      idPlaceholder: 'ex. 1234567A (court) ou 1234567AAM001 (complet)',
      idHelper: 'Format DGI : 7 chiffres + 1 lettre clé, suivis optionnellement des codes TVA/catégorie/établissement. Aucune API publique disponible.',
    },
  },
};

const EN: Dict = {
  alreadyRegistered: 'Already registered?',
  loginArrow: 'Sign in →',
  titleCreate: 'Create my account',
  titleTrial: 'Start my free trial',
  subtitleFromPricing: 'Step 1 of 2 — 30 days free, no credit card. Your payment method will be pre-registered in the next step (no charge before the end of the trial).',
  subtitleTrialPrefix: '30 days, no credit card',
  trustNoCard: '✓ No credit card',
  trustHostedFr: '🛡️ Data hosted in France',
  choosePlan: 'Choose your plan',
  planHint: 'A 30-day free trial with no credit card. You can compare plan details and enable modules later from "My subscription".',
  yourCompany: 'Your company',
  yourAdminAccount: 'Your administrator account',
  countryLabel: 'Company country',
  idOneTrial: 'One free trial per number.',
  officialAddress: 'Official address',
  emailLabel: 'Email address',
  emailPlaceholder: 'you@company.com',
  emailHelperDefault: 'A 6-digit code will be sent to you to confirm your registration.',
  companyLabel: 'Company name',
  companyPlaceholder: 'Legal name',
  companyHelper: 'Auto-filled from the official API when the identifier is recognized.',
  sectorLabel: 'Industry',
  sectorPlaceholder: 'E.g.: Management consulting, Construction, Catering…',
  slugLabel: 'Your workspace address',
  slugPlaceholder: 'your-slug',
  slugFallback: 'your-slug',
  firstNameLabel: 'First name',
  firstNamePlaceholder: 'First name',
  lastNameLabel: 'Last name',
  lastNamePlaceholder: 'Last name',
  passwordLabel: 'Password',
  passwordPlaceholder: 'At least 8 characters',
  pwRuleLen: 'At least 8 characters',
  pwRuleUpper: '1 uppercase letter (recommended)',
  pwRuleSpecial: '1 special character (recommended)',
  captchaLabel: 'Anti-bot verification',
  captchaSub: 'Anti-bot',
  captchaPlaceholder: 'Your answer',
  captchaRefreshTitle: 'New question',
  termsAcceptPrefix: 'I accept the',
  termsLinkCgu: "service's Terms of Use",
  termsAnd: 'and the',
  termsLinkPrivacy: 'Privacy Policy',
  termsOf: 'of Concorde Workforce.',
  submitCreating: 'Creating your workspace…',
  submitContinuePayment: 'Continue to payment →',
  submitStartTrial: 'Start my free trial →',
  submitSubNote: 'No credit card required · Billing starts after the trial',
  alreadyHaveAccount: 'Already have an account?',
  loginCta: 'Sign in',
  footerCgu: 'Terms of Use',
  footerPrivacy: 'Privacy Policy',
  footerLegal: 'Legal Notice',
  siretCheckingSirene: 'Checking against the Sirene registry…',
  siretCheckingBce: 'Checking against the BCE registry…',
  siretCheckingFormat: 'Checking format and uniqueness…',
  siretRecognized: (name) => `Company recognized: ${name}.`,
  siretValid: (idName) => `${idName} valid.`,
  siretFormatNumeric: (digits) => `The number must contain ${digits} digits.`,
  siretFormatAlphanumeric: (placeholder) => `Invalid format. Expected: ${placeholder}.`,
  siretChecksumFr: 'Invalid number (SIRET check digit).',
  siretChecksumBe: 'Invalid number (mod 97 check digit).',
  siretChecksumGeneric: 'Invalid number (check digit ).',
  siretNotFound: 'No company registered for this number in the registry.',
  siretClosed: 'This establishment is administratively closed.',
  siretAlreadyUsed: 'An account already exists for this number. Sign in from the login screen.',
  siretInvalid: 'Invalid number.',
  emailChecking: 'Checking…',
  emailAvailable: 'Email available.',
  emailTaken: 'This email is already in use.',
  emailInvalid: 'Invalid email format.',
  slugChecking: 'Checking…',
  slugAvailable: (slug) => `${slug}.concorde.com is available.`,
  slugTaken: 'This slug is already in use.',
  slugReserved: 'This slug is reserved.',
  slugInvalid: '3 to 30 characters: a-z, 0-9, hyphens. Must not start/end with a hyphen.',
  slugInconclusive: 'Inconclusive check — the server will decide on submission.',
  errTooManyRequests: 'Too many requests. Please try again in a few moments.',
  errCancelledReactivatable: 'Your account was cancelled. Sign in to reactivate it and resume your subscription (your data is kept for 90 days).',
  errSignupFailed: 'Signup failed. Please try again.',
  countries: {
    FR: {
      label: 'France',
      idLabel: 'Company SIRET',
      idPlaceholder: '14 digits — e.g. 123 456 789 00012',
      idHelper: 'Verified against the Sirene registry (government API).',
    },
    BE: {
      label: 'Belgium',
      idLabel: 'BCE number (Crossroads Bank for Enterprises)',
      idPlaceholder: '10 digits — e.g. 0123456789',
      idHelper: 'Verified against the BCE registry (cbeapi.be) + mod 97 check digit.',
    },
    MA: {
      label: 'Morocco',
      idLabel: 'ICE (Common Company Identifier)',
      idPlaceholder: '15 digits — e.g. 001234567000089',
      idHelper: 'Format validation only (15 digits). No reliable public API is available from the DGI.',
    },
    SN: {
      label: 'Senegal',
      idLabel: 'NINEA (National Identification Number)',
      idPlaceholder: '9 digits — e.g. 123456789',
      idHelper: 'Format validation only (9 digits). No public API is available from ADEPME.',
    },
    TN: {
      label: 'Tunisia',
      idLabel: 'Tax ID (Matricule Fiscal)',
      idPlaceholder: 'e.g. 1234567A (short) or 1234567AAM001 (full)',
      idHelper: 'DGI format: 7 digits + 1 key letter, optionally followed by VAT/category/establishment codes. No public API available.',
    },
  },
};

const LANG: Record<Lang, Dict> = { fr: FR, en: EN };

function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 30);
}

export default function SignupPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { refreshAuth } = useAuth();
  const { i18n } = useTranslation();
  const lang: Lang = i18n.language === 'en' ? 'en' : 'fr';
  const d = LANG[lang];
  const planFromPricing = (location.state as any) ?? null;

  const [companyName, setCompanyName] = useState('');
  const [slug, setSlug] = useState('');
  const [slugTouched, setSlugTouched] = useState(false);
  const [slugStatus, setSlugStatus] = useState<SlugStatus>('idle');
  const [termsAccepted, setTermsAccepted] = useState(false);

  // Pays de l'entreprise. Détermine le format de l'ID demandé (SIRET FR, BCE BE,
  // ICE MA, NINEA SN). Default FR — cohérent avec le marché commercial principal.
  const [country, setCountry] = useState<CountryCode>('FR');
  const countryConfig = COUNTRY_CONFIG[country];

  // Identifiant entreprise. Validé selon le pays sélectionné — quand le user change
  // de pays, on reset l'ID et son statut pour éviter d'afficher une validation
  // périmée (ex: SIRET FR valide affiché comme valide après bascule sur la Belgique).
  const [siret, setSiret] = useState('');
  const [siretStatus, setSiretStatus] = useState<SiretStatus>('idle');
  const [siretCompanyName, setSiretCompanyName] = useState<string | null>(null);
  // Adresse récupérée de l'API officielle (Sirene FR / cbeapi.be BE). Pour MA/SN où
  // aucune API publique n'existe, reste null — l'utilisateur ne voit pas la zone.
  const [siretCompanyAddress, setSiretCompanyAddress] = useState<string | null>(null);
  // True quand l'auto-fill a déjà été appliqué : permet à l'utilisateur de surcharger
  // le nom proposé sans qu'on l'écrase à chaque re-validation du SIRET.
  const [companyNameAutofilled, setCompanyNameAutofilled] = useState(false);
  // Secteur d'activité (2026-05-27) : pré-rempli depuis Sirene FR (libellé NAF) ou
  // BCE BE (libellé NACE) quand l'API renvoie l'info. Pour les autres pays
  // (MA/SN/TN sans API publique), l'utilisateur saisit manuellement.
  const [activitySector, setActivitySector] = useState('');
  const [activitySectorAutofilled, setActivitySectorAutofilled] = useState(false);

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [emailStatus, setEmailStatus] = useState<EmailStatus>('idle');
  const [password, setPassword] = useState('');

  // Sélection du pack + cycle + modules optionnels. Pré-rempli depuis planFromPricing
  // si l'utilisateur vient de la pricing page ; sinon défauts commerciaux (Standard +
  // annuel = mid-tier + meilleur ratio prix/engagement). Le pack choisi est posé sur
  // Tenant.PlanCode au signup et drive planFeatures via /me — la sélection ouvre donc
  // immédiatement les bons modules pendant l'essai 30j. Les addons sont parqués en
  // sessionStorage pour pré-cocher le Stripe Checkout déclenché plus tard depuis
  // /mon-abonnement (la facturation des addons n'est pas active pendant l'essai).
  const [pickerPlan, setPickerPlan] = useState<PlanKey>(
    (planFromPricing?.plan as PlanKey) ?? 'Standard'
  );
  // 2026-05-29 — Le signup ne propose plus QUE le choix du nom de pack. Le cycle
  // n'est plus sélectionnable ici (pré-réglé : annuel par défaut ou hérité de la
  // pricing page) et les modules/addons se gèrent ensuite depuis « Mon abonnement ».
  // On conserve ces valeurs pour garder le payload POST /signup strictement inchangé.
  const [pickerCycle] = useState<Cycle>(
    (planFromPricing?.cycle as Cycle) ?? 'annual'
  );
  const pickerAddons: AddonKey[] = [];

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Captcha anti-bot (cf. GET /api/signup/captcha). Stocké côté serveur 5 min en
  // mémoire (IMemoryCache), single-use. On (re)charge le challenge à l'arrivée + sur
  // bouton refresh ; le frontend envoie {challengeId, answer} avec le POST signup.
  const [captchaQuestion, setCaptchaQuestion] = useState<string>('');
  const [captchaChallengeId, setCaptchaChallengeId] = useState<string>('');
  const [captchaAnswer, setCaptchaAnswer] = useState<string>('');
  const refreshCaptcha = async () => {
    try {
      const { data } = await apiInstance.get('/signup/captcha');
      setCaptchaQuestion(data?.question ?? '');
      setCaptchaChallengeId(data?.challengeId ?? '');
      setCaptchaAnswer('');
    } catch {
      // Échec réseau : on laisse les champs vides, le submit échouera proprement.
    }
  };
  useEffect(() => { refreshCaptcha(); }, []);

  // Quand l'utilisateur change de pays : reset complet de l'ID. Sinon un SIRET FR
  // validé resterait marqué "available" même après bascule vers la Belgique alors
  // qu'il ne correspondrait plus au format BCE 10 chiffres.
  useEffect(() => {
    setSiret('');
    setSiretStatus('idle');
    setSiretCompanyName(null);
    setSiretCompanyAddress(null);
    setCompanyNameAutofilled(false);
    // Reset secteur d'activité aussi : il avait été pré-rempli depuis l'API du
    // pays précédent. Sinon un libellé NAF français resterait après bascule vers
    // un autre pays où NAF est étranger.
    setActivitySector('');
    setActivitySectorAutofilled(false);
  }, [country]);

  // Auto-suggère un slug à partir du nom de société tant que l'utilisateur ne l'a pas modifié.
  useEffect(() => {
    if (!slugTouched) {
      setSlug(slugify(companyName));
    }
  }, [companyName, slugTouched]);

  // Debounced slug availability check (300ms) avec timeout 4s pour ne pas bloquer
  // l'utilisateur si l'API est lente. Le backend re-valide de toute façon à la soumission.
  useEffect(() => {
    if (!slug) { setSlugStatus('idle'); return; }
    if (!SLUG_REGEX.test(slug)) { setSlugStatus('invalid'); return; }

    setSlugStatus('checking');
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000);

    const handle = setTimeout(async () => {
      try {
        const { data } = await apiInstance.get(`/signup/check-slug`, {
          params: { slug },
          signal: controller.signal,
        });
        clearTimeout(timeoutId);
        if (data.available) setSlugStatus('available');
        else if (data.reason === 'reserved') setSlugStatus('reserved');
        else if (data.reason === 'format') setSlugStatus('invalid');
        else setSlugStatus('taken');
      } catch {
        clearTimeout(timeoutId);
        // Timeout / réseau / 5xx : on retombe en 'idle' au lieu de bloquer la soumission.
        // Le backend revalidera à l'envoi du formulaire.
        setSlugStatus('idle');
      }
    }, 300);
    return () => {
      clearTimeout(handle);
      clearTimeout(timeoutId);
      controller.abort();
    };
  }, [slug]);

  // Pendant unique, debounced 300ms : vérifie que l'email n'est pas déjà rattaché
  // à un autre compte du système (TenantEmailIndex en master).
  useEffect(() => {
    const trimmed = email.trim();
    if (!trimmed) { setEmailStatus('idle'); return; }
    if (!EMAIL_REGEX.test(trimmed)) { setEmailStatus('invalid'); return; }

    setEmailStatus('checking');
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000);

    const handle = setTimeout(async () => {
      try {
        const { data } = await apiInstance.get(`/signup/check-email`, {
          params: { email: trimmed },
          signal: controller.signal,
        });
        clearTimeout(timeoutId);
        if (data.available) setEmailStatus('available');
        else if (data.reason === 'format') setEmailStatus('invalid');
        else setEmailStatus('taken');
      } catch {
        clearTimeout(timeoutId);
        setEmailStatus('idle');
      }
    }, 300);
    return () => {
      clearTimeout(handle);
      clearTimeout(timeoutId);
      controller.abort();
    };
  }, [email]);

  // Normalisation de l'ID selon le pays : pour FR/BE/MA/SN on garde uniquement les
  // chiffres. Pour TN (alphanumérique) on garde chiffres + lettres et on uppercase
  // pour matcher l'index unique côté DB qui est case-sensitive.
  const normalizeSiret = (raw: string): string => {
    if (countryConfig.idAlphanumeric) {
      return raw.replace(/[^0-9A-Za-z]/g, '').toUpperCase();
    }
    return raw.replace(/\D/g, '');
  };

  // Debounced validation de l'identifiant entreprise. Le format attendu varie selon
  // le pays (countryConfig.idDigits + idRegex optionnel). Le backend valide en deux
  // temps : format + (pour FR) appel API Sirene. Pour BE on a un checksum local ;
  // MA/SN/TN sont format-only. Timeout 6s — adapté au pire cas (API Sirene lente).
  useEffect(() => {
    const normalized = normalizeSiret(siret);
    if (!normalized) { setSiretStatus('idle'); setSiretCompanyName(null); setSiretCompanyAddress(null); return; }
    // Pour les ID numériques on garde le check de longueur exacte. Pour les ID
    // alphanumériques (TN), on délègue 100% à la regex personnalisée qui couvre la
    // forme courte ET les formes longues.
    const formatOk = countryConfig.idRegex
      ? countryConfig.idRegex.test(normalized)
      : normalized.length === countryConfig.idDigits;
    if (!formatOk) {
      setSiretStatus('format');
      setSiretCompanyName(null);
      setSiretCompanyAddress(null);
      return;
    }

    setSiretStatus('checking');
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);

    const handle = setTimeout(async () => {
      try {
        const { data } = await apiInstance.get('/signup/check-siret', {
          params: { siret: normalized, country: countryConfig.code },
          signal: controller.signal,
        });
        clearTimeout(timeoutId);
        if (data.available) {
          setSiretStatus('available');
          setSiretCompanyName(data.companyName ?? null);
          setSiretCompanyAddress(data.companyAddress ?? null);
          // Auto-fill : on ne remplit le nom de société que s'il est vide OU qu'on
          // n'a pas encore appliqué l'auto-fill pour cette session. L'utilisateur
          // peut ensuite éditer sans qu'on écrase à chaque re-validation du SIRET.
          if (data.companyName && (!companyName.trim() || !companyNameAutofilled)) {
            setCompanyName(data.companyName);
            setCompanyNameAutofilled(true);
          }
          // Auto-fill secteur d'activité : même logique que companyName.
          // L'utilisateur peut surcharger sans qu'on l'écrase à chaque re-validation.
          if (data.activitySector && (!activitySector.trim() || !activitySectorAutofilled)) {
            setActivitySector(String(data.activitySector));
            setActivitySectorAutofilled(true);
          }
        } else {
          // Mapping des codes serveur vers les statuts locaux pour le helper text.
          const reason = data.reason as string | undefined;
          if (reason === 'siret_format') setSiretStatus('format');
          else if (reason === 'siret_checksum') setSiretStatus('checksum');
          else if (reason === 'siret_not_found') setSiretStatus('not_found');
          else if (reason === 'siret_closed') setSiretStatus('closed');
          else if (reason === 'siret_already_used') setSiretStatus('already_used');
          else setSiretStatus('invalid');
          setSiretCompanyName(null);
          setSiretCompanyAddress(null);
        }
      } catch {
        clearTimeout(timeoutId);
        // Timeout/réseau : on retombe en idle ; le backend re-valide à la soumission
        // (et bénéficiera de la contrainte unique côté DB en garde-fou).
        setSiretStatus('idle');
      }
    }, 400);
    return () => {
      clearTimeout(handle);
      clearTimeout(timeoutId);
      controller.abort();
    };
  }, [siret, countryConfig.idDigits, countryConfig.code, countryConfig.idAlphanumeric, countryConfig.idRegex]);

  const siretHelper = useMemo(() => {
    // Messages cohérents avec le pays : on remplace "SIRET" par le nom métier de l'ID
    // selon le pays sélectionné, et on adapte "API Sirene" quand l'API n'est pas FR.
    const idName = d.countries[country].idLabel.split(' ')[0]; // "SIRET" / "Numéro" / "ICE" / "NINEA" / "Matricule"
    // Source de vérification dépend du pays : Sirene pour FR, cbeapi.be pour BE, sinon format local.
    const checkingText =
      country === 'FR' ? d.siretCheckingSirene :
        country === 'BE' ? d.siretCheckingBce :
          d.siretCheckingFormat;
    // Message d'erreur format adapté : pour TN (alphanumérique) on évite "doit contenir N chiffres"
    // qui est faux ; on renvoie sur le placeholder/helper qui décrit le format DGI.
    const formatErrorText = countryConfig.idAlphanumeric
      ? d.siretFormatAlphanumeric(d.countries[country].idPlaceholder)
      : d.siretFormatNumeric(countryConfig.idDigits);
    switch (siretStatus) {
      case 'checking': return { color: 'info' as const, text: checkingText };
      case 'available': return {
        color: 'success' as const,
        text: siretCompanyName ? d.siretRecognized(siretCompanyName) : d.siretValid(idName),
      };
      case 'format': return { color: 'error' as const, text: formatErrorText };
      case 'checksum': return { color: 'error' as const, text: country === 'FR' ? d.siretChecksumFr : country === 'BE' ? d.siretChecksumBe : d.siretChecksumGeneric };
      case 'not_found': return { color: 'error' as const, text: d.siretNotFound };
      case 'closed': return { color: 'error' as const, text: d.siretClosed };
      case 'already_used': return {
        color: 'error' as const,
        text: d.siretAlreadyUsed,
      };
      case 'invalid': return { color: 'error' as const, text: d.siretInvalid };
      default: return null;
    }
  }, [siretStatus, siretCompanyName, country, countryConfig, d]);

  const emailHelper = useMemo(() => {
    switch (emailStatus) {
      case 'checking': return { color: 'info' as const, text: d.emailChecking };
      case 'available': return { color: 'success' as const, text: d.emailAvailable };
      case 'taken': return { color: 'error' as const, text: d.emailTaken };
      case 'invalid': return { color: 'error' as const, text: d.emailInvalid };
      default: return null;
    }
  }, [emailStatus, d]);

  const slugHelper = useMemo(() => {
    switch (slugStatus) {
      case 'checking': return { color: 'info' as const, text: d.slugChecking };
      case 'available': return { color: 'success' as const, text: d.slugAvailable(slug) };
      case 'taken': return { color: 'error' as const, text: d.slugTaken };
      case 'reserved': return { color: 'error' as const, text: d.slugReserved };
      case 'invalid': return { color: 'error' as const, text: d.slugInvalid };
      case 'idle': return SLUG_REGEX.test(slug)
        ? { color: 'warning' as const, text: d.slugInconclusive }
        : null;
      default: return null;
    }
  }, [slug, slugStatus, d]);

  // Critères de mot de passe (affichage). Le minimum bloquant reste 8 caractères
  // (cf. canSubmit). Majuscule / caractère spécial sont des recommandations guidées.
  const pwOkLen = password.length >= 8;
  const pwOkUpper = /[A-Z]/.test(password);
  const pwOkSpecial = /[^A-Za-z0-9]/.test(password);

  // Le bouton est actif dès que le format du slug est correct et qu'il n'est pas
  // explicitement connu comme pris/réservé. L'attente d'un "available" formel
  // n'est pas exigée (la vérif backend reste l'autorité finale).
  const slugAccepted = SLUG_REGEX.test(slug)
    && slugStatus !== 'taken'
    && slugStatus !== 'reserved'
    && slugStatus !== 'invalid';

  // L'ID entreprise est obligatoire (anti-fraude). Format exigé selon le pays
  // (countryConfig.idDigits + idRegex optionnel pour les ID alphanumériques) ;
  // on ne bloque pas sur 'checking' ou 'idle' pour permettre la soumission si
  // l'API Sirene FR est lente (le backend re-valide de toute façon et la
  // contrainte unique en DB protège en dernier recours).
  const siretFormatOk = (() => {
    const normalized = normalizeSiret(siret);
    if (countryConfig.idRegex) return countryConfig.idRegex.test(normalized);
    return normalized.length === countryConfig.idDigits && /^\d+$/.test(normalized);
  })();
  const siretAccepted =
    siretFormatOk &&
    siretStatus !== 'format' &&
    siretStatus !== 'checksum' &&
    siretStatus !== 'not_found' &&
    siretStatus !== 'closed' &&
    siretStatus !== 'already_used' &&
    siretStatus !== 'invalid';

  const submit = async () => {
    setError(null);
    setSubmitting(true);
    try {
      // V3 : tous les packs incluent 30 jours d'essai sans CB → on n'envoie plus
      // requiresPayment=true (le backend ignore la valeur de toute façon). On
      // garde le champ dans le payload pour compat API. La détection "l'utilisateur
      // vient de PlanConfiguration" se fait désormais sur plan + userCount.
      const requiresPayment = false;
      await apiInstance.post('/signup', {
        slug,
        companyName: companyName.trim(),
        siret: normalizeSiret(siret),
        country,
        // 2026-05-27 — Secteur d'activité : pré-rempli depuis Sirene/BCE quand
        // l'API a renvoyé l'info, sinon saisi manuellement. Null si vide (le
        // backend NormalizeActivitySector trime + clamp 200 chars).
        activitySector: activitySector.trim() || null,
        adminFirstName: firstName.trim(),
        adminLastName: lastName.trim(),
        adminEmail: email.trim(),
        adminPassword: password,
        // Pack + cycle : pris dans le PlanPicker (lui-même pré-rempli depuis
        // planFromPricing si l'utilisateur vient de la pricing page). Garantit que
        // tenant.PlanCode est toujours posé → planFeatures côté /me reflète le bon
        // pack dès la première seconde de l'essai.
        planCode: pickerPlan,
        billingCycle: pickerCycle,
        // 2026-05-26 — Addons cochés dans le PlanPicker sont désormais persistés
        // sur Tenant.Addons côté backend. Combinés avec PlanFeatures dans
        // PlanCatalog.GetEffectiveFeatures pour débloquer les modules dès la 1ʳᵉ
        // seconde de l'essai (ex. Starter + signatureElectronique → ElectronicSignature=true
        // dans /me sans changer de pack).
        addons: pickerAddons,
        requiresPayment,
        captchaChallengeId,
        captchaAnswer: captchaAnswer === '' ? null : Number(captchaAnswer),
      });
      // On stocke le slug en localStorage pour que apiInstance l'injecte automatiquement
      // dans le header X-Tenant-Slug. Indispensable tant que le déploiement n'a pas
      // de wildcard DNS/SSL pour les sous-domaines (acme.concorde-work-force.com).
      localStorage.setItem('tenantSlug', slug);
      // Recharge le contexte d'auth maintenant que les cookies JWT du nouveau tenant sont posés
      // ET que tenantSlug est en localStorage : /me ira chercher l'admin dans la base du tenant.
      await refreshAuth();
      // Notify internal contact that user accepted terms
      try {
        await sendSupportMessage({
          name: `${firstName.trim()} ${lastName.trim()}`,
          email: email.trim(),
          subject: 'Nouvel utilisateur a accepté les conditions',
          message: `L'utilisateur ${email.trim()} a accepté les conditions générales et la politique de confidentialité lors de son inscription.`,
        });
      } catch (e) {
        console.error('Failed to send confirmation email to internal contact', e);
      }
      // Politique 2026-05 : tous les nouveaux comptes passent par l'écran de vérification
      // email AVANT toute autre étape. Le code OTP a été envoyé par /api/signup dans
      // l'email de bienvenue. Pour les visiteurs venant de PlanConfiguration (avec
      // plan + userCount), on stocke l'intention de checkout en sessionStorage pour
      // que VerifyEmailPage déclenche Stripe automatiquement après vérification réussie.
      if (planFromPricing?.plan && planFromPricing?.userCount) {
        sessionStorage.setItem('pendingStripeCheckout', JSON.stringify({
          plan: pickerPlan,
          cycle: pickerCycle,
          userCount: planFromPricing.userCount,
          addons: pickerAddons,
        }));
      }
      // Parking des addons sélectionnés (toujours, même hors PlanConfiguration) — lus
      // plus tard par /mon-abonnement pour pré-cocher la session Stripe Checkout quand
      // l'utilisateur décide d'activer son abonnement à la fin de l'essai 30j.
      if (pickerAddons.length > 0) {
        sessionStorage.setItem('signupAddons', JSON.stringify(pickerAddons));
      }
      // After successful signup, redirect to email verification page
      navigate('/verify-email', { state: { email: email.trim() } });
    } catch (e: any) {
      // Handle specific error codes
      if (e?.response?.status === 429) {
        setError(d.errTooManyRequests);
        // Optional: could implement exponential backoff retry here.
      } else if (e?.response?.data?.code === 'cancelled_account_reactivatable') {
        const cancelledSlug = e?.response?.data?.slug;
        if (cancelledSlug) localStorage.setItem('tenantSlug', cancelledSlug);
        navigate('/login', {
          state: {
            email: email.trim(),
            notice: d.errCancelledReactivatable,
          },
        });
        return;
      } else {
        const msg = e?.response?.data?.error || e?.response?.data?.detail || d.errSignupFailed;
        setError(msg);
      }
      // Captcha invalide → on régénère un nouveau challenge pour la prochaine tentative.
      if (e?.response?.data?.code === 'captcha_failed') {
        await refreshCaptcha();
      }
    } finally {
      setSubmitting(false);
    }
  };

  const canSubmit =
    !submitting &&
    companyName.trim().length >= 2 &&
    slugAccepted &&
    siretAccepted &&
    firstName.trim().length > 0 &&
    lastName.trim().length > 0 &&
    /.+@.+\..+/.test(email) &&
    emailStatus !== 'taken' &&
    emailStatus !== 'invalid' &&
    password.length >= 8 &&
    captchaChallengeId.length > 0 &&
    captchaAnswer.trim() !== '' &&
    termsAccepted;

  // Indicateur de statut (✓ / ✗ / ⏳) affiché à droite d'un champ vérifié async.
  const renderStatus = (status: SlugStatus | EmailStatus | SiretStatus) => {
    if (status === 'checking') return <span className="signup-input-status loading">⏳</span>;
    if (status === 'available') return <span className="signup-input-status valid">✓</span>;
    const errStates = ['taken', 'invalid', 'format', 'checksum', 'not_found', 'closed', 'already_used', 'reserved'];
    if (errStates.includes(status)) return <span className="signup-input-status invalid">✗</span>;
    return null;
  };

  const hintClass = (color?: string) =>
    color === 'error' ? 'signup-field-hint error'
      : color === 'success' ? 'signup-field-hint success'
        : 'signup-field-hint';

  const fromPricing = Boolean(planFromPricing?.plan && planFromPricing?.userCount);

  return (
    <div className="signup-root">
      {/* NAV */}
      <nav className="signup-nav">
        <a href="https://concorde-work-force.com" className="signup-nav-logo">
          <span className="signup-logo-mark">CW</span>
          Concorde Workforce
        </a>
        <span
          className="signup-nav-login"
          role="link"
          tabIndex={0}
          onClick={() => navigate('/login')}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') navigate('/login'); }}
        >
          {d.alreadyRegistered} <span>{d.loginArrow}</span>
        </span>
      </nav>

      {/* PAGE */}
      <main className="signup-main">
        <div className="signup-card">
          {/* HEADER */}
          <div className="signup-card-header">
            <h1 className="signup-card-title">
              {fromPricing ? d.titleCreate : d.titleTrial}
            </h1>
            <p className="signup-card-subtitle">
              {fromPricing ? (
                <>{d.subtitleFromPricing}</>
              ) : (
                <><strong>{d.subtitleTrialPrefix}</strong> — Concorde Workforce</>
              )}
            </p>
            <div className="signup-trust-pills">
              <div className="signup-trust-pill">{d.trustNoCard}</div>
              <div className="signup-trust-pill">{d.trustHostedFr}</div>
            </div>
          </div>

          <div className="signup-divider" />

          {/* FORM */}
          <form
            className="signup-form"
            noValidate
            onSubmit={(e) => { e.preventDefault(); if (canSubmit) submit(); }}
          >
            {/* Formule — choix du pack (Starter/Standard/Premium). Pose Tenant.PlanCode
                au signup et débloque les modules via /me pendant l'essai 30j. */}
            <div className="signup-section-label">{d.choosePlan}</div>
            <div className="signup-plan-group">
              {(['Starter', 'Standard', 'Premium'] as PlanKey[]).map((p) => (
                <button
                  type="button"
                  key={p}
                  className={`signup-plan-btn ${pickerPlan === p ? 'active' : ''}`}
                  onClick={() => setPickerPlan(p)}
                >
                  {p}
                </button>
              ))}
            </div>
            <div className="signup-field-hint">
              {d.planHint}
            </div>

            <div className="signup-divider" style={{ margin: '8px 0' }} />
            <div className="signup-section-label">{d.yourCompany}</div>

            {/* Pays */}
            <div className="signup-field">
              <label className="signup-field-label" htmlFor="su-pays">
                {d.countryLabel} <span className="req">*</span>
              </label>
              <div className="signup-input-wrap">
                <span className="signup-select-flag">{COUNTRY_FLAGS[country]}</span>
                <select
                  id="su-pays"
                  value={country}
                  onChange={(e) => setCountry(e.target.value as CountryCode)}
                >
                  {SUPPORTED_COUNTRIES.map((cc) => (
                    <option key={cc} value={cc}>{d.countries[cc].label}</option>
                  ))}
                </select>
                <span className="signup-select-arrow">⌄</span>
              </div>
            </div>

            {/* ID entreprise */}
            <div className="signup-field">
              <label className="signup-field-label" htmlFor="su-siret">
                {d.countries[country].idLabel} <span className="req">*</span>
              </label>
              <div className="signup-input-wrap">
                <span className="signup-input-icon">🏛️</span>
                <input
                  id="su-siret"
                  type="text"
                  value={siret}
                  placeholder={d.countries[country].idPlaceholder}
                  inputMode={countryConfig.idAlphanumeric ? 'text' : 'numeric'}
                  className={siretStatus === 'available' ? 'valid' : ['format', 'checksum', 'not_found', 'closed', 'already_used', 'invalid'].includes(siretStatus) ? 'invalid' : ''}
                  onChange={(e) => {
                    // Filtre de saisie : on accepte espaces/tirets/points pour confort (variants
                    // de formatage : BCE "0123.456.789", ICE par segments, Matricule Fiscal TN
                    // "1234567/A/M/001"…). Pour les pays alphanumériques (TN), on autorise aussi
                    // les lettres ; sinon chiffres uniquement.
                    const allowed = countryConfig.idAlphanumeric ? /[^0-9A-Za-z\s\-./]/g : /[^0-9\s\-.]/g;
                    const maxLen = countryConfig.idMaxInputLength ?? (countryConfig.idDigits + 6);
                    const cleaned = e.target.value.replace(allowed, '').slice(0, maxLen);
                    setSiret(cleaned);
                  }}
                />
                {renderStatus(siretStatus)}
              </div>
              <div className={hintClass(siretHelper?.color)}>
                {siretHelper ? siretHelper.text : `${d.countries[country].idHelper} ${d.idOneTrial}`}
              </div>
              {/* Adresse récupérée de l'API officielle — affichée en lecture seule pour
                  confirmer visuellement la bonne entreprise. */}
              {siretStatus === 'available' && siretCompanyAddress && (
                <div className="signup-address-box">
                  <span className="signup-address-title">{d.officialAddress}</span>
                  <div className="signup-address-value">{siretCompanyAddress}</div>
                </div>
              )}
            </div>

            {/* Email */}
            <div className="signup-field">
              <label className="signup-field-label" htmlFor="su-email">
                {d.emailLabel} <span className="req">*</span>
              </label>
              <div className="signup-input-wrap">
                <span className="signup-input-icon">✉️</span>
                <input
                  id="su-email"
                  type="email"
                  value={email}
                  placeholder={d.emailPlaceholder}
                  autoComplete="email"
                  className={emailStatus === 'available' ? 'valid' : (emailStatus === 'taken' || emailStatus === 'invalid') ? 'invalid' : ''}
                  onChange={(e) => setEmail(e.target.value)}
                />
                {renderStatus(emailStatus)}
              </div>
              <div className={hintClass(emailHelper?.color)}>
                {emailHelper ? emailHelper.text : d.emailHelperDefault}
              </div>
            </div>

            {/* Nom entreprise */}
            <div className="signup-field">
              <label className="signup-field-label" htmlFor="su-company">
                {d.companyLabel} <span className="req">*</span>
              </label>
              <div className="signup-input-wrap">
                <span className="signup-input-icon">🏢</span>
                <input
                  id="su-company"
                  type="text"
                  value={companyName}
                  placeholder={d.companyPlaceholder}
                  autoComplete="organization"
                  onChange={(e) => setCompanyName(e.target.value)}
                />
              </div>
              <div className="signup-field-hint">{d.companyHelper}</div>
            </div>

            {/* Secteur */}
            <div className="signup-field">
              <label className="signup-field-label" htmlFor="su-sector">{d.sectorLabel}</label>
              <div className="signup-input-wrap">
                <span className="signup-input-icon">🏭</span>
                <input
                  id="su-sector"
                  type="text"
                  value={activitySector}
                  placeholder={d.sectorPlaceholder}
                  onChange={(e) => { setActivitySector(e.target.value); setActivitySectorAutofilled(true); }}
                />
              </div>
            </div>

            {/* Slug */}
            <div className="signup-field">
              <label className="signup-field-label" htmlFor="su-slug">
                {d.slugLabel} <span className="req">*</span>
              </label>
              <div className="signup-input-wrap">
                <span className="signup-input-icon">🔗</span>
                <input
                  id="su-slug"
                  type="text"
                  value={slug}
                  placeholder={d.slugPlaceholder}
                  autoComplete="off"
                  className={slugStatus === 'available' ? 'valid' : (slugStatus === 'taken' || slugStatus === 'reserved' || slugStatus === 'invalid') ? 'invalid' : ''}
                  onChange={(e) => { setSlugTouched(true); setSlug(slugify(e.target.value)); }}
                />
                {renderStatus(slugStatus)}
              </div>
              <div className="signup-slug-preview">https://<span>{slug || d.slugFallback}</span>.concorde.com</div>
              {slugHelper && <div className={hintClass(slugHelper.color)}>{slugHelper.text}</div>}
            </div>

            <div className="signup-divider" style={{ margin: '8px 0' }} />
            <div className="signup-section-label">{d.yourAdminAccount}</div>

            {/* Prénom / Nom */}
            <div className="signup-field-row">
              <div className="signup-field">
                <label className="signup-field-label" htmlFor="su-firstname">{d.firstNameLabel} <span className="req">*</span></label>
                <div className="signup-input-wrap">
                  <span className="signup-input-icon">👤</span>
                  <input id="su-firstname" type="text" value={firstName} placeholder={d.firstNamePlaceholder} autoComplete="given-name" onChange={(e) => setFirstName(e.target.value)} />
                </div>
              </div>
              <div className="signup-field">
                <label className="signup-field-label" htmlFor="su-lastname">{d.lastNameLabel} <span className="req">*</span></label>
                <div className="signup-input-wrap">
                  <span className="signup-input-icon">👤</span>
                  <input id="su-lastname" type="text" value={lastName} placeholder={d.lastNamePlaceholder} autoComplete="family-name" onChange={(e) => setLastName(e.target.value)} />
                </div>
              </div>
            </div>

            {/* Mot de passe */}
            <div className="signup-field">
              <label className="signup-field-label" htmlFor="su-password">{d.passwordLabel} <span className="req">*</span></label>
              <div className="signup-input-wrap">
                <span className="signup-input-icon">🔒</span>
                <input
                  id="su-password"
                  type="password"
                  value={password}
                  placeholder={d.passwordPlaceholder}
                  autoComplete="new-password"
                  className={password ? (pwOkLen ? 'valid' : 'invalid') : ''}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
              <ul className="signup-pw-criteria">
                <li className={`signup-pw-rule ${pwOkLen ? 'valid' : ''}`}><span className="pw-rule-icon" /> {d.pwRuleLen}</li>
                <li className={`signup-pw-rule ${pwOkUpper ? 'valid' : ''}`}><span className="pw-rule-icon" /> {d.pwRuleUpper}</li>
                <li className={`signup-pw-rule ${pwOkSpecial ? 'valid' : ''}`}><span className="pw-rule-icon" /> {d.pwRuleSpecial}</li>
              </ul>
            </div>

            <div className="signup-divider" style={{ margin: '8px 0' }} />

            {/* Captcha */}
            <div className="signup-field">
              <label className="signup-field-label">{d.captchaLabel} <span className="req">*</span></label>
              <div className="signup-captcha-wrap">
                <div className="signup-captcha-box">
                  <div className="signup-captcha-eq">{captchaQuestion ? `${captchaQuestion} = ?` : '…'}</div>
                  <div className="signup-captcha-sub">{d.captchaSub}</div>
                </div>
                <div className="signup-captcha-input-wrap">
                  <div className="signup-input-wrap">
                    <span className="signup-input-icon">∑</span>
                    <input
                      type="number"
                      value={captchaAnswer}
                      placeholder={d.captchaPlaceholder}
                      inputMode="numeric"
                      onChange={(e) => setCaptchaAnswer(e.target.value)}
                    />
                  </div>
                </div>
                <button type="button" className="signup-captcha-refresh" onClick={refreshCaptcha} title={d.captchaRefreshTitle}>↻</button>
              </div>
            </div>

            {/* CGU */}
            <div
              className={`signup-checkbox-wrap ${termsAccepted ? 'checked' : ''}`}
              role="checkbox"
              aria-checked={termsAccepted}
              tabIndex={0}
              onClick={() => setTermsAccepted((v) => !v)}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setTermsAccepted((v) => !v); } }}
            >
              <div className="signup-custom-check"><span className="signup-custom-check-icon">✓</span></div>
              <span className="signup-checkbox-label">
                {d.termsAcceptPrefix}{' '}
                <a href="/docs/cgu.pdf" target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}>{d.termsLinkCgu}</a>
                {' '}{d.termsAnd}{' '}
                <a href="/docs/politique-confidentialite.pdf" target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}>{d.termsLinkPrivacy}</a>
                {' '}{d.termsOf}
              </span>
            </div>

            {error && <div className="signup-error">{error}</div>}

            {/* SUBMIT */}
            <button type="submit" className="signup-btn-submit" disabled={!canSubmit}>
              {submitting && <span className="signup-spinner" />}
              <span>
                {submitting
                  ? d.submitCreating
                  : fromPricing
                    ? d.submitContinuePayment
                    : d.submitStartTrial}
              </span>
            </button>
            <div className="signup-btn-submit-sub">
              {d.submitSubNote}
            </div>

            {/* Login */}
            <div className="signup-login-link">
              {d.alreadyHaveAccount}{' '}
              <a
                role="link"
                tabIndex={0}
                onClick={() => navigate('/login')}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') navigate('/login'); }}
              >
                {d.loginCta}
              </a>
            </div>
          </form>
        </div>
      </main>

      {/* FOOTER */}
      <footer className="signup-footer">
        <a href="/docs/cgu.pdf" target="_blank" rel="noopener noreferrer">{d.footerCgu}</a>
        <a href="/docs/politique-confidentialite.pdf" target="_blank" rel="noopener noreferrer">{d.footerPrivacy}</a>
        <a href="/docs/mentions-legales.pdf" target="_blank" rel="noopener noreferrer">{d.footerLegal}</a>
      </footer>
    </div>
  );
}
