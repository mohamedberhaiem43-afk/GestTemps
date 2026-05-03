import { useState } from 'react';
import {
  Box, Typography, TextField, Button, CircularProgress, Alert,
  InputAdornment, IconButton,
} from '@mui/material';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import apiInstance from '../API/apiInstance';
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
  const { setAuthData, refreshAuth } = useAuth();
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

  // Forgot password state
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [resetCode, setResetCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [forgotStep, setForgotStep] = useState<'email' | 'code' | 'reset'>('email');
  const [forgotLoading, setForgotLoading] = useState(false);

  // En SaaS multi-tenant, la société et le site sont résolus côté backend depuis le
  // tenant courant + le Socuser de l'utilisateur. Plus besoin de les demander à l'écran.

  const [requires2FA, setRequires2FA] = useState(false);
  const [twoFACode, setTwoFACode] = useState('');
  const [tempUticod, setTempUticod] = useState('');

  const processLoginSuccess = async (data: any) => {
    const { societe, Utiimg, socimg } = data;

    if (Utiimg) localStorage.setItem('profileImage', Utiimg);
    else localStorage.removeItem('profileImage');

    if (socimg) localStorage.setItem('societeImage', socimg);
    else localStorage.removeItem('societeImage');
    setAuthData({
      soccod: societe.soccod,
      sitcod: societe.sitcod,
      userName: data.utilib,
      soclib: data.soclib,
      uticod: data.Uticod ?? null,
      utiadm: data.Utiadm ?? null,
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
    navigate('/dashboard');
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
      const lookup = await apiInstance.post('/auth/lookup-tenant', { email: utimail.trim() });
      const slug: string | undefined = lookup.data?.slug;
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
            <img src="/Concorde.png" alt="Concorde Logo" style={{ width: 64, height: 64, objectFit: 'contain' }} />
          </Box>
        </Box>
      </Box>

      {/* Right Side: Login Form */}
      <Box className="login-right">
        <Box className="login-form-container">
          {/* Mobile Logo */}
          <Box className="login-mobile-logo">
            <img src="/Concorde.png" alt="Concorde Logo" style={{ width: 140, height: 140, marginBottom: 8, objectFit: 'contain' }} />
          </Box>

          {/* Header */}
          <Box className="login-form-header">
            <Typography className="login-form-title">{t('login.welcome')}</Typography>
            <Typography className="login-form-subtitle">
              {t('login.subtitle')}
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
            {!requires2FA ? (
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
            )}

            {/* Submit */}
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

            {requires2FA && (
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
                    {forgotLoading ? t('login.loading') : (forgotStep === 'email' ? t('login.sendCode') : forgotStep === 'code' ? t('login.verifyCode') : t('login.reset'))}
                  </span>
                </Button>
                <Button
                  fullWidth
                  onClick={() => { setShowForgotPassword(false); setForgotStep('email'); setError(null); setSuccess(null); }}
                  sx={{ mt: 1, color: '#64748b', fontSize: '13px', textTransform: 'none' }}
                >
                  {t('login.backToLogin')}
                </Button>
              </Box>
            )}
          </Box>

          {/* Footer */}
          <Box className="login-footer">
            <Typography className="login-footer-text">
              {t('login.needHelp')} <span className="login-footer-link">{t('login.contactSupport')}</span>
            </Typography>
          </Box>
        </Box>
      </Box>
    </Box>
  );
}