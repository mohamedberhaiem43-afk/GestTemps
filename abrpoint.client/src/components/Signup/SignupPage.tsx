import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Box, Typography, TextField, Button, CircularProgress, Alert,
  Paper, Stack, InputAdornment, Chip,
} from '@mui/material';
import BusinessIcon from '@mui/icons-material/Business';
import LinkIcon from '@mui/icons-material/Link';
import PersonIcon from '@mui/icons-material/Person';
import MailIcon from '@mui/icons-material/Mail';
import LockIcon from '@mui/icons-material/Lock';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import apiInstance from '../API/apiInstance';
import { useAuth } from '../helper/AuthProvider';
import { startStripeCheckout } from '../Pricing/stripeCheckout';

const SLUG_REGEX = /^[a-z0-9](?:[a-z0-9-]{1,28}[a-z0-9])?$/;

type SlugStatus = 'idle' | 'checking' | 'available' | 'taken' | 'invalid' | 'reserved';
type EmailStatus = 'idle' | 'checking' | 'available' | 'taken' | 'invalid';

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

export default function SignupPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { refreshAuth } = useAuth();
  const planFromPricing = (location.state as any) ?? null;

  const [companyName, setCompanyName] = useState('');
  const [slug, setSlug] = useState('');
  const [slugTouched, setSlugTouched] = useState(false);
  const [slugStatus, setSlugStatus] = useState<SlugStatus>('idle');

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [emailStatus, setEmailStatus] = useState<EmailStatus>('idle');
  const [password, setPassword] = useState('');

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

  const emailHelper = useMemo(() => {
    switch (emailStatus) {
      case 'checking': return { color: 'info' as const, text: 'Vérification…' };
      case 'available': return { color: 'success' as const, text: 'Email disponible.' };
      case 'taken': return { color: 'error' as const, text: 'Cet email est déjà utilisé.' };
      case 'invalid': return { color: 'error' as const, text: 'Format d\'email invalide.' };
      default: return null;
    }
  }, [emailStatus]);

  const slugHelper = useMemo(() => {
    switch (slugStatus) {
      case 'checking': return { color: 'info' as const, text: 'Vérification…' };
      case 'available': return { color: 'success' as const, text: `${slug}.concorde.com est disponible.` };
      case 'taken': return { color: 'error' as const, text: 'Ce slug est déjà utilisé.' };
      case 'reserved': return { color: 'error' as const, text: 'Ce slug est réservé.' };
      case 'invalid': return { color: 'error' as const, text: '3 à 30 caractères : a-z, 0-9, tirets. Ne pas commencer/finir par tiret.' };
      case 'idle': return SLUG_REGEX.test(slug)
        ? { color: 'warning' as const, text: 'Vérification non concluante — le serveur tranchera à la soumission.' }
        : null;
      default: return null;
    }
  }, [slug, slugStatus]);

  // Le bouton est actif dès que le format du slug est correct et qu'il n'est pas
  // explicitement connu comme pris/réservé. L'attente d'un "available" formel
  // n'est pas exigée (la vérif backend reste l'autorité finale).
  const slugAccepted = SLUG_REGEX.test(slug)
    && slugStatus !== 'taken'
    && slugStatus !== 'reserved'
    && slugStatus !== 'invalid';

  const canSubmit =
    !submitting &&
    companyName.trim().length >= 2 &&
    slugAccepted &&
    firstName.trim().length > 0 &&
    lastName.trim().length > 0 &&
    /.+@.+\..+/.test(email) &&
    emailStatus !== 'taken' &&
    emailStatus !== 'invalid' &&
    password.length >= 8 &&
    captchaChallengeId.length > 0 &&
    captchaAnswer.trim() !== '';

  const submit = async () => {
    setError(null);
    setSubmitting(true);
    try {
      // V3 : tous les packs incluent 30 jours d'essai sans CB → on n'envoie plus
      // requiresPayment=true (le backend ignore la valeur de toute façon). On
      // garde le champ dans le payload pour compat API. La détection "l'utilisateur
      // vient de PlanConfiguration" se fait désormais sur plan + userCount.
      const requiresPayment = false;
      const { data } = await apiInstance.post('/signup', {
        slug,
        companyName: companyName.trim(),
        adminFirstName: firstName.trim(),
        adminLastName: lastName.trim(),
        adminEmail: email.trim(),
        adminPassword: password,
        planCode: planFromPricing?.plan,
        billingCycle: planFromPricing?.cycle,
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
      // L'utilisateur arrive depuis PlanConfigurationPage (visiteur) avec plan + userCount :
      //   → on déclenche directement la session Stripe Checkout pour pré-enregistrer
      //     son mode de paiement (sans débit immédiat — l'essai gratuit reste actif).
      // Avec uniquement plan/cycle (PricingPage → signup direct) :
      //   → on l'envoie sur /dashboard/plan-configuration pour finaliser la config.
      // Sans plan choisi : dashboard + trial 30j.
      if (planFromPricing?.plan && planFromPricing?.userCount) {
        await startStripeCheckout({
          plan: planFromPricing.plan,
          cycle: planFromPricing.cycle ?? 'annual',
          userCount: planFromPricing.userCount,
        });
        return;
      } else if (planFromPricing?.plan) {
        navigate('/dashboard/plan-configuration', { state: { ...planFromPricing, signupRedirectUrl: data.redirectUrl } });
      } else {
        navigate('/dashboard', { state: { signupRedirectUrl: data.redirectUrl } });
      }
    } catch (e: any) {
      // Cas spécial : email lié à un compte résilié, mais dans la fenêtre de réactivation
      // (90j). On redirige l'utilisateur vers /login en pré-remplissant l'email — le login
      // déclenchera resumeStripeCheckout (cas Cancelled) et créera une session Stripe.
      if (e?.response?.data?.code === 'cancelled_account_reactivatable') {
        const cancelledSlug = e?.response?.data?.slug;
        if (cancelledSlug) localStorage.setItem('tenantSlug', cancelledSlug);
        navigate('/login', {
          state: {
            email: email.trim(),
            notice: 'Votre compte a été résilié. Connectez-vous pour le réactiver et reprendre votre abonnement (vos données sont conservées 90 jours).',
          },
        });
        return;
      }
      const msg = e?.response?.data?.error || e?.response?.data?.detail || 'Inscription échouée. Réessayez.';
      setError(msg);
      // Captcha invalide → on régénère un nouveau challenge pour la prochaine tentative.
      if (e?.response?.data?.code === 'captcha_failed') {
        await refreshCaptcha();
      }
    } finally {
      setSubmitting(false);
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
      <Paper elevation={2} sx={{ maxWidth: 560, width: '100%', p: { xs: 3, md: 5 }, borderRadius: 3 }}>
        <Box sx={{ textAlign: 'center', mb: 3 }}>
          {/* Tous les packs (Starter/Standard/Premium) = 30 jours offerts sans CB. Le titre
              s'adapte selon que l'utilisateur arrive depuis PlanConfiguration (étape 1 sur 2,
              CB pré-enregistrée à l'étape suivante) ou en signup direct. */}
          {planFromPricing?.plan && planFromPricing?.userCount ? (
            <>
              <Typography variant="h4" fontWeight={800} sx={{ mb: 1 }}>
                Créer mon compte
              </Typography>
              <Typography color="text.secondary">
                Étape 1 sur 2 — 30 jours gratuits sans CB. Votre moyen de paiement
                sera pré-enregistré à l'étape suivante (aucun débit avant la fin de l'essai).
              </Typography>
            </>
          ) : (
            <>
              <Typography variant="h4" fontWeight={800} sx={{ mb: 1 }}>
                Démarrer mon essai gratuit
              </Typography>
              <Typography color="text.secondary">
                30 jours, sans carte bancaire — Concorde Workforce
              </Typography>
            </>
          )}
          {planFromPricing?.plan && (
            <Chip
              sx={{ mt: 2 }}
              color="primary"
              label={`Plan sélectionné : ${planFromPricing.plan} (${planFromPricing.cycle === 'annual' ? 'annuel' : 'mensuel'})`}
            />
          )}
        </Box>

        <Stack spacing={2.5}>
          <TextField
            fullWidth
            label="Nom de l'entreprise"
            value={companyName}
            onChange={(e) => setCompanyName(e.target.value)}
            InputProps={{ startAdornment: <InputAdornment position="start"><BusinessIcon /></InputAdornment> }}
          />

          <Box>
            <TextField
              fullWidth
              label="Adresse de votre espace"
              value={slug}
              onChange={(e) => { setSlugTouched(true); setSlug(slugify(e.target.value)); }}
              InputProps={{
                startAdornment: <InputAdornment position="start"><LinkIcon /></InputAdornment>,
                endAdornment: (
                  <InputAdornment position="end">
                    {slugStatus === 'checking' && <CircularProgress size={18} />}
                    {slugStatus === 'available' && <CheckCircleIcon color="success" fontSize="small" />}
                    {(slugStatus === 'taken' || slugStatus === 'reserved' || slugStatus === 'invalid') && (
                      <ErrorIcon color="error" fontSize="small" />
                    )}
                  </InputAdornment>
                ),
              }}
              helperText={`https://${slug || 'votre-slug'}.concorde.com`}
            />
            {slugHelper && (
              <Typography variant="caption" color={`${slugHelper.color}.main`} sx={{ display: 'block', mt: 0.5, ml: 1 }}>
                {slugHelper.text}
              </Typography>
            )}
          </Box>

          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <TextField
              fullWidth
              label="Prénom"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              InputProps={{ startAdornment: <InputAdornment position="start"><PersonIcon /></InputAdornment> }}
            />
            <TextField
              fullWidth
              label="Nom"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              InputProps={{ startAdornment: <InputAdornment position="start"><PersonIcon /></InputAdornment> }}
            />
          </Stack>

          <Box>
            <TextField
              fullWidth
              type="email"
              label="Email professionnel"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              InputProps={{
                startAdornment: <InputAdornment position="start"><MailIcon /></InputAdornment>,
                endAdornment: (
                  <InputAdornment position="end">
                    {emailStatus === 'checking' && <CircularProgress size={18} />}
                    {emailStatus === 'available' && <CheckCircleIcon color="success" fontSize="small" />}
                    {(emailStatus === 'taken' || emailStatus === 'invalid') && (
                      <ErrorIcon color="error" fontSize="small" />
                    )}
                  </InputAdornment>
                ),
              }}
            />
            {emailHelper && (
              <Typography variant="caption" color={`${emailHelper.color}.main`} sx={{ display: 'block', mt: 0.5, ml: 1 }}>
                {emailHelper.text}
              </Typography>
            )}
          </Box>

          <TextField
            fullWidth
            type="password"
            label="Mot de passe (8 caractères min.)"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            InputProps={{ startAdornment: <InputAdornment position="start"><LockIcon /></InputAdornment> }}
          />

          {/* Captcha anti-bot — question arithmétique simple, single-use, 5 min TTL.
              Aucune dépendance tierce (RGPD-friendly, pas de bandeau cookie supplémentaire). */}
          <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center' }}>
            <Box
              sx={{
                px: 2.5, py: 1.5, borderRadius: 1, bgcolor: '#f1f5f9',
                fontFamily: 'monospace', fontSize: 18, fontWeight: 700, letterSpacing: 2,
                minWidth: 110, textAlign: 'center', userSelect: 'none', color: '#0f172a',
              }}
            >
              {captchaQuestion ? `${captchaQuestion} = ?` : '…'}
            </Box>
            <TextField
              fullWidth
              type="number"
              label="Vérification anti-robot"
              value={captchaAnswer}
              onChange={(e) => setCaptchaAnswer(e.target.value)}
              inputProps={{ inputMode: 'numeric' }}
            />
            <Button
              size="small"
              variant="text"
              onClick={refreshCaptcha}
              sx={{ minWidth: 'auto', whiteSpace: 'nowrap' }}
              title="Générer un nouveau calcul"
            >
              ↻
            </Button>
          </Box>

          {error && <Alert severity="error">{error}</Alert>}

          <Button
            variant="contained"
            size="large"
            disabled={!canSubmit}
            onClick={submit}
            sx={{ py: 1.5, fontWeight: 700 }}
          >
            {submitting ? (
              <CircularProgress size={22} />
            ) : planFromPricing?.plan && planFromPricing?.userCount ? (
              'Continuer vers le paiement'
            ) : (
              'Démarrer mon essai gratuit'
            )}
          </Button>

          <Typography variant="caption" color="text.secondary" sx={{ textAlign: 'center' }}>
            En vous inscrivant, vous acceptez les conditions générales d'utilisation et la politique de confidentialité.
          </Typography>

          <Box sx={{ textAlign: 'center', pt: 1 }}>
            <Typography variant="body2" color="text.secondary">
              Vous avez déjà un compte ?{' '}
              <Button size="small" onClick={() => navigate('/login')} sx={{ textTransform: 'none' }}>
                Se connecter
              </Button>
            </Typography>
          </Box>
        </Stack>
      </Paper>
    </Box>
  );
}
