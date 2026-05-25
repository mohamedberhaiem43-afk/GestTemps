import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Box, Typography, TextField, Button, CircularProgress, Alert, Paper, Stack, Link,
} from '@mui/material';
import MarkEmailReadIcon from '@mui/icons-material/MarkEmailRead';
import apiInstance from '../API/apiInstance';
import { useAuth } from '../helper/AuthProvider';
import { startStripeCheckout } from '../Pricing/stripeCheckout';

/**
 * Page de vérification de l'email post-signup. L'utilisateur arrive ici juste après
 * /api/signup : son cookie JWT est posé, /me lui renvoie emailVerified=false, et un
 * code OTP 6 chiffres a été envoyé sur l'adresse renseignée à l'inscription.
 *
 * Flow :
 *   1. Affichage : 6 inputs single-digit + email destinataire + bouton « Vérifier ».
 *   2. Submit → POST /Utilisateurs/verify-email { code }.
 *   3. Sur succès → refreshAuth() + redirige vers Stripe Checkout si pendingStripeCheckout
 *      en sessionStorage (cas signup avec plan/userCount), sinon vers /dashboard.
 *   4. Bouton « Renvoyer le code » → POST /Utilisateurs/resend-verification, cooldown 60s.
 *
 * Page non bloquante : un lien « Plus tard » envoie vers /dashboard où une bannière
 * persistante rappelle de finir la vérification. C'est un compromis : on valorise la
 * vérification (étape encouragée + bannière) sans bloquer un utilisateur qui aurait
 * un problème de SMTP côté boîte de destination.
 */
export default function VerifyEmailPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { utimail, emailVerified, refreshAuth, uticod, authReady } = useAuth();

  // L'email peut venir de 3 sources, par priorité décroissante :
  //   1. state de navigation depuis SignupPage (le plus frais, frappé à la main par l'user) ;
  //   2. utimail issu de /me (post-signup, présent dès que refreshAuth a tourné) ;
  //   3. fallback "votre adresse" si ni l'un ni l'autre (cas refresh navigateur sans state).
  const stateEmail = (location.state as any)?.email as string | undefined;
  const emailDisplay = stateEmail ?? utimail ?? '';
  const maskedEmail = useMemo(() => maskEmail(emailDisplay), [emailDisplay]);

  // Tableau de 6 caractères pour les inputs single-digit. Le code complet est leur join.
  const [digits, setDigits] = useState<string[]>(['', '', '', '', '', '']);
  const inputsRef = useRef<Array<HTMLInputElement | null>>([]);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [resending, setResending] = useState(false);
  // Cooldown anti-spam côté UI (synchronisé avec ResendCooldownSeconds backend = 60s).
  // Compte à rebours visuel pour que l'utilisateur sache quand il peut redemander.
  const [cooldownSec, setCooldownSec] = useState(0);

  // Décrément du cooldown : 1s par tick. Quand on arrive à 0, le bouton se réactive.
  useEffect(() => {
    if (cooldownSec <= 0) return;
    const t = setTimeout(() => setCooldownSec((c) => Math.max(0, c - 1)), 1000);
    return () => clearTimeout(t);
  }, [cooldownSec]);

  // Sortie automatique : si l'utilisateur arrive ici alors qu'il est déjà vérifié
  // (ex: il clique sur le bookmark /verify-email après vérif), on l'envoie directement
  // au dashboard. On n'agit qu'après authReady pour éviter de "flasher" la page pendant
  // que /me est en vol au mount.
  useEffect(() => {
    if (!authReady) return;
    // Pas connecté du tout → /login (l'utilisateur a peut-être recharger après logout).
    if (!uticod) {
      navigate('/login', { replace: true });
      return;
    }
    if (emailVerified) {
      navigate('/dashboard', { replace: true });
    }
  }, [authReady, uticod, emailVerified, navigate]);

  // Gestion du paste : si l'utilisateur colle un code complet de 6 chiffres dans
  // n'importe quel input, on le distribue automatiquement sur les 6 cases. Sans ça,
  // copier-coller depuis l'email casse le flow (seule la première case se remplit).
  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (pasted.length === 0) return;
    e.preventDefault();
    const next = ['', '', '', '', '', ''];
    for (let i = 0; i < pasted.length; i++) next[i] = pasted[i];
    setDigits(next);
    const focusIdx = Math.min(pasted.length, 5);
    inputsRef.current[focusIdx]?.focus();
  };

  const handleDigitChange = (idx: number, val: string) => {
    const digit = val.replace(/\D/g, '').slice(-1); // dernier caractère numérique
    const next = [...digits];
    next[idx] = digit;
    setDigits(next);
    if (digit && idx < 5) inputsRef.current[idx + 1]?.focus();
  };

  const handleKeyDown = (idx: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    // Backspace sur input vide : on recule le curseur. UX standard sur les OTP inputs.
    if (e.key === 'Backspace' && !digits[idx] && idx > 0) {
      inputsRef.current[idx - 1]?.focus();
    }
  };

  const submit = async () => {
    setError(null);
    setInfo(null);
    const code = digits.join('');
    if (code.length !== 6) {
      setError('Veuillez saisir les 6 chiffres du code.');
      return;
    }
    setSubmitting(true);
    try {
      await apiInstance.post('/Utilisateurs/verify-email', { code });
      // Rafraîchit /me pour mettre emailVerified=true dans le contexte avant la
      // redirection (la prochaine page lit useAuth().emailVerified au mount).
      await refreshAuth();
      setInfo('Email vérifié ! Redirection…');

      // Marqueur "première visite post-signup" : consommé par OnboardingGuide pour
      // s'auto-ouvrir + scroller + se mettre en surbrillance brièvement. Le flag
      // est posé MÊME quand on part sur Stripe : au retour de Stripe (success_url
      // = /dashboard?...), le guide se révèle proprement à l'arrivée sur le dashboard.
      sessionStorage.setItem('justSignedUp', '1');

      // Reprise du flux post-vérif :
      //   - si un Stripe Checkout est en attente (signup avec plan/userCount), on le déclenche ;
      //   - sinon, dashboard.
      const pending = sessionStorage.getItem('pendingStripeCheckout');
      if (pending) {
        sessionStorage.removeItem('pendingStripeCheckout');
        try {
          const intent = JSON.parse(pending);
          await startStripeCheckout({
            plan: intent.plan,
            cycle: intent.cycle ?? 'annual',
            userCount: intent.userCount,
          });
          return; // startStripeCheckout fait window.location.href = data.url
        } catch {
          // JSON corrompu ou checkout en échec : on continue sur dashboard, l'admin
          // pourra relancer le paiement depuis /mon-abonnement.
        }
      }
      setTimeout(() => navigate('/dashboard', { replace: true }), 800);
    } catch (e: any) {
      const data = e?.response?.data;
      setError(data?.error || 'Vérification échouée. Réessayez.');
      // Si le code est expiré ou que toutes les tentatives sont consommées, on vide
      // les inputs pour que l'utilisateur reparte sur un nouveau code propre.
      if (data?.code === 'code_expired' || data?.code === 'too_many_attempts' || data?.code === 'no_code_issued') {
        setDigits(['', '', '', '', '', '']);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const resend = async () => {
    setError(null);
    setInfo(null);
    setResending(true);
    try {
      const { data } = await apiInstance.post('/Utilisateurs/resend-verification');
      if (data?.alreadyVerified) {
        setInfo('Votre email est déjà vérifié.');
        await refreshAuth();
        setTimeout(() => navigate('/dashboard', { replace: true }), 1000);
        return;
      }
      setInfo('Un nouveau code a été envoyé. Vérifiez votre boîte de réception (et le dossier spam).');
      setCooldownSec(60);
      setDigits(['', '', '', '', '', '']);
      inputsRef.current[0]?.focus();
    } catch (e: any) {
      const data = e?.response?.data;
      if (data?.code === 'cooldown' && typeof data?.retryAfterSeconds === 'number') {
        setCooldownSec(data.retryAfterSeconds);
        setError(data.error);
      } else {
        setError(data?.error || 'Impossible d\'envoyer le code. Réessayez dans quelques instants.');
      }
    } finally {
      setResending(false);
    }
  };

  const canSubmit = !submitting && digits.every((d) => d.length === 1);

  return (
    <Box sx={{
      minHeight: '100vh', bgcolor: '#f7f7fa', display: 'flex',
      alignItems: 'center', justifyContent: 'center', p: { xs: 2, md: 4 },
    }}>
      <Paper elevation={2} sx={{ maxWidth: 520, width: '100%', p: { xs: 3, md: 5 }, borderRadius: 3 }}>
        <Box sx={{ textAlign: 'center', mb: 3 }}>
          <Box sx={{
            width: 64, height: 64, borderRadius: '50%', bgcolor: '#eef2f8',
            color: '#0040a1', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', mb: 2,
          }}>
            <MarkEmailReadIcon sx={{ fontSize: 32 }} />
          </Box>
          <Typography variant="h4" fontWeight={800} sx={{ mb: 1 }}>
            Vérifiez votre email
          </Typography>
          <Typography color="text.secondary">
            Nous avons envoyé un code à 6 chiffres à{' '}
            <Box component="span" sx={{ fontWeight: 700, color: '#0f172a' }}>{maskedEmail || 'votre adresse'}</Box>.
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
            Code valable 15 minutes — pensez à vérifier votre dossier spam.
          </Typography>
        </Box>

        <Stack spacing={3}>
          {error && <Alert severity="error" onClose={() => setError(null)}>{error}</Alert>}
          {info && <Alert severity="success" onClose={() => setInfo(null)}>{info}</Alert>}

          <Stack direction="row" spacing={1} justifyContent="center">
            {digits.map((d, i) => (
              <TextField
                key={i}
                value={d}
                onChange={(e) => handleDigitChange(i, e.target.value)}
                onKeyDown={(e) => handleKeyDown(i, e as React.KeyboardEvent<HTMLInputElement>)}
                onPaste={handlePaste}
                inputRef={(el) => { inputsRef.current[i] = el; }}
                inputProps={{
                  inputMode: 'numeric',
                  maxLength: 1,
                  style: { textAlign: 'center', fontSize: 24, fontWeight: 700, padding: '12px 0', width: 44 },
                }}
                autoFocus={i === 0}
              />
            ))}
          </Stack>

          <Button
            variant="contained"
            size="large"
            disabled={!canSubmit}
            onClick={submit}
            sx={{ py: 1.5, fontWeight: 700 }}
          >
            {submitting ? <CircularProgress size={22} /> : 'Vérifier mon email'}
          </Button>

          <Stack direction="row" spacing={1} alignItems="center" justifyContent="center">
            <Typography variant="body2" color="text.secondary">
              Code non reçu ?
            </Typography>
            <Link
              component="button"
              type="button"
              disabled={resending || cooldownSec > 0}
              onClick={resend}
              sx={{ fontWeight: 600, color: cooldownSec > 0 ? 'text.disabled' : 'primary.main' }}
            >
              {resending ? 'Envoi…' : cooldownSec > 0 ? `Renvoyer dans ${cooldownSec}s` : 'Renvoyer un code'}
            </Link>
          </Stack>

          <Box sx={{ textAlign: 'center', pt: 1 }}>
            <Link
              component="button"
              type="button"
              onClick={() => navigate('/dashboard', { replace: true })}
              sx={{ color: 'text.secondary', textDecoration: 'underline', fontSize: 13 }}
            >
              Vérifier plus tard
            </Link>
          </Box>
        </Stack>
      </Paper>
    </Box>
  );
}

/**
 * Affiche l'email en masquant la partie locale pour l'audit visuel sans révéler l'adresse
 * complète dans une éventuelle capture d'écran. Ex: "mohamed@concorde.com" → "m••••d@concorde.com".
 */
function maskEmail(email: string): string {
  if (!email || !email.includes('@')) return email;
  const [local, domain] = email.split('@');
  if (local.length <= 2) return `${local}@${domain}`;
  return `${local[0]}${'•'.repeat(Math.max(2, local.length - 2))}${local[local.length - 1]}@${domain}`;
}
