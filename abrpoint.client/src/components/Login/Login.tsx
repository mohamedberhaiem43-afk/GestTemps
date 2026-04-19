import { useEffect, useState } from 'react';
import {
  Box, Typography, TextField, Button, CircularProgress, Alert,
  MenuItem, FormControl, Select, InputAdornment, IconButton,
} from '@mui/material';
import { useNavigate } from 'react-router-dom';
import apiInstance from '../API/apiInstance';
import { useAuth } from '../helper/AuthProvider';
import MailIcon from '@mui/icons-material/Mail';
import LockIcon from '@mui/icons-material/Lock';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import AccountTreeIcon from '@mui/icons-material/AccountTree';
import './Login.css';

interface UserLoginModel {
  Utimail: string;
  Utimps: string;
  Usersit?: string;
  Company?: string;
}

export default function CredentialsSignInPage() {
  const { setAuthData, refreshAuth } = useAuth();
  const [utimail, setUtimail] = useState('');
  const [usersit, setUsersit] = useState('');
  const [password, setPassword] = useState('');
  const [company, setCompany] = useState('');
  const [societes, setSocietes] = useState<Record<string, string>>({});
  const [sites, setSites] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const navigate = useNavigate();

  // Forgot password state
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [resetCode, setResetCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [forgotStep, setForgotStep] = useState<'email' | 'code' | 'reset'>('email');
  const [forgotLoading, setForgotLoading] = useState(false);

  useEffect(() => {
    Promise.all([
      apiInstance.get(`/Societes/get-soclibs`),
      apiInstance.get(`/Sites/get-sitlibs`)
    ])
      .then(([societesRes, sitesRes]) => {
        setSocietes(societesRes.data);
        setSites(sitesRes.data);
      })
      .catch(err => {
        console.error('Error fetching data', err);
        setError('Failed to load data.');
      });
  }, []);

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
      isEmp: Boolean(data.isEmp),
    });
    await refreshAuth();
    window.dispatchEvent(new Event('utiadmUpdated'));
    window.dispatchEvent(new Event('imageUpdated'));
    navigate('/dashboard');
  };

  const handleSignIn = () => {
    setError(null);
    if (!utimail || !password) {
      setError('Veuillez remplir tous les champs obligatoires');
      return;
    }

    const user: UserLoginModel = {
      Utimail: utimail,
      Utimps: password,
      Usersit: usersit || undefined,
      Company: company || undefined,
    };

    setLoading(true);
    apiInstance.post(`/Utilisateurs/connect`, user)
      .then(async response => {
        if (response.data.requires2fa) {
          setRequires2FA(true);
          setTempUticod(response.data.uticod);
        } else {
          await processLoginSuccess(response.data);
        }
      }).catch(error => {
        console.error('Login failed', error);
        setError('Identifiants incorrects. Veuillez réessayer.');
      })
      .finally(() => setLoading(false));
  };

  const handleVerify2FA = () => {
    setError(null);
    if (!twoFACode || twoFACode.length !== 6) {
      setError('Veuillez entrer un code à 6 chiffres valide');
      return;
    }

    setLoading(true);
    apiInstance.post(`/Utilisateurs/complete-2fa-login`, {
      Uticod: tempUticod,
      Company: company || undefined,
      Usersit: usersit || undefined,
      Code: twoFACode
    }).then(async response => {
      await processLoginSuccess(response.data);
    }).catch(error => {
      console.error('2FA failed', error);
      setError('Code incorrect. Veuillez réessayer.');
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
    if (!forgotEmail) { setError('Veuillez entrer votre email.'); return; }
    setForgotLoading(true);
    setError(null);
    apiInstance.post('/Utilisateurs/forgot-password', { Utimail: forgotEmail })
      .then(res => {
        setSuccess(res.data.Message || 'Code envoyé.');
        setForgotStep('code');
      })
      .catch(err => setError(err.response?.data?.Message || 'Erreur lors de l\'envoi du code.'))
      .finally(() => setForgotLoading(false));
  };

  const handleResetPassword = () => {
    if (!newPassword || !confirmPassword) { setError('Veuillez remplir tous les champs.'); return; }
    if (newPassword !== confirmPassword) { setError('Les mots de passe ne correspondent pas.'); return; }
    if (newPassword.length < 6) { setError('Le mot de passe doit contenir au moins 6 caractères.'); return; }
    setForgotLoading(true);
    setError(null);
    apiInstance.post('/Utilisateurs/reset-password-with-code', { Utimail: forgotEmail, Code: resetCode, NewPassword: newPassword })
      .then(res => {
        setSuccess(res.data.Message || 'Mot de passe réinitialisé.');
        setShowForgotPassword(false);
        setForgotStep('email');
        setForgotEmail('');
        setResetCode('');
        setNewPassword('');
        setConfirmPassword('');
      })
      .catch(err => setError(err.response?.data?.Message || 'Erreur lors de la réinitialisation.'))
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
              L'excellence structurelle au service de votre capital humain.
            </Typography>
            <Typography className="login-left-subtitle">
              Pilotez votre organisation avec la précision d'un architecte. Structure HR centralise et sublime vos données RH.
            </Typography>
          </Box>
        </Box>
        {/* Logo */}
        <Box className="login-left-logo">
          <Box className="login-logo-icon">
            <AccountTreeIcon sx={{ color: '#0040a1', fontSize: 22 }} />
          </Box>
          <Typography className="login-logo-text">Structure HR</Typography>
        </Box>
      </Box>

      {/* Right Side: Login Form */}
      <Box className="login-right">
        <Box className="login-form-container">
          {/* Mobile Logo */}
          <Box className="login-mobile-logo">
            <AccountTreeIcon sx={{ color: '#0040a1', fontSize: 48, mb: 1 }} />
            <Typography className="login-mobile-logo-text">Structure HR</Typography>
          </Box>

          {/* Header */}
          <Box className="login-form-header">
            <Typography className="login-form-title">Bon retour.</Typography>
            <Typography className="login-form-subtitle">
              Veuillez renseigner vos identifiants pour accéder au registre architectural.
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
                  <Typography className="login-field-label">Email</Typography>
                  <TextField
                    fullWidth
                    size="small"
                    type="email"
                    placeholder="nom@entreprise.com"
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
                  <Typography className="login-field-label">Mot de passe</Typography>
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
                    Mot de passe oublié ?
                  </Typography>
                </Box>

                {/* Company & Site */}
                <Box className="login-field-row">
                  <Box className="login-field-group" sx={{ flex: 1 }}>
                    <Typography className="login-field-label">Société</Typography>
                    <FormControl fullWidth size="small" className="login-input">
                      <Select
                        value={company}
                        onChange={(e) => setCompany(e.target.value)}
                        displayEmpty
                        renderValue={(v) => v ? String(societes[v] || v) : 'ID Société'}
                        sx={{ borderRadius: '12px', backgroundColor: '#f2f4f6', fontSize: '13px' }}
                      >
                        {Object.entries(societes).map(([k, v]) => (
                          <MenuItem key={k} value={k}>{String(v)}</MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  </Box>
                  <Box className="login-field-group" sx={{ flex: 1 }}>
                    <Typography className="login-field-label">Filiale / Site</Typography>
                    <FormControl fullWidth size="small" className="login-input">
                      <Select
                        value={usersit}
                        onChange={(e) => setUsersit(e.target.value)}
                        displayEmpty
                        renderValue={(v) => v ? String(sites[v] || v) : 'Localisation'}
                        sx={{ borderRadius: '12px', backgroundColor: '#f2f4f6', fontSize: '13px' }}
                      >
                        {Object.entries(sites).map(([k, v]) => (
                          <MenuItem key={k} value={k}>{String(v)}</MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  </Box>
                </Box>
              </>
            ) : (
              <Box className="login-field-group" sx={{ textAlign: 'center', mb: 3 }}>
                <Typography className="login-field-label" sx={{ mb: 2 }}>
                  Entrez le code à 6 chiffres de votre application Google Authenticator / Authy :
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
                {loading ? 'Connexion...' : (requires2FA ? 'VÉRIFIER LE CODE' : 'CONNECTER')}
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
                Retour à la connexion
              </Button>
            )}

            {/* Forgot Password Dialog */}
            {showForgotPassword && (
              <Box sx={{ mt: 2 }}>
                {forgotStep === 'email' && (
                  <Box className="login-field-group">
                    <Typography className="login-field-label" sx={{ mb: 1 }}>Entrez votre email pour réinitialiser votre mot de passe</Typography>
                    <TextField
                      fullWidth size="small" type="email" placeholder="nom@entreprise.com"
                      value={forgotEmail} onChange={(e) => setForgotEmail(e.target.value)}
                      className="login-input"
                      InputProps={{ startAdornment: <InputAdornment position="start"><MailIcon sx={{ color: '#737785', fontSize: 18 }} /></InputAdornment> }}
                    />
                  </Box>
                )}
                {forgotStep === 'code' && (
                  <Box className="login-field-group">
                    <Typography className="login-field-label" sx={{ mb: 1 }}>Entrez le code de réinitialisation envoyé à votre email</Typography>
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
                      <Typography className="login-field-label">Nouveau mot de passe</Typography>
                      <TextField
                        fullWidth size="small" type={showPassword ? 'text' : 'password'} placeholder="••••••••"
                        value={newPassword} onChange={(e) => setNewPassword(e.target.value)}
                        className="login-input"
                        InputProps={{ startAdornment: <InputAdornment position="start"><LockIcon sx={{ color: '#737785', fontSize: 18 }} /></InputAdornment> }}
                      />
                    </Box>
                    <Box className="login-field-group">
                      <Typography className="login-field-label">Confirmer le mot de passe</Typography>
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
                    {forgotLoading ? 'Chargement...' : (forgotStep === 'email' ? 'ENVOYER LE CODE' : forgotStep === 'code' ? 'VÉRIFIER LE CODE' : 'RÉINITIALISER')}
                  </span>
                </Button>
                <Button
                  fullWidth
                  onClick={() => { setShowForgotPassword(false); setForgotStep('email'); setError(null); setSuccess(null); }}
                  sx={{ mt: 1, color: '#64748b', fontSize: '13px', textTransform: 'none' }}
                >
                  Retour à la connexion
                </Button>
              </Box>
            )}
          </Box>

          {/* Footer */}
          <Box className="login-footer">
            <Typography className="login-footer-text">
              Besoin d'assistance ? <span className="login-footer-link">Contactez le support</span>
            </Typography>
          </Box>
        </Box>
      </Box>
    </Box>
  );
}