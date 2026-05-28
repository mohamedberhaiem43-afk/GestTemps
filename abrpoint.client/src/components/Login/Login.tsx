import { useEffect, useState } from 'react';
import {
  Box, Typography, TextField, Button, CircularProgress, Alert,
  InputAdornment, IconButton,
} from '@mui/material';
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import apiInstance from '../API/apiInstance';
import { lookupTenantCached } from '../API/tenantLookupCache';
import { useAuth } from '../helper/AuthProvider';
import { startStripeCheckout, resumeStripeCheckout } from '../Pricing/stripeCheckout';
import MailIcon from '@mui/icons-material/Mail';
import LockIcon from '@mui/icons-material/Lock';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import './Login.css';

interface UserLoginModel {
  Utimail: string;
  Utimps: string;
}

export default function CredentialsSignInPage() {
  const { t } = useTranslation();
  const { setAuthData, refreshAuth, uticod, authReady } = useAuth();
  const [utimail, setUtimail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  // Si l'utilisateur arrive depuis le PricingPage avec un plan choisi, on conserve l'info pour
  // l'envoyer vers la page de paiement après authentification réussie (style Odoo).
  const pendingPlan = (location.state as any)?.plan ? location.state : null;

  // Pattern returnUrl style dougs.fr (`/signin?returnUrl=%2Fme`) : si l'utilisateur
  // est redirigé ici depuis une page protégée, on garde l'URL d'origine et on y
  // retourne après authentification (au lieu d'atterrir systématiquement sur
  // `/dashboard`). On lit la query string une fois, on persiste pour ré-utiliser
  // dans processLoginSuccess ET dans le shortcut "déjà connecté" ci-dessous.
  const returnUrl = (() => {
    try {
      const sp = new URLSearchParams(location.search);
      const r = sp.get('returnUrl');
      // SEC : on autorise UNIQUEMENT les chemins relatifs internes (`/dashboard/...`).
      // Bloque les open-redirects vers un domaine externe ou un protocole exotique.
      if (r && r.startsWith('/') && !r.startsWith('//')) return r;
    } catch { /* noop */ }
    return null;
  })();

  // Shortcut : si l'utilisateur arrive sur /login alors qu'il a déjà une session
  // valide (uticod hydraté par /me), on le ramène à son espace sans afficher
  // l'écran de login. Couvre le cas « clique Connexion depuis la home alors que
  // son token est encore valide ». On attend authReady pour éviter de rediriger
  // pendant l'hydratation initiale (sinon un user logged-in voit un flash login).
  useEffect(() => {
    if (authReady && uticod) {
      navigate(returnUrl ?? '/dashboard', { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authReady, uticod]);
  // Pré-remplit l'email + affiche un bandeau d'information quand on arrive depuis la
  // page Signup pour réactivation d'un compte résilié (cf. SignupPage : code
  // 'cancelled_account_reactivatable').
  useEffect(() => {
    const s = location.state as { email?: string; notice?: string } | null;
    if (s?.email) setUtimail(s.email);
    if (s?.notice) setSuccess(s.notice);
    // On efface le state pour ne pas re-déclencher sur un retour navigateur.
    if (s?.email || s?.notice) navigate(location.pathname, { replace: true, state: null });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Forgot password state
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [resetCode, setResetCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [forgotStep, setForgotStep] = useState<'email' | 'code' | 'reset'>('email');
  const [forgotLoading, setForgotLoading] = useState(false);
  // Mode « setup » : l'utilisateur arrive depuis l'email de bienvenue avec un token
  // unique. On le bascule directement sur l'étape « définir mon mot de passe »,
  // email + code pré-remplis et verrouillés (il n'a qu'à choisir son MDP).
  const [setupMode, setSetupMode] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();
  useEffect(() => {
    if (searchParams.get('setup') === '1') {
      const e = searchParams.get('email') ?? '';
      const c = searchParams.get('code') ?? '';
      if (e && c) {
        setSetupMode(true);
        setShowForgotPassword(true);
        setForgotEmail(e);
        setResetCode(c);
        setForgotStep('reset');
        // On nettoie l'URL pour éviter de relancer le flow à chaque re-render et de
        // laisser le token traîner dans l'historique du navigateur.
        const next = new URLSearchParams(searchParams);
        next.delete('setup'); next.delete('email'); next.delete('code');
        setSearchParams(next, { replace: true });
      }
    }
    // Retour Stripe après resumeStripeCheckout : on pré-remplit l'email et on
    // affiche un bandeau « Paiement confirmé ». Le webhook Stripe a flippé (ou
    // est en train de flipper) le tenant Cancelled → Active ; à la prochaine
    // tentative connect le middleware laissera passer et le post-login redirect
    // routera vers /mon-abonnement qui poll jusqu'à confirmation finale.
    if (searchParams.get('reactivated') === '1') {
      const e = searchParams.get('email') ?? '';
      if (e) setUtimail(e);
      setSuccess('Paiement confirmé ✓ — connectez-vous pour finaliser la réactivation de votre espace.');
      const next = new URLSearchParams(searchParams);
      next.delete('reactivated'); next.delete('email'); next.delete('session_id');
      setSearchParams(next, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // En SaaS multi-tenant, la société et le site sont résolus côté backend depuis le
  // tenant courant + le Socuser de l'utilisateur. Plus besoin de les demander à l'écran.

  const [requires2FA, setRequires2FA] = useState(false);
  const [twoFACode, setTwoFACode] = useState('');
  const [tempUticod, setTempUticod] = useState('');

  const processLoginSuccess = async (data: any) => {
    // ⚠️ Bug 2026-05-23 — le backend ASP.NET Core sérialise en camelCase par
    // défaut (cf. Program.cs:131 — aucun PropertyNamingPolicy custom). Les
    // champs réels du payload sont `uticod`, `utiadm`, `utiimg` (et non
    // `Uticod`/`Utiadm`/`Utiimg` comme le suggéraient les anciennes versions).
    // Avant ce fix, la lecture en PascalCase renvoyait `undefined`, posait
    // `uticod=null` dans le contexte → sessionStorage vidé → la garde
    // AUTH_FREE_PATHS de refreshAuth re-déclenchait le mode déconnecté et
    // l'utilisateur revenait sur /login après une connexion pourtant réussie.
    const { societe, utiimg, socimg } = data;

    if (utiimg) localStorage.setItem('profileImage', utiimg);
    else localStorage.removeItem('profileImage');

    if (socimg) localStorage.setItem('societeImage', socimg);
    else localStorage.removeItem('societeImage');
    setAuthData({
      soccod: societe?.soccod,
      sitcod: societe?.sitcod,
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
    // Reprise du flow de souscription : si un plan a été sélectionné avant la connexion,
    // on redirige directement vers Stripe Checkout (pas de page de paiement custom).
    if (pendingPlan) {
      try {
        await startStripeCheckout(pendingPlan);
        return;
      } catch (e: any) {
        setError(e?.response?.data?.error || t('login.stripeFailed'));
        return;
      }
    }
    // Si le tenant est résilié (Cancelled) ou en attente de paiement
    // (PendingPayment), on ne peut PAS le router vers /dashboard : les
    // endpoints applicatifs sont bloqués 402 par TenantResolverMiddleware.
    // On l'envoie sur /dashboard/mon-abonnement (route SPA, n'appelle que
    // /api/billing/* qui est dans le bypass middleware) pour qu'il réactive
    // ou finalise son paiement. Sans ce redirect, l'utilisateur tombait sur
    // un /dashboard cassé (KPIs vides, /me succès mais tous les autres
    // appels en 402) et la seule façon de sortir était une URL manuelle.
    try {
      const me = await apiInstance.get('/Utilisateurs/me');
      const tenantStatus = (me.data?.tenantStatus ?? '').toString();
      if (tenantStatus === 'Cancelled' || tenantStatus === 'PendingPayment') {
        navigate('/dashboard/mon-abonnement', { replace: true });
        return;
      }
    } catch { /* fall through au navigate dashboard */ }
    // Si le visiteur a été redirigé depuis une page protégée (returnUrl=/dashboard/xxx),
    // on retourne sur cette page après login. Sinon fallback dashboard.
    navigate(returnUrl ?? '/dashboard');
  };

  const handleSignIn = async () => {
    setError(null);
    if (!utimail || !password) {
      setError(t('login.requiredError'));
      return;
    }

    setLoading(true);
    try {
      // 1. Résolution du tenant depuis l'email (control-plane lookup, pas besoin de slug
      //    dans l'URL ni dans un champ de formulaire).
      // Cache mémoire (5 min) pour éviter les 429 du throttler /lookup-tenant
      // sur les retry de login. Cf. components/API/tenantLookupCache.ts.
      const slug = await lookupTenantCached(utimail);
      if (!slug) {
        setError(t('login.noAccount'));
        setLoading(false);
        return;
      }
      // Persister immédiatement : apiInstance lit localStorage avant chaque requête
      // pour injecter X-Tenant-Slug, sans ça /Utilisateurs/connect serait rejeté en 400.
      localStorage.setItem('tenantSlug', slug);
    } catch (lookupErr: any) {
      const status = lookupErr?.response?.status;
      setError(status === 404 ? t('login.noAccount') : t('login.cannotVerify'));
      setLoading(false);
      return;
    }

    const user: UserLoginModel = {
      Utimail: utimail,
      Utimps: password,
    };

    apiInstance.post(`/Utilisateurs/connect`, user)
      .then(async response => {
        if (response.data.requires2fa) {
          setRequires2FA(true);
          setTempUticod(response.data.uticod);
        } else {
          await processLoginSuccess(response.data);
        }
      }).catch(async error => {
        console.error('Login failed', error);
        // Tenant en PendingPayment : on rebondit directement sur Stripe Checkout pour
        // que l'utilisateur finalise son paiement avant de pouvoir entrer dans l'app.
        if (error?.response?.status === 402) {
          try {
            await resumeStripeCheckout(utimail.trim(), password);
            return;
          } catch (resumeErr: any) {
            setError(resumeErr?.response?.data?.error || t('login.paymentRequired'));
            return;
          }
        }
        // Email non vérifié : on redirige vers /verify-email pour que l'utilisateur
        // saisisse son code OTP. Le JWT de pré-auth posé au signup est encore valide.
        if (error?.response?.data?.emailNotVerified) {
          navigate('/verify-email', { state: { email: utimail.trim() } });
          return;
        }
        setError(t('login.invalidCredentials'));
      })
      .finally(() => setLoading(false));
  };

  const handleVerify2FA = () => {
    setError(null);
    if (!twoFACode || twoFACode.length !== 6) {
      setError(t('login.twoFAInvalid'));
      return;
    }

    setLoading(true);
    apiInstance.post(`/Utilisateurs/complete-2fa-login`, {
      Uticod: tempUticod,
      Code: twoFACode
    }).then(async response => {
      await processLoginSuccess(response.data);
    }).catch(error => {
      console.error('2FA failed', error);
      setError(t('login.twoFAError'));
    }).finally(() => setLoading(false));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      if (showForgotPassword) handleForgotStep();
      else if (requires2FA) handleVerify2FA();
      else handleSignIn();
    }
  };

  const handleForgotStep = () => {
    if (forgotStep === 'email') {
      handleSendResetCode();
    } else if (forgotStep === 'code') {
      setForgotStep('reset');
    } else {
      handleResetPassword();
    }
  };

  const handleSendResetCode = () => {
    if (!forgotEmail) { setError(t('login.enterEmail')); return; }
    setForgotLoading(true);
    setError(null);
    apiInstance.post('/auth/forgot-password', { Email: forgotEmail })
      .then(res => {
        setSuccess(res.data.message || t('login.codeSent'));
        setForgotStep('code');
      })
      .catch(err => setError(err.response?.data?.message || t('login.codeSendError')))
      .finally(() => setForgotLoading(false));
  };

  const handleResetPassword = () => {
    if (!newPassword || !confirmPassword) { setError(t('login.fillAllFields')); return; }
    if (newPassword !== confirmPassword) { setError(t('login.passwordMismatch')); return; }
    if (newPassword.length < 6) { setError(t('login.passwordTooShort')); return; }
    setForgotLoading(true);
    setError(null);
    apiInstance.post('/auth/reset-password', { Email: forgotEmail, Code: resetCode, NewPassword: newPassword })
      .then(res => {
        setSuccess(res.data.message || t('login.passwordReset'));
        setShowForgotPassword(false);
        setForgotStep('email');
        setForgotEmail('');
        setResetCode('');
        setNewPassword('');
        setConfirmPassword('');
      })
      .catch(err => setError(err.response?.data?.message || t('login.resetError')))
      .finally(() => setForgotLoading(false));
  };

  return (
    <Box className="login-root">
      {/* Left Side: Architectural Canvas */}
      <Box className="login-left">
        <Box className="login-left-bg">
          <img
            src="https://lh3.googleusercontent.com/aida-public/AB6AXuCWqJf3IUUEowPCqYCPt4vLryLnDfZvOC0tonFBF2KVL6-ma6MKEs_0Sh1ax79f_me6Wv8W7-TinaUluS3ZPD7rNZCtrYwOnTg-xYIoDQtgIseYaV8yPhn6o3BsDtiHpGzfwtBPk874gN3wRLU-Kh40AhyHADwh-b8HIelIhd6KPJqSpClx5heiL1LQHCz3B9Mb9nPzmbX9ou-NYhjnQqXtGiFp1f94eXFaW_vC8a2PIhU6Y-fSmnEP8oU0LsfCTnlPHQfFG074zJw"
            alt="Architectural interior"
            className="login-left-img"
          />
          <Box className="login-left-overlay" />
          <Box className="login-left-gradient" />
        </Box>
        <Box className="login-left-content">
          <Box className="login-left-text">
            <Typography className="login-left-title">
              {t('login.leftTitle')}
            </Typography>
            <Typography className="login-left-subtitle">
              {t('login.leftSubtitle')}
            </Typography>
          </Box>
        </Box>
        {/* Logo */}
        <Box className="login-left-logo">
          <Box className="login-logo-icon" sx={{ p: 0.5, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <img src="/concorde-wrokly-logo.jpg" alt="Concorde Logo" style={{ width: 64, height: 64, objectFit: 'contain' }} />
          </Box>
        </Box>
      </Box>

      {/* Right Side: Login Form */}
      <Box className="login-right">
        <Box className="login-form-container">
          {/* Mobile Logo */}
          <Box className="login-mobile-logo">
            <img src="/concorde-wrokly-logo.jpg" alt="Concorde Logo" style={{ width: 140, height: 140, marginBottom: 8, objectFit: 'contain' }} />
          </Box>

          {/* Header — adapté au contexte : en mode setup (lien d'invitation salarié)
              on remplace le titre générique « Bon retour » par un wording d'activation
              centré sur la création du mot de passe initial. Évite de présenter une
              page Login standard à quelqu'un qui n'a jamais eu de compte actif. */}
          <Box className="login-form-header">
            <Typography className="login-form-title">
              {setupMode ? 'Activez votre compte' : t('login.welcome')}
            </Typography>
            <Typography className="login-form-subtitle">
              {setupMode
                ? 'Définissez votre mot de passe pour finaliser votre accès Concorde Workforce.'
                : t('login.subtitle')}
            </Typography>
          </Box>

          {error && (
            <Alert severity="error" sx={{ mb: 3, borderRadius: '12px', fontSize: '13px' }}>
              {error}
            </Alert>
          )}
          {success && (
            <Alert severity="success" sx={{ mb: 3, borderRadius: '12px', fontSize: '13px' }}>
              {success}
            </Alert>
          )}

          {/* Form */}
          <Box className="login-form-fields" onKeyDown={handleKeyDown}>
            {/* En mode setup (?setup=1 dans l'URL = lien d'invitation reçu par mail),
                on N'affiche PAS le formulaire de login standard. L'utilisateur n'a pas
                encore de mot de passe : lui montrer un champ « mot de passe » vide en
                haut de la page, puis le forcer à scroller jusqu'au formulaire d'init
                en bas, est une UX cassée — il croit qu'il doit se connecter alors qu'il
                doit d'abord créer son mot de passe. On rend donc uniquement la section
                « définir mon mot de passe » (rendue plus bas dans showForgotPassword). */}
            {!setupMode && (!requires2FA ? (
              <>
                {/* Email */}
                <Box className="login-field-group">
                  <Typography className="login-field-label">{t('login.email')}</Typography>
                  <TextField
                    fullWidth
                    size="small"
                    type="email"
                    placeholder={t('login.emailPlaceholder')}
                    value={utimail}
                    onChange={(e) => setUtimail(e.target.value)}
                    className="login-input"
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <MailIcon sx={{ color: '#737785', fontSize: 18 }} />
                        </InputAdornment>
                      ),
                    }}
                  />
                </Box>

                {/* Password */}
                <Box className="login-field-group">
                  <Typography className="login-field-label">{t('login.password')}</Typography>
                  <TextField
                    fullWidth
                    size="small"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="login-input"
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <LockIcon sx={{ color: '#737785', fontSize: 18 }} />
                        </InputAdornment>
                      ),
                      endAdornment: (
                        <InputAdornment position="end">
                          <IconButton size="small" onClick={() => setShowPassword(!showPassword)} edge="end">
                            {showPassword ? <VisibilityOffIcon sx={{ fontSize: 18 }} /> : <VisibilityIcon sx={{ fontSize: 18 }} />}
                          </IconButton>
                        </InputAdornment>
                      ),
                    }}
                  />
                </Box>

                {/* Forgot Password Link */}
                <Box sx={{ textAlign: 'right', mt: -1, mb: 1 }}>
                  <Typography
                    component="span"
                    onClick={() => { setShowForgotPassword(true); setError(null); setSuccess(null); setForgotEmail(utimail); }}
                    sx={{ fontSize: '12px', color: '#0040a1', cursor: 'pointer', fontWeight: 600, '&:hover': { textDecoration: 'underline' } }}
                  >
                    {t('login.forgotPassword')}
                  </Typography>
                </Box>

                {/* Société + Site retirés : résolus côté backend depuis le tenant + Socuser de l'utilisateur. */}
              </>
            ) : (
              <Box className="login-field-group" sx={{ textAlign: 'center', mb: 3 }}>
                <Typography className="login-field-label" sx={{ mb: 2 }}>
                  {t('login.twoFAPrompt')}
                </Typography>
                <TextField
                  fullWidth
                  size="medium"
                  type="text"
                  placeholder="000000"
                  value={twoFACode}
                  onChange={(e) => setTwoFACode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  inputProps={{ style: { textAlign: 'center', letterSpacing: '8px', fontSize: '24px' } }}
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      borderRadius: '12px',
                      backgroundColor: '#f8fafc'
                    }
                  }}
                />
              </Box>
            ))}

            {/* Submit principal — masqué en mode setup : le bouton d'activation se
                trouve dans la section forgot-password ci-dessous (« Activer mon compte »). */}
            {!setupMode && (
              <Button
                fullWidth
                onClick={requires2FA ? handleVerify2FA : handleSignIn}
                disabled={loading || (requires2FA && twoFACode.length !== 6)}
                className="login-submit-btn"
                sx={{ color: '#ffffff !important' }}
                endIcon={loading ? <CircularProgress size={18} sx={{ color: '#ffffff' }} /> : <ArrowForwardIcon sx={{ color: '#ffffff' }} />}
              >
                <span style={{ color: '#ffffff' }}>
                  {loading ? t('login.connecting') : (requires2FA ? t('login.verifyCode') : t('login.signIn'))}
                </span>
              </Button>
            )}

            {requires2FA && !setupMode && (
              <Button
                fullWidth
                onClick={() => {
                  setRequires2FA(false);
                  setTwoFACode('');
                  setTempUticod('');
                  setError(null);
                }}
                disabled={loading}
                sx={{ mt: 2, color: '#64748b', fontSize: '13px', textTransform: 'none' }}
              >
                {t('login.backToLogin')}
              </Button>
            )}

            {/* Forgot Password Dialog */}
            {showForgotPassword && (
              <Box sx={{ mt: 2 }}>
                {/* Bannière contextuelle en mode « setup » : l'utilisateur arrive
                    depuis un email de bienvenue, il faut lui dire qu'il définit
                    son MDP pour la première fois (et non qu'il « réinitialise »). */}
                {setupMode && forgotStep === 'reset' && (
                  <Box sx={{
                    background: 'linear-gradient(135deg,#eff6ff 0%,#dbeafe 100%)',
                    border: '1px solid #bfdbfe', borderRadius: 2,
                    p: 2, mb: 2,
                  }}>
                    <Typography sx={{ fontSize: 13, fontWeight: 800, color: '#0040a1', mb: 0.5 }}>
                      Bienvenue sur Concorde Workforce
                    </Typography>
                    <Typography sx={{ fontSize: 12, color: '#1e40af', lineHeight: 1.5 }}>
                      Choisissez votre mot de passe pour activer votre compte
                      ({forgotEmail}). Il vous servira à toutes vos prochaines connexions.
                    </Typography>
                  </Box>
                )}
                {forgotStep === 'email' && (
                  <Box className="login-field-group">
                    <Typography className="login-field-label" sx={{ mb: 1 }}>{t('login.forgotPromptEmail')}</Typography>
                    <TextField
                      fullWidth size="small" type="email" placeholder={t('login.emailPlaceholder')}
                      value={forgotEmail} onChange={(e) => setForgotEmail(e.target.value)}
                      className="login-input"
                      InputProps={{ startAdornment: <InputAdornment position="start"><MailIcon sx={{ color: '#737785', fontSize: 18 }} /></InputAdornment> }}
                    />
                  </Box>
                )}
                {forgotStep === 'code' && (
                  <Box className="login-field-group">
                    <Typography className="login-field-label" sx={{ mb: 1 }}>{t('login.forgotPromptCode')}</Typography>
                    <TextField
                      fullWidth size="small" type="text" placeholder="000000"
                      value={resetCode} onChange={(e) => setResetCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      inputProps={{ style: { textAlign: 'center', letterSpacing: '4px' } }}
                      className="login-input"
                    />
                  </Box>
                )}
                {forgotStep === 'reset' && (
                  <>
                    <Box className="login-field-group">
                      <Typography className="login-field-label">{t('login.newPassword')}</Typography>
                      <TextField
                        fullWidth size="small" type={showPassword ? 'text' : 'password'} placeholder="••••••••"
                        value={newPassword} onChange={(e) => setNewPassword(e.target.value)}
                        className="login-input"
                        InputProps={{ startAdornment: <InputAdornment position="start"><LockIcon sx={{ color: '#737785', fontSize: 18 }} /></InputAdornment> }}
                      />
                    </Box>
                    <Box className="login-field-group">
                      <Typography className="login-field-label">{t('login.confirmPassword')}</Typography>
                      <TextField
                        fullWidth size="small" type={showPassword ? 'text' : 'password'} placeholder="••••••••"
                        value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)}
                        className="login-input"
                        InputProps={{ startAdornment: <InputAdornment position="start"><LockIcon sx={{ color: '#737785', fontSize: 18 }} /></InputAdornment> }}
                      />
                    </Box>
                  </>
                )}
                <Button
                  fullWidth onClick={handleForgotStep} disabled={forgotLoading}
                  className="login-submit-btn" sx={{ color: '#ffffff !important', mt: 1 }}
                  endIcon={forgotLoading ? <CircularProgress size={18} sx={{ color: '#ffffff' }} /> : <ArrowForwardIcon sx={{ color: '#ffffff' }} />}
                >
                  <span style={{ color: '#ffffff' }}>
                    {forgotLoading
                      ? t('login.loading')
                      : forgotStep === 'email'
                        ? t('login.sendCode')
                        : forgotStep === 'code'
                          ? t('login.verifyCode')
                          : (setupMode ? 'Activer mon compte' : t('login.reset'))}
                  </span>
                </Button>
                <Button
                  fullWidth
                  onClick={() => {
                    setShowForgotPassword(false);
                    setForgotStep('email');
                    setSetupMode(false);
                    setError(null);
                    setSuccess(null);
                  }}
                  sx={{ mt: 1, color: '#64748b', fontSize: '13px', textTransform: 'none' }}
                >
                  {t('login.backToLogin')}
                </Button>
              </Box>
            )}
          </Box>

          {/* Footer : lien d'inscription + lien support. Le lien « Inscrivez-vous »
              est placé en évidence (au-dessus du lien support) parce que c'est
              l'action de fallback la plus probable quand l'utilisateur arrive
              ici sans compte — pattern aligné avec app.dougs.fr/signin et la
              majorité des SaaS modernes. En mode setup (activation par lien email)
              on le masque : il n'a pas de sens, l'utilisateur EST déjà inscrit. */}
          <Box className="login-footer">
            {!setupMode && (
              <Typography className="login-footer-text" sx={{ mb: 1.5 }}>
                {t('login.noAccountYet', "Vous n'avez pas encore de compte ?")}{' '}
                <span
                  role="link"
                  tabIndex={0}
                  className="login-footer-link"
                  onClick={() => navigate('/signup')}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') navigate('/signup'); }}
                  style={{ cursor: 'pointer' }}
                >
                  {t('login.signUpHere', 'Inscrivez-vous')}
                </span>
              </Typography>
            )}
            <Typography className="login-footer-text">
              {t('login.needHelp')}{' '}
              <a
                className="login-footer-link"
                href="mailto:contact@concorde-tech.fr?subject=Demande%20d%27assistance%20%E2%80%94%20Concorde%20Workforce"
                rel="noopener noreferrer"
              >
                {t('login.contactSupport')}
              </a>
            </Typography>
          </Box>
        </Box>
      </Box>
    </Box>
  );
}