import { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Box, Typography, TextField, Button, CircularProgress, Alert,
  Paper, Stack,
} from '@mui/material';
import MailOutlineIcon from '@mui/icons-material/MailOutline';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import apiInstance from '../API/apiInstance';
import { useAuth } from '../helper/AuthProvider';

export default function VerifyEmailPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { refreshAuth } = useAuth();

  const email = (location.state as any)?.email ?? '';
  const [digits, setDigits] = useState(['', '', '', '', '', '']);
  const [submitting, setSubmitting] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Cooldown timer for resend button
  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown(c => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  // Auto-focus first digit on mount
  useEffect(() => {
    inputRefs.current[0]?.focus();
  }, []);

  const handleChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return;
    const newDigits = [...digits];
    newDigits[index] = value.slice(-1);
    setDigits(newDigits);
    setError(null);

    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }

    if (value && index === 5 && newDigits.every(d => d !== '')) {
      handleSubmit(newDigits.join(''));
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !digits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (!pasted) return;
    const newDigits = [...digits];
    for (let i = 0; i < 6; i++) {
      newDigits[i] = pasted[i] ?? '';
    }
    setDigits(newDigits);
    const focusIdx = Math.min(pasted.length, 5);
    inputRefs.current[focusIdx]?.focus();

    if (pasted.length === 6) {
      handleSubmit(pasted);
    }
  };

  const handleSubmit = async (code?: string) => {
    const codeStr = code ?? digits.join('');
    if (codeStr.length !== 6) {
      setError('Veuillez saisir les 6 chiffres du code.');
      return;
    }

    setError(null);
    setSubmitting(true);
    try {
      await apiInstance.post('/Utilisateurs/verify-email', { code: codeStr });
      setSuccess(true);
      await refreshAuth();
      setTimeout(() => navigate('/dashboard', { replace: true }), 1500);
    } catch (e: any) {
      const errCode = e?.response?.data?.code;
      const errMsg = e?.response?.data?.error;
      if (errCode === 'code_expired') {
        setError('Code expiré. Demandez un nouveau code.');
      } else if (errCode === 'too_many_attempts') {
        setError('Trop de tentatives. Demandez un nouveau code.');
      } else if (errCode === 'no_code_issued') {
        setError('Aucun code en cours. Demandez un nouveau code.');
      } else {
        setError(errMsg || 'Code incorrect. Vérifiez et réessayez.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleResend = async () => {
    if (cooldown > 0 || resending) return;
    setResending(true);
    setError(null);
    try {
      const { data } = await apiInstance.post('/Utilisateurs/resend-verification');
      if (data?.alreadyVerified) {
        setSuccess(true);
        await refreshAuth();
        setTimeout(() => navigate('/dashboard', { replace: true }), 1000);
        return;
      }
      setCooldown(60);
      setDigits(['', '', '', '', '', '']);
      inputRefs.current[0]?.focus();
    } catch (e: any) {
      const wait = e?.response?.data?.retryAfterSeconds;
      if (e?.response?.status === 429 && wait) {
        setCooldown(wait);
      } else {
        setError(e?.response?.data?.error || 'Erreur lors du renvoi. Réessayez.');
      }
    } finally {
      setResending(false);
    }
  };

  return (
    <Box sx={{
      minHeight: '100vh',
      bgcolor: '#f7f7fa',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      p: { xs: 2, md: 4 },
    }}>
      <Paper elevation={2} sx={{ maxWidth: 480, width: '100%', p: { xs: 3, md: 5 }, borderRadius: 3, textAlign: 'center' }}>
        {success ? (
          <>
            <CheckCircleOutlineIcon sx={{ fontSize: 64, color: 'success.main', mb: 2 }} />
            <Typography variant="h5" fontWeight={700} sx={{ mb: 1 }}>
              Email vérifié !
            </Typography>
            <Typography color="text.secondary">
              Redirection vers votre tableau de bord…
            </Typography>
            <Box sx={{ mt: 3 }}>
              <CircularProgress size={24} />
            </Box>
          </>
        ) : (
          <>
            <MailOutlineIcon sx={{ fontSize: 56, color: 'primary.main', mb: 2 }} />
            <Typography variant="h5" fontWeight={700} sx={{ mb: 1 }}>
              Vérifiez votre email
            </Typography>
            <Typography color="text.secondary" sx={{ mb: 3 }}>
              {email
                ? <>Un code à 6 chiffres a été envoyé à <strong>{email}</strong></>
                : 'Un code à 6 chiffres a été envoyé à votre adresse email'}
            </Typography>

            {/* 6-digit OTP input */}
            <Box sx={{ display: 'flex', justifyContent: 'center', gap: 1.5, mb: 3 }}>
              {digits.map((digit, i) => (
                <TextField
                  key={i}
                  inputRef={(el) => { inputRefs.current[i] = el; }}
                  value={digit}
                  onChange={(e) => handleChange(i, e.target.value)}
                  onKeyDown={(e) => handleKeyDown(i, e)}
                  onPaste={i === 0 ? handlePaste : undefined}
                  disabled={submitting}
                  inputProps={{
                    maxLength: 1,
                    inputMode: 'numeric',
                    pattern: '[0-9]',
                    style: {
                      textAlign: 'center',
                      fontSize: '1.5rem',
                      fontWeight: 700,
                      padding: '12px 0',
                      width: '48px',
                    },
                  }}
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      borderRadius: 2,
                    },
                  }}
                />
              ))}
            </Box>

            {error && (
              <Alert severity="error" sx={{ mb: 2, textAlign: 'left' }}>
                {error}
              </Alert>
            )}

            <Button
              variant="contained"
              size="large"
              fullWidth
              disabled={submitting || digits.some(d => !d)}
              onClick={() => handleSubmit()}
              sx={{ py: 1.5, fontWeight: 700, mb: 2 }}
            >
              {submitting ? <CircularProgress size={22} color="inherit" /> : 'Vérifier'}
            </Button>

            <Stack direction="row" spacing={1} justifyContent="center" alignItems="center">
              <Typography variant="body2" color="text.secondary">
                Vous n'avez pas reçu le code ?
              </Typography>
              <Button
                size="small"
                onClick={handleResend}
                disabled={cooldown > 0 || resending}
                sx={{ textTransform: 'none' }}
              >
                {resending
                  ? 'Envoi…'
                  : cooldown > 0
                    ? `Renvoyer (${cooldown}s)`
                    : 'Renvoyer le code'}
              </Button>
            </Stack>

            <Box sx={{ mt: 3, pt: 2, borderTop: '1px solid #e2e8f0' }}>
              <Typography variant="caption" color="text.secondary">
                Le code est valable 15 minutes. Vérifiez vos spams si nécessaire.
              </Typography>
            </Box>
          </>
        )}
      </Paper>
    </Box>
  );
}