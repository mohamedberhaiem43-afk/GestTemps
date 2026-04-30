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

const SLUG_REGEX = /^[a-z0-9](?:[a-z0-9-]{1,28}[a-z0-9])?$/;

type SlugStatus = 'idle' | 'checking' | 'available' | 'taken' | 'invalid' | 'reserved';

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
  const [password, setPassword] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
    password.length >= 8;

  const submit = async () => {
    setError(null);
    setSubmitting(true);
    try {
      const { data } = await apiInstance.post('/signup', {
        slug,
        companyName: companyName.trim(),
        adminFirstName: firstName.trim(),
        adminLastName: lastName.trim(),
        adminEmail: email.trim(),
        adminPassword: password,
        planCode: planFromPricing?.plan,
        billingCycle: planFromPricing?.cycle,
      });
      // On stocke le slug en localStorage pour que apiInstance l'injecte automatiquement
      // dans le header X-Tenant-Slug. Indispensable tant que le déploiement n'a pas
      // de wildcard DNS/SSL pour les sous-domaines (acme.concorde-work-force.com).
      localStorage.setItem('tenantSlug', slug);
      // Recharge le contexte d'auth maintenant que les cookies JWT du nouveau tenant sont posés
      // ET que tenantSlug est en localStorage : /me ira chercher l'admin dans la base du tenant.
      await refreshAuth();
      // L'utilisateur arrive depuis PlanConfigurationPage (visiteur) avec plan + userCount + packageType :
      //   → on déclenche /billing/checkout pour Stripe directement.
      // Avec uniquement plan/cycle (PricingPage → signup direct) :
      //   → on l'envoie sur /dashboard/plan-configuration pour finaliser la config.
      // Sans plan choisi : dashboard + trial 14j.
      if (planFromPricing?.plan && planFromPricing?.userCount && planFromPricing?.packageType) {
        try {
          const { data: billing } = await apiInstance.post('/billing/checkout', {
            planCode: planFromPricing.plan,
            billingCycle: planFromPricing.cycle ?? 'annual',
            userCount: planFromPricing.userCount,
            packageType: planFromPricing.packageType,
            successUrl: `${window.location.origin}/dashboard?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
            cancelUrl: `${window.location.origin}/dashboard/plan-configuration?checkout=cancelled`,
          });
          if (billing?.url) {
            window.location.href = billing.url;
            return;
          }
        } catch {
          // En cas d'échec Stripe, on bascule sur la page de configuration pour réessayer.
        }
        navigate('/dashboard/plan-configuration', { state: { ...planFromPricing, signupRedirectUrl: data.redirectUrl } });
      } else if (planFromPricing?.plan) {
        navigate('/dashboard/plan-configuration', { state: { ...planFromPricing, signupRedirectUrl: data.redirectUrl } });
      } else {
        navigate('/dashboard', { state: { signupRedirectUrl: data.redirectUrl } });
      }
    } catch (e: any) {
      const msg = e?.response?.data?.error || e?.response?.data?.detail || 'Inscription échouée. Réessayez.';
      setError(msg);
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
          <Typography variant="h4" fontWeight={800} sx={{ mb: 1 }}>
            Démarrer mon essai gratuit
          </Typography>
          <Typography color="text.secondary">
            14 jours, sans carte bancaire — Concorde Workforce
          </Typography>
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

          <TextField
            fullWidth
            type="email"
            label="Email professionnel"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            InputProps={{ startAdornment: <InputAdornment position="start"><MailIcon /></InputAdornment> }}
          />

          <TextField
            fullWidth
            type="password"
            label="Mot de passe (8 caractères min.)"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            InputProps={{ startAdornment: <InputAdornment position="start"><LockIcon /></InputAdornment> }}
          />

          {error && <Alert severity="error">{error}</Alert>}

          <Button
            variant="contained"
            size="large"
            disabled={!canSubmit}
            onClick={submit}
            sx={{ py: 1.5, fontWeight: 700 }}
          >
            {submitting ? <CircularProgress size={22} /> : 'Démarrer mon essai gratuit'}
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
