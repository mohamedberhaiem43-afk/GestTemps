import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CircularProgress, IconButton } from '@mui/material';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import RefreshIcon from '@mui/icons-material/Refresh';
import apiInstance from '../API/apiInstance';
import { lookupTenantCached } from '../API/tenantLookupCache';
import { useAuth } from '../helper/AuthProvider';
import { useFeedbackSnackbar } from '../helper/FeedbackSnackbar';
import GetRestCountries from '../../services/RestCountriesService/GetRestCountries';

/**
 * InlineAuthCard — carte Login/Signup intégrée à la section "Rejoindre Concorde
 * Workforce" de la page d'accueil. Réplique la logique des pages /login et /signup :
 *   - Connexion : lookup-tenant → /Utilisateurs/connect → redirect /dashboard
 *   - Inscription : tous les champs du formulaire complet (slug, pays, SIRET/BCE/
 *     ICE/NINEA avec validation API et auto-fill du nom+adresse, captcha, etc.)
 *
 * L'utilisateur n'est plus redirigé vers les pages dédiées ; tout se fait dans la
 * page d'accueil. Les pages /signup et /login restent disponibles comme deep-links
 * (compatibilité, redirections après reset mot de passe, etc.).
 */

type AuthTab = 'login' | 'register';

type SlugStatus = 'idle' | 'checking' | 'available' | 'taken' | 'invalid' | 'reserved';
// 'personal' = domaine grand public / jetable refusé. Aligné sur la réponse backend
// /signup/check-email qui renvoie reason="personal" (cf. SignupController).
type EmailStatus = 'idle' | 'checking' | 'available' | 'taken' | 'invalid' | 'personal';
type SiretStatus = 'idle' | 'checking' | 'available' | 'format' | 'checksum' | 'not_found' | 'closed' | 'already_used' | 'invalid';

type CountryCode = 'FR' | 'BE' | 'MA' | 'SN';
interface CountryConfig {
  code: CountryCode;
  label: string;
  cca3: string;
  idLabel: string;
  idDigits: number;
  idPlaceholder: string;
}
const COUNTRY_CONFIG: Record<CountryCode, CountryConfig> = {
  FR: { code: 'FR', label: 'France', cca3: 'FRA', idLabel: 'SIRET', idDigits: 14, idPlaceholder: '14 chiffres' },
  BE: { code: 'BE', label: 'Belgique', cca3: 'BEL', idLabel: 'BCE', idDigits: 10, idPlaceholder: '10 chiffres' },
  MA: { code: 'MA', label: 'Maroc', cca3: 'MAR', idLabel: 'ICE', idDigits: 15, idPlaceholder: '15 chiffres' },
  SN: { code: 'SN', label: 'Sénégal', cca3: 'SEN', idLabel: 'NINEA', idDigits: 9, idPlaceholder: '9 chiffres' },
};
const SUPPORTED_COUNTRIES: CountryCode[] = ['FR', 'BE', 'MA', 'SN'];

const SLUG_REGEX = /^[a-z0-9](?:[a-z0-9-]{1,28}[a-z0-9])?$/;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 30);
}

// Pack pré-sélectionné externe (poussé par HomePage quand l'utilisateur clique
// sur l'une des cartes de prix). Reflété dans le state local au mount + à chaque
// changement de prop. Le `nonce` est un compteur utilisé comme déclencheur : sans
// lui, un re-clic sur le MÊME pack après que l'utilisateur ait changé de pack
// dans le formulaire ne re-déclencherait pas la pré-sélection (la prop n'aurait
// pas changé). Le nonce force le useEffect à se rejouer.
type PresetPlan = 'Starter' | 'Standard' | 'Premium';
export interface InlineAuthCardProps {
  presetPlan?: PresetPlan;
  presetNonce?: number;
  /** Onglet ouvert par défaut (ex. 'register' depuis le CTA « essai gratuit »). */
  defaultTab?: AuthTab;
  /** Masque le sélecteur de pack (Starter/Standard/Premium) — cas du CTA essai
   *  gratuit où le pack n'a pas à être choisi (Standard par défaut). */
  hidePlanPicker?: boolean;
}

export default function InlineAuthCard({ presetPlan, presetNonce, defaultTab, hidePlanPicker }: InlineAuthCardProps = {}) {
  const navigate = useNavigate();
  const { setAuthData, refreshAuth } = useAuth();
  const feedback = useFeedbackSnackbar();

  const [tab, setTab] = useState<AuthTab>(defaultTab ?? 'login');

  // ── LOGIN STATE ─────────────────────────────────────────────────
  // loginStep : 'creds' = email+password normal ; 'forgot' = sous-formulaire
  // « mot de passe oublié » qui envoie un code de réinitialisation par mail
  // SANS rediriger vers /login (cf. demande utilisateur 2026-05-14).
  type LoginStep = 'creds' | 'forgot' | 'forgot-sent';
  const [loginStep, setLoginStep] = useState<LoginStep>('creds');
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showLoginPwd, setShowLoginPwd] = useState(false);
  const [loginLoading, setLoginLoading] = useState(false);
  const [forgotLoading, setForgotLoading] = useState(false);

  // Envoi du code de reset par mail. Anti-énumération côté backend → toujours
  // 200, donc on affiche le même message succès quel que soit le résultat.
  // Le user RESTE sur la home (pas de navigate('/login')) — il reçoit le mail
  // qui contient le lien vers la page de reset complète.
  const handleSendResetCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginEmail.trim()) {
      feedback.showError('Veuillez saisir votre email.');
      return;
    }
    setForgotLoading(true);
    try {
      const res = await apiInstance.post('/auth/forgot-password', { Email: loginEmail.trim() });
      feedback.showSuccess(res.data?.message || 'Si cet email existe, un code de réinitialisation a été envoyé.');
      setLoginStep('forgot-sent');
    } catch (err: any) {
      feedback.showError(err?.response?.data?.message || "Impossible d'envoyer le code. Réessayez dans un instant.");
    } finally {
      setForgotLoading(false);
    }
  };

  // ── SIGNUP STATE (mirrors SignupPage) ───────────────────────────
  // Pack choisi par l'utilisateur AVANT inscription. Le pack détermine les
  // features disponibles dès l'entrée en Trialing 30j (cf. backend SignupController).
  // Pré-sélection 'Standard' = pack le plus populaire (parité avec PricingPage).
  type PlanPick = 'Starter' | 'Standard' | 'Premium';
  const [selectedPlan, setSelectedPlan] = useState<PlanPick>(presetPlan ?? 'Standard');
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'annual'>('annual');

  // Quand la HomePage pousse un pack pré-sélectionné (clic sur l'une des cartes
  // de prix), on bascule sur l'onglet "Créer un compte" et on aligne la sélection.
  // Dépend du `nonce` pour relancer l'effet même si le pack identique est re-cliqué.
  useEffect(() => {
    if (!presetPlan) return;
    setSelectedPlan(presetPlan);
    setTab('register');
  }, [presetPlan, presetNonce]);

  const [companyName, setCompanyName] = useState('');
  const [slug, setSlug] = useState('');
  const [slugTouched, setSlugTouched] = useState(false);
  const [slugStatus, setSlugStatus] = useState<SlugStatus>('idle');

  const [country, setCountry] = useState<CountryCode>('FR');
  const countryConfig = COUNTRY_CONFIG[country];
  const [countryFlags, setCountryFlags] = useState<Record<CountryCode, string>>({ FR: '', BE: '', MA: '', SN: '' });

  const [siret, setSiret] = useState('');
  const [siretStatus, setSiretStatus] = useState<SiretStatus>('idle');
  const [siretCompanyName, setSiretCompanyName] = useState<string | null>(null);
  const [siretCompanyAddress, setSiretCompanyAddress] = useState<string | null>(null);
  const [companyNameAutofilled, setCompanyNameAutofilled] = useState(false);
  // Secteur d'activité — pré-rempli depuis Sirene FR (libellé NAF) / BCE BE quand
  // l'API renvoie l'info ; sinon saisie libre. Aligné sur SignupPage.tsx.
  const [activitySector, setActivitySector] = useState('');
  const [activitySectorAutofilled, setActivitySectorAutofilled] = useState(false);
  // Acceptation explicite CGU + Confidentialité (case à cocher du formulaire).
  // Requise pour activer le bouton de soumission.
  const [termsAccepted, setTermsAccepted] = useState(false);

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [signupEmail, setSignupEmail] = useState('');
  const [emailStatus, setEmailStatus] = useState<EmailStatus>('idle');
  const [signupPassword, setSignupPassword] = useState('');
  const [showSignupPwd, setShowSignupPwd] = useState(false);

  const [captchaQuestion, setCaptchaQuestion] = useState('');
  const [captchaChallengeId, setCaptchaChallengeId] = useState('');
  const [captchaAnswer, setCaptchaAnswer] = useState('');

  const [submitting, setSubmitting] = useState(false);

  // ── CAPTCHA REFRESH ─────────────────────────────────────────────
  const refreshCaptcha = async () => {
    try {
      const { data } = await apiInstance.get('/signup/captcha');
      setCaptchaQuestion(data?.question ?? '');
      setCaptchaChallengeId(data?.challengeId ?? '');
      setCaptchaAnswer('');
    } catch {
      // Réseau down : on reste sur l'ancien challenge si présent, sinon vide.
    }
  };
  // Captcha chargé une fois que l'utilisateur bascule sur l'onglet "register" — pas
  // au mount, pour ne pas générer un challenge à chaque visite de la home.
  useEffect(() => {
    if (tab === 'register' && !captchaChallengeId) refreshCaptcha();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  // ── DRAPEAUX RESTCOUNTRIES ──────────────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        const all = await GetRestCountries.getAll();
        const flags: Record<CountryCode, string> = { FR: '', BE: '', MA: '', SN: '' };
        for (const cc of SUPPORTED_COUNTRIES) {
          const cca3 = COUNTRY_CONFIG[cc].cca3;
          const match = all.find((c: any) => c.cca3 === cca3);
          if (match) flags[cc] = match.flagPng || match.flagSvg || '';
        }
        setCountryFlags(flags);
      } catch { /* best-effort */ }
    })();
  }, []);

  // Reset ID quand pays change
  useEffect(() => {
    setSiret('');
    setSiretStatus('idle');
    setSiretCompanyName(null);
    setSiretCompanyAddress(null);
    setCompanyNameAutofilled(false);
    setActivitySector('');
    setActivitySectorAutofilled(false);
  }, [country]);

  // Auto-slug depuis companyName tant que non-touché
  useEffect(() => {
    if (!slugTouched) setSlug(slugify(companyName));
  }, [companyName, slugTouched]);

  // ── DEBOUNCED SLUG CHECK ────────────────────────────────────────
  useEffect(() => {
    if (!slug) { setSlugStatus('idle'); return; }
    if (!SLUG_REGEX.test(slug)) { setSlugStatus('invalid'); return; }
    setSlugStatus('checking');
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), 4000);
    const handle = setTimeout(async () => {
      try {
        const { data } = await apiInstance.get('/signup/check-slug', { params: { slug }, signal: controller.signal });
        clearTimeout(t);
        if (data.available) setSlugStatus('available');
        else if (data.reason === 'reserved') setSlugStatus('reserved');
        else if (data.reason === 'format') setSlugStatus('invalid');
        else setSlugStatus('taken');
      } catch {
        clearTimeout(t);
        setSlugStatus('idle');
      }
    }, 300);
    return () => { clearTimeout(handle); clearTimeout(t); controller.abort(); };
  }, [slug]);

  // ── DEBOUNCED EMAIL CHECK ───────────────────────────────────────
  useEffect(() => {
    const trimmed = signupEmail.trim();
    if (!trimmed) { setEmailStatus('idle'); return; }
    if (!EMAIL_REGEX.test(trimmed)) { setEmailStatus('invalid'); return; }
    setEmailStatus('checking');
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), 4000);
    const handle = setTimeout(async () => {
      try {
        const { data } = await apiInstance.get('/signup/check-email', { params: { email: trimmed }, signal: controller.signal });
        clearTimeout(t);
        if (data.available) setEmailStatus('available');
        else if (data.reason === 'format') setEmailStatus('invalid');
        else if (data.reason === 'personal') setEmailStatus('personal');
        else setEmailStatus('taken');
      } catch {
        clearTimeout(t);
        setEmailStatus('idle');
      }
    }, 300);
    return () => { clearTimeout(handle); clearTimeout(t); controller.abort(); };
  }, [signupEmail]);

  // ── DEBOUNCED SIRET CHECK ───────────────────────────────────────
  useEffect(() => {
    const digits = siret.replace(/\D/g, '');
    if (!digits) { setSiretStatus('idle'); setSiretCompanyName(null); setSiretCompanyAddress(null); return; }
    if (digits.length !== countryConfig.idDigits) {
      setSiretStatus('format');
      setSiretCompanyName(null);
      setSiretCompanyAddress(null);
      return;
    }
    setSiretStatus('checking');
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), 6000);
    const handle = setTimeout(async () => {
      try {
        const { data } = await apiInstance.get('/signup/check-siret', {
          params: { siret: digits, country: countryConfig.code },
          signal: controller.signal,
        });
        clearTimeout(t);
        if (data.available) {
          setSiretStatus('available');
          setSiretCompanyName(data.companyName ?? null);
          setSiretCompanyAddress(data.companyAddress ?? null);
          if (data.companyName && (!companyName.trim() || !companyNameAutofilled)) {
            setCompanyName(data.companyName);
            setCompanyNameAutofilled(true);
          }
          if (data.activitySector && (!activitySector.trim() || !activitySectorAutofilled)) {
            setActivitySector(String(data.activitySector));
            setActivitySectorAutofilled(true);
          }
        } else {
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
        clearTimeout(t);
        setSiretStatus('idle');
      }
    }, 400);
    return () => { clearTimeout(handle); clearTimeout(t); controller.abort(); };
  }, [siret, countryConfig.idDigits, countryConfig.code]);

  // ── HELPERS DE STATUT ──────────────────────────────────────────
  const slugHelper = useMemo(() => {
    switch (slugStatus) {
      case 'checking': return { kind: 'info', text: 'Vérification…' };
      case 'available': return { kind: 'ok', text: `${slug}.concorde-work-force.com disponible` };
      case 'taken': return { kind: 'err', text: 'Ce slug est déjà pris.' };
      case 'reserved': return { kind: 'err', text: 'Ce slug est réservé.' };
      case 'invalid': return { kind: 'err', text: '3 à 30 caractères : a-z, 0-9, tirets.' };
      default: return null;
    }
  }, [slugStatus, slug]);

  const emailHelper = useMemo(() => {
    switch (emailStatus) {
      case 'checking': return { kind: 'info', text: 'Vérification…' };
      case 'available': return { kind: 'ok', text: 'Email disponible.' };
      case 'taken': return { kind: 'err', text: 'Email déjà utilisé.' };
      case 'invalid': return { kind: 'err', text: 'Format invalide.' };
      case 'personal': return { kind: 'err', text: 'Adresse pro requise (pas Gmail/Outlook/Yahoo…).' };
      default: return null;
    }
  }, [emailStatus]);

  const siretHelper = useMemo(() => {
    const idName = countryConfig.idLabel;
    switch (siretStatus) {
      case 'checking': return { kind: 'info', text: `Vérification ${country === 'FR' ? 'Sirene' : country === 'BE' ? 'registre BCE' : 'format'}…` };
      case 'available': return { kind: 'ok', text: siretCompanyName ? `${siretCompanyName}` : `${idName} valide.` };
      case 'format': return { kind: 'err', text: `${countryConfig.idDigits} chiffres requis.` };
      case 'checksum': return { kind: 'err', text: 'Clé de contrôle invalide.' };
      case 'not_found': return { kind: 'err', text: 'Entreprise inconnue dans le référentiel.' };
      case 'closed': return { kind: 'err', text: 'Établissement fermé.' };
      case 'already_used': return { kind: 'err', text: 'Compte déjà existant pour ce numéro.' };
      case 'invalid': return { kind: 'err', text: 'Numéro non valide.' };
      default: return null;
    }
  }, [siretStatus, siretCompanyName, country, countryConfig]);

  // Force du mot de passe (0-3) — pilote les 3 barres visuelles du formulaire.
  // 1 = longueur OK, +1 = majuscule & chiffre, +1 = caractère spécial.
  const pwScore = useMemo(() => {
    const v = signupPassword;
    if (!v) return 0;
    let s = 0;
    if (v.length >= 8) s++;
    if (/[A-Z]/.test(v) && /[0-9]/.test(v)) s++;
    if (/[^A-Za-z0-9]/.test(v)) s++;
    return s;
  }, [signupPassword]);

  // ── VALIDATION GLOBALE SIGNUP ──────────────────────────────────
  const siretDigitsRegex = new RegExp(`^[0-9]{${countryConfig.idDigits}}$`);
  const slugAccepted = SLUG_REGEX.test(slug) && slugStatus !== 'taken' && slugStatus !== 'reserved' && slugStatus !== 'invalid';
  const siretAccepted = siretDigitsRegex.test(siret.replace(/\D/g, ''))
    && siretStatus !== 'format' && siretStatus !== 'checksum'
    && siretStatus !== 'not_found' && siretStatus !== 'closed'
    && siretStatus !== 'already_used' && siretStatus !== 'invalid';

  const canSignup =
    !submitting
    && companyName.trim().length >= 2
    && slugAccepted
    && siretAccepted
    && firstName.trim().length > 0
    && lastName.trim().length > 0
    && EMAIL_REGEX.test(signupEmail)
    && emailStatus !== 'taken' && emailStatus !== 'invalid' && emailStatus !== 'personal'
    && signupPassword.length >= 8
    && captchaChallengeId.length > 0
    && captchaAnswer.trim() !== ''
    && termsAccepted;

  // ── HANDLERS ────────────────────────────────────────────────────
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginEmail || !loginPassword) {
      feedback.showError('Email et mot de passe requis.');
      return;
    }
    setLoginLoading(true);
    try {
      // Cache mémoire — évite de hammer /lookup-tenant à chaque tentative de
      // login. Le serveur autorise 30/h/IP désormais ; ce cache supplémentaire
      // élimine les appels redondants quand l'utilisateur retry après mauvais MDP.
      const lookupSlug = await lookupTenantCached(loginEmail);
      if (!lookupSlug) {
        feedback.showError('Aucun compte trouvé avec cet email.');
        setLoginLoading(false);
        return;
      }
      localStorage.setItem('tenantSlug', lookupSlug);
      const resp = await apiInstance.post('/Utilisateurs/connect', { Utimail: loginEmail, Utimps: loginPassword });
      const data = resp.data;
      if (data.requires2fa) {
        // Pour le flow 2FA on bascule vers la page Login dédiée (UI complète + saisie code).
        feedback.showInfo('Code à 2 facteurs requis — redirection vers la page de connexion…');
        setTimeout(() => navigate('/login', { state: { email: loginEmail } }), 1200);
        return;
      }
      // Voir Login.tsx processLoginSuccess pour la note de bug 2026-05-23 :
      // le backend renvoie tout en camelCase (utiimg/uticod/utiadm), pas en
      // PascalCase. Avant ce fix, ça marchait par accident depuis la home (`/`
      // n'est pas dans AUTH_FREE_PATHS donc /me corrigeait le state) mais
      // cassait depuis /login. On aligne les deux call-sites.
      if (data.utiimg) localStorage.setItem('profileImage', data.utiimg);
      else localStorage.removeItem('profileImage');
      if (data.socimg) localStorage.setItem('societeImage', data.socimg);
      else localStorage.removeItem('societeImage');
      setAuthData({
        soccod: data.societe?.soccod,
        sitcod: data.societe?.sitcod,
        userName: data.utilib,
        soclib: data.soclib,
        uticod: data.uticod ?? null,
        utiadm: data.utiadm ?? null,
        isManager: data.isManager,
        isEmp: Boolean(data.isEmp),
      });
      await refreshAuth();
      window.dispatchEvent(new Event('utiadmUpdated'));
      window.dispatchEvent(new Event('imageUpdated'));
      navigate('/dashboard');
    } catch (err: any) {
      if (err?.response?.status === 402) {
        // Tenant en PendingPayment — redirige vers /login pour gérer le resume Stripe.
        feedback.showInfo('Paiement requis — redirection vers la page de connexion…');
        setTimeout(() => navigate('/login', { state: { email: loginEmail } }), 1200);
        return;
      }
      feedback.showError(err, 'Identifiants invalides.');
    } finally {
      setLoginLoading(false);
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSignup) {
      feedback.showError('Veuillez compléter tous les champs correctement.');
      return;
    }
    setSubmitting(true);
    try {
      const { data } = await apiInstance.post('/signup', {
        slug,
        companyName: companyName.trim(),
        siret: siret.replace(/\D/g, ''),
        country,
        activitySector: activitySector.trim() || null,
        adminFirstName: firstName.trim(),
        adminLastName: lastName.trim(),
        adminEmail: signupEmail.trim(),
        adminPassword: signupPassword,
        // Pack + cycle choisis dans le sélecteur ci-dessus. Avant le fix
        // 2026-05-18, on envoyait planCode:null → tenant créé sans plan, donc
        // toutes les features Standard/Premium désactivées jusqu'à ce que
        // l'admin re-choisisse manuellement depuis /dashboard/mon-abonnement.
        planCode: selectedPlan,
        billingCycle,
        requiresPayment: false,
        captchaChallengeId,
        captchaAnswer: captchaAnswer === '' ? null : Number(captchaAnswer),
      });
      localStorage.setItem('tenantSlug', slug);
      await refreshAuth();
      feedback.showSuccess('Compte créé avec succès !');
      // Redirigeer vers la page de vérification email avant toute connexion complète.
      // Le backend a déjà posé le cookie JWT; /me renverra emailVerified=false.
      navigate('/verify-email', { state: { email: signupEmail.trim(), signupRedirectUrl: data.redirectUrl } });
    } catch (err: any) {
      if (err?.response?.data?.code === 'cancelled_account_reactivatable') {
        const cancelledSlug = err?.response?.data?.slug;
        if (cancelledSlug) localStorage.setItem('tenantSlug', cancelledSlug);
        navigate('/login', {
          state: {
            email: signupEmail.trim(),
            notice: 'Votre compte a été résilié. Connectez-vous pour le réactiver (données conservées 90 jours).',
          },
        });
        return;
      }
      if (err?.response?.data?.code === 'captcha_failed') {
        await refreshCaptcha();
      }
      feedback.showError(err, 'Inscription échouée. Réessayez.');
    } finally {
      setSubmitting(false);
    }
  };

  // ── RENDER ──────────────────────────────────────────────────────
  return (
    <div className="auth-card reveal">
      <div className="auth-tabs">
        <button type="button" className={`auth-tab${tab === 'login' ? ' active' : ''}`} onClick={() => setTab('login')}>Connexion</button>
        <button type="button" className={`auth-tab${tab === 'register' ? ' active' : ''}`} onClick={() => setTab('register')}>Créer un compte</button>
      </div>

      {tab === 'login' && loginStep === 'creds' && (
        <form onSubmit={handleLogin}>
          <div className="form-group">
            <label className="form-label">Email professionnel</label>
            <input className="form-input" type="email" autoComplete="email" placeholder="directeur@entreprise.com"
              value={loginEmail} onChange={(e) => setLoginEmail(e.target.value)} required />
          </div>
          <div className="form-group">
            <label className="form-label">Mot de passe</label>
            <div className="form-input-wrap">
              <input className="form-input" type={showLoginPwd ? 'text' : 'password'} autoComplete="current-password" placeholder="••••••••"
                value={loginPassword} onChange={(e) => setLoginPassword(e.target.value)} required />
              <button type="button" className="form-input-icon" aria-label="Afficher mot de passe" onClick={() => setShowLoginPwd(v => !v)}>
                {showLoginPwd ? <VisibilityOffIcon sx={{ fontSize: 18 }} /> : <VisibilityIcon sx={{ fontSize: 18 }} />}
              </button>
            </div>
          </div>
          <div className="form-forgot">
            <a onClick={() => setLoginStep('forgot')}>Mot de passe oublié ?</a>
          </div>
          <button type="submit" className="auth-submit" disabled={loginLoading}>
            {loginLoading ? <CircularProgress size={18} sx={{ color: '#fff' }} /> : 'Se connecter →'}
          </button>
          <div className="auth-footer">
            Pas encore de compte ? <a onClick={() => setTab('register')}>Créer un compte</a>
          </div>
        </form>
      )}

      {/* Mot de passe oublié — formulaire INLINE : juste envoyer le code par mail,
          sans rediriger vers /login. L'utilisateur reçoit le code et suit le lien
          contenu dans le mail pour finaliser la réinitialisation. */}
      {tab === 'login' && loginStep === 'forgot' && (
        <form onSubmit={handleSendResetCode}>
          <div className="form-group">
            <label className="form-label">Email professionnel</label>
            <input className="form-input" type="email" autoComplete="email" placeholder="directeur@entreprise.com"
              value={loginEmail} onChange={(e) => setLoginEmail(e.target.value)} required autoFocus />
            <div className="form-hint form-hint--info" style={{ fontSize: 12, marginTop: 4 }}>
              Nous enverrons un code de réinitialisation à cet email. Suivez les instructions du mail pour choisir un nouveau mot de passe.
            </div>
          </div>
          <button type="submit" className="auth-submit" disabled={forgotLoading}>
            {forgotLoading ? <CircularProgress size={18} sx={{ color: '#fff' }} /> : 'Envoyer le code par mail →'}
          </button>
          <div className="auth-footer">
            <a onClick={() => setLoginStep('creds')}>← Revenir à la connexion</a>
          </div>
        </form>
      )}

      {tab === 'login' && loginStep === 'forgot-sent' && (
        <div className="forgot-sent-card">
          <div className="forgot-sent-icon">📬</div>
          <h3 className="forgot-sent-title">Code envoyé</h3>
          <p className="forgot-sent-text">
            Si un compte existe pour <strong>{loginEmail}</strong>, vous recevrez un email contenant un code de réinitialisation dans quelques instants.
          </p>
          <p className="forgot-sent-hint">
            Pensez à vérifier vos spams. Le code expire après 30 minutes.
          </p>
          <button type="button" className="auth-submit" onClick={() => setLoginStep('creds')}>
            ← Revenir à la connexion
          </button>
        </div>
      )}

      {tab === 'register' && (
        <form onSubmit={handleSignup}>
          {/* Sélecteur de pack — affiché en HAUT du formulaire pour que l'utilisateur
              choisisse explicitement Starter / Standard / Premium AVANT toute autre
              information. Le pack est envoyé à /api/signup comme planCode et applique
              les features correspondantes dès l'entrée en Trialing 30j. */}
          {!hidePlanPicker && (
          <div className="signup-plan-picker">
            <div className="signup-plan-picker-header">
              <span className="form-label" style={{ margin: 0 }}>Choisissez votre pack d'essai</span>
              <div className="signup-cycle-toggle" role="tablist" aria-label="Cycle de facturation">
                <button type="button" role="tab" aria-selected={billingCycle === 'monthly'}
                  className={`signup-cycle-btn${billingCycle === 'monthly' ? ' active' : ''}`}
                  onClick={() => setBillingCycle('monthly')}>
                  Mensuel
                </button>
                <button type="button" role="tab" aria-selected={billingCycle === 'annual'}
                  className={`signup-cycle-btn${billingCycle === 'annual' ? ' active' : ''}`}
                  onClick={() => setBillingCycle('annual')}>
                  Annuel <span className="signup-cycle-badge">-20%</span>
                </button>
              </div>
            </div>
            <div className="signup-plan-grid">
              {([
                { key: 'Starter',  label: 'Starter',  monthly: 29.5,  seats: 10, tagline: 'TPE & startups' },
                { key: 'Standard', label: 'Standard', monthly: 54,    seats: 15, tagline: 'PME en croissance', popular: true },
                { key: 'Premium',  label: 'Premium',  monthly: 149,   seats: 30, tagline: 'Multi-filiales' },
              ] as Array<{ key: PlanPick; label: string; monthly: number; seats: number; tagline: string; popular?: boolean }>)
                .map((p) => {
                  const selected = selectedPlan === p.key;
                  const price = billingCycle === 'monthly' ? p.monthly : p.monthly * 12 * 0.8;
                  const fmt = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2 }).format(price);
                  return (
                    <button type="button" key={p.key} aria-pressed={selected}
                      className={`signup-plan-card${selected ? ' selected' : ''}${p.popular ? ' popular' : ''}`}
                      onClick={() => setSelectedPlan(p.key)}>
                      {p.popular && <span className="signup-plan-popular">Populaire</span>}
                      <div className="signup-plan-name">{p.label}</div>
                      <div className="signup-plan-tag">{p.tagline}</div>
                      <div className="signup-plan-price">
                        <span className="signup-plan-amount">{fmt} €</span>
                        <span className="signup-plan-period">/ {billingCycle === 'monthly' ? 'mois' : 'an'} HT</span>
                      </div>
                      <div className="signup-plan-seats">{p.seats} salariés inclus</div>
                    </button>
                  );
                })}
            </div>
            <div className="form-hint form-hint--info" style={{ marginTop: 6 }}>
              🎁 1 mois d'essai gratuit sans carte bancaire — annulable en 1 clic.
            </div>
          </div>
          )}

          {/* Bandeau de confiance — repris de la maquette signup (sans CB + données FR). */}
          <div className="signup-trust-pills">
            <span className="signup-trust-pill">✓ Sans carte bancaire</span>
            <span className="signup-trust-pill">🛡️ Données hébergées en France</span>
          </div>

          {/* ── Section : entreprise ───────────────────────────────── */}
          <div className="signup-section-label">Votre entreprise</div>

          {/* Ordre des champs (2026-05) : Pays + ID entreprise + email pro EN
              PREMIER (avant prénom/nom). Le pays détermine le format de l'ID ;
              un ID valide auto-remplit le nom + l'adresse de l'entreprise. */}
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Pays</label>
              <div className="form-input-wrap">
                {countryFlags[country] && (
                  <img src={countryFlags[country]} alt={countryConfig.label} className="form-input-flag" />
                )}
                <select className="form-input" style={{ cursor: 'pointer', paddingLeft: countryFlags[country] ? 36 : undefined }}
                  value={country} onChange={(e) => setCountry(e.target.value as CountryCode)}>
                  {SUPPORTED_COUNTRIES.map(cc => (
                    <option key={cc} value={cc}>{COUNTRY_CONFIG[cc].label}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">{countryConfig.idLabel}</label>
              <div className="form-input-wrap">
                <input className="form-input" type="text" inputMode="numeric" placeholder={countryConfig.idPlaceholder}
                  value={siret} onChange={(e) => setSiret(e.target.value)} required />
                {siretStatus === 'checking' && (
                  <span className="form-input-icon" style={{ pointerEvents: 'none' }}>
                    <CircularProgress size={16} />
                  </span>
                )}
              </div>
              {siretHelper && <div className={`form-hint form-hint--${siretHelper.kind}`}>{siretHelper.text}</div>}
              {siretCompanyAddress && siretStatus === 'available' && (
                <div className="form-hint form-hint--ok" style={{ fontSize: 11, marginTop: 2 }}>
                  📍 {siretCompanyAddress}
                </div>
              )}
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Email professionnel</label>
            <input className="form-input" type="email" autoComplete="email" placeholder="directeur@entreprise.com"
              value={signupEmail} onChange={(e) => setSignupEmail(e.target.value)} required />
            {emailHelper && <div className={`form-hint form-hint--${emailHelper.kind}`}>{emailHelper.text}</div>}
          </div>

          <div className="form-group">
            <label className="form-label">Nom de l'entreprise</label>
            <input className="form-input" type="text" placeholder="Nom de votre entreprise"
              value={companyName} onChange={(e) => { setCompanyName(e.target.value); setCompanyNameAutofilled(false); }} required minLength={2} />
          </div>

          {/* Secteur d'activité — pré-rempli depuis l'API officielle (NAF/NACE) quand
              l'identifiant est reconnu ; sinon saisie libre. */}
          <div className="form-group">
            <label className="form-label">Secteur d'activité</label>
            <input className="form-input" type="text" placeholder="Ex : Conseil en gestion, BTP, Restauration…"
              value={activitySector} onChange={(e) => { setActivitySector(e.target.value); setActivitySectorAutofilled(true); }} />
          </div>

          <div className="form-group">
            <label className="form-label">Adresse de votre espace</label>
            <input className="form-input" type="text" placeholder="votre-entreprise"
              value={slug} onChange={(e) => { setSlugTouched(true); setSlug(slugify(e.target.value)); }} required />
            <div className="signup-slug-preview">https://<strong>{slug || 'votre-slug'}</strong>.concorde-work-force.com</div>
            {slugHelper && <div className={`form-hint form-hint--${slugHelper.kind}`}>{slugHelper.text}</div>}
          </div>

          {/* ── Section : compte administrateur ────────────────────── */}
          <div className="signup-section-label">Votre compte administrateur</div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Prénom</label>
              <input className="form-input" type="text" autoComplete="given-name" placeholder="Sophie"
                value={firstName} onChange={(e) => setFirstName(e.target.value)} required />
            </div>
            <div className="form-group">
              <label className="form-label">Nom</label>
              <input className="form-input" type="text" autoComplete="family-name" placeholder="Gaultier"
                value={lastName} onChange={(e) => setLastName(e.target.value)} required />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Mot de passe (8 caractères min.)</label>
            <div className="form-input-wrap">
              <input className="form-input" type={showSignupPwd ? 'text' : 'password'} autoComplete="new-password" placeholder="••••••••"
                value={signupPassword} onChange={(e) => setSignupPassword(e.target.value)} required minLength={8} />
              <button type="button" className="form-input-icon" aria-label="Afficher mot de passe" onClick={() => setShowSignupPwd(v => !v)}>
                {showSignupPwd ? <VisibilityOffIcon sx={{ fontSize: 18 }} /> : <VisibilityIcon sx={{ fontSize: 18 }} />}
              </button>
            </div>
            {signupPassword && (
              <div className={`signup-pw-strength s${pwScore}`} aria-hidden="true">
                <span className="signup-pw-bar" />
                <span className="signup-pw-bar" />
                <span className="signup-pw-bar" />
              </div>
            )}
          </div>

          {/* Captcha anti-bot — challenge fetché depuis /signup/captcha, single-use. */}
          <div className="form-group">
            <label className="form-label">Vérification (anti-bot)</label>
            <div className="form-row" style={{ gap: 8, alignItems: 'center', gridTemplateColumns: 'auto 1fr auto' }}>
              <div className="captcha-question" style={{ flex: '0 0 auto' }}>
                {captchaQuestion ? <strong>{captchaQuestion} =</strong> : <em style={{ color: '#94a3b8' }}>chargement…</em>}
              </div>
              <input className="form-input" type="number" inputMode="numeric" placeholder="Réponse"
                value={captchaAnswer} onChange={(e) => setCaptchaAnswer(e.target.value)}
                required style={{ flex: 1, minWidth: 90 }} />
              <IconButton size="small" onClick={refreshCaptcha} aria-label="Régénérer le captcha" sx={{ flex: '0 0 auto' }}>
                <RefreshIcon sx={{ fontSize: 18 }} />
              </IconButton>
            </div>
          </div>

          {/* Acceptation CGU + Confidentialité (obligatoire). Les liens ouvrent les
              pages légales dans un nouvel onglet sans cocher/décocher la case. */}
          <label className={`signup-cgu${termsAccepted ? ' checked' : ''}`}>
            <input type="checkbox" checked={termsAccepted} onChange={(e) => setTermsAccepted(e.target.checked)} />
            <span className="signup-cgu-box">{termsAccepted ? '✓' : ''}</span>
            <span className="signup-cgu-text">
              J'accepte les <a href="/cgu" target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}>Conditions Générales d'Utilisation</a> et la <a href="/confidentialite" target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}>Politique de Confidentialité</a>.
            </span>
          </label>

          <button type="submit" className="auth-submit" disabled={!canSignup}>
            {submitting ? <CircularProgress size={18} sx={{ color: '#fff' }} /> : 'Créer mon compte →'}
          </button>
          <div className="auth-footer">
            Déjà un compte ? <a onClick={() => setTab('login')}>Se connecter</a>
          </div>
          <div className="signup-legal-links">
            <a href="/cgu" target="_blank" rel="noopener noreferrer">Conditions Générales d'Utilisation</a>
            <span className="signup-legal-sep">·</span>
            <a href="/confidentialite" target="_blank" rel="noopener noreferrer">Politique de Confidentialité</a>
            <span className="signup-legal-sep">·</span>
            <a href="/mentions-legales" target="_blank" rel="noopener noreferrer">Mentions Légales</a>
          </div>
        </form>
      )}

      {feedback.element}
    </div>
  );
}
