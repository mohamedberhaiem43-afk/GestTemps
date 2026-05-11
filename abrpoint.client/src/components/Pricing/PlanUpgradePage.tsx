import { useLocation, useNavigate } from 'react-router-dom';
import { Box, Typography, Button, Paper } from '@mui/material';
import LockIcon from '@mui/icons-material/Lock';
import RocketLaunchIcon from '@mui/icons-material/RocketLaunch';
import { useAuth } from '../helper/AuthProvider';

/**
 * Page « Upgrade requis » affichée quand l'utilisateur tape une feature qui n'est pas
 * dans son plan (réponse 402 `plan_feature_locked` du backend, interceptée dans
 * apiInstance et routée ici via `navigate('/upgrade', { state: { ... } })`).
 *
 * Vue volontairement légère : on rappelle la feature bloquée, le plan courant, et on
 * propose deux CTAs — voir la grille tarifaire OU contacter les ventes pour Premium.
 */
export default function PlanUpgradePage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { planCode } = useAuth();
  // Source du contexte : state passé via navigate() (cas in-app), OU URL params (cas hard
  // redirect depuis l'interceptor 402 dans apiInstance — situation la plus fréquente).
  const urlParams = new URLSearchParams(location.search);
  const state = (location.state ?? {
    feature: urlParams.get('feature') ?? undefined,
    currentPlan: urlParams.get('currentPlan') ?? undefined,
    from: urlParams.get('from') ?? undefined,
  }) as { feature?: string; currentPlan?: string; from?: string };

  const featureLabels: Record<string, string> = {
    MobileApp: 'Application mobile',
    Geolocation: 'Pointage géolocalisé',
    DigitalVault: 'Coffre numérique',
    ElectronicSignature: 'Signature électronique',
    MultiSite: 'Multi-sites',
    MultiSociete: 'Multi-filiales',
    AdvancedDashboards: 'Tableaux de bord avancés',
    RagAi: 'Assistant IA (RAG)',
    AdvancedAuditLogs: 'Audit logs avancés',
    CustomBranding: 'Branding personnalisé',
    DeviceTrustEnforced: 'Device trust mobile',
    ScreenshotProtection: 'Protection capture d\'écran',
    CertificatePinning: 'Certificate pinning',
  };
  const featureLabel = state.feature ? (featureLabels[state.feature] ?? state.feature) : 'Cette fonctionnalité';
  const currentPlan = state.currentPlan ?? planCode ?? 'Inconnu';

  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', p: 4, background: '#f7f9fb' }}>
      <Paper elevation={0} sx={{ maxWidth: 560, p: { xs: 4, md: 6 }, borderRadius: '20px', textAlign: 'center', border: '1px solid #e2e8f0' }}>
        <Box sx={{
          width: 72, height: 72, borderRadius: '50%',
          background: 'linear-gradient(135deg, #0040a1, #0056d2)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          margin: '0 auto 24px', boxShadow: '0 12px 32px rgba(0, 64, 161, 0.25)',
        }}>
          <LockIcon sx={{ color: '#fff', fontSize: 36 }} />
        </Box>
        <Typography variant="h4" sx={{ fontWeight: 800, mb: 1.5, color: '#0f172a' }}>
          {featureLabel} n'est pas inclus dans votre plan
        </Typography>
        <Typography sx={{ fontSize: 14, color: '#64748b', mb: 3, lineHeight: 1.6 }}>
          Votre plan actuel <strong>{currentPlan}</strong> ne donne pas accès à cette fonctionnalité.
          Pour y accéder, passez à un pack supérieur. La transition est immédiate et
          le différentiel est prorata-temporis.
        </Typography>
        <Box sx={{
          background: 'linear-gradient(135deg, #eff6ff 0%, #f0f9ff 100%)',
          border: '1px solid #bfdbfe', borderRadius: '14px', p: 2.5, mb: 4, textAlign: 'left',
        }}>
          <Typography sx={{ fontSize: 12, fontWeight: 700, color: '#0040a1', mb: 1, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Conseil
          </Typography>
          <Typography sx={{ fontSize: 13, color: '#334155', lineHeight: 1.55 }}>
            Le pack <strong>Standard</strong> couvre la majorité des besoins (mobile, géoloc, coffre, signature, multi-sites).
            Le pack <strong>Premium</strong> ajoute l'assistant IA, audit avancé et sécurité mobile renforcée.
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center', flexWrap: 'wrap' }}>
          <Button
            variant="contained"
            startIcon={<RocketLaunchIcon />}
            onClick={() => navigate('/pricing')}
            sx={{
              textTransform: 'none', fontWeight: 700, borderRadius: '12px', px: 3, py: 1.5,
              background: 'linear-gradient(135deg, #0040a1 0%, #0056d2 100%)',
              boxShadow: '0 8px 24px rgba(0, 64, 161, 0.25)',
            }}
          >
            Voir la grille tarifaire
          </Button>
          <Button
            variant="outlined"
            onClick={() => navigate(state.from ?? '/dashboard')}
            sx={{ textTransform: 'none', fontWeight: 700, borderRadius: '12px', px: 3, py: 1.5 }}
          >
            Retour
          </Button>
        </Box>
      </Paper>
    </Box>
  );
}
