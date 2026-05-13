import { useLocation, useNavigate } from 'react-router-dom';
import { Box, Typography, Button, Paper, Chip, Alert } from '@mui/material';
import LockIcon from '@mui/icons-material/Lock';
import RocketLaunchIcon from '@mui/icons-material/RocketLaunch';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import { useAuth, type PlanFeatures } from '../helper/AuthProvider';

/**
 * Page « Upgrade requis » affichée quand l'utilisateur tape une feature qui n'est pas
 * dans son plan (réponse 402 `plan_feature_locked` du backend, interceptée dans
 * apiInstance et routée ici via `navigate('/upgrade', { state: { ... } })`).
 *
 * On affiche le plan minimal requis pour la feature et on propose un CTA principal
 * qui amène directement à /dashboard/plan-configuration avec ce plan pré-sélectionné —
 * l'utilisateur n'a plus à repasser par la grille tarifaire.
 */
type PlanKey = 'Starter' | 'Standard' | 'Premium';

// Plan minimal qui inclut chaque feature. Doit rester aligné avec
// ABRPOINT.Server.Tenancy.PlanCatalog (matrice features × plan).
const MINIMUM_PLAN_FOR_FEATURE: Record<keyof PlanFeatures, PlanKey> = {
  mobileApp: 'Standard',
  geolocation: 'Standard',
  digitalVault: 'Standard',
  electronicSignature: 'Standard',
  multiSite: 'Standard',
  multiSociete: 'Premium',
  advancedDashboards: 'Standard',
  ragAi: 'Premium',
  advancedAuditLogs: 'Premium',
  customBranding: 'Premium',
  deviceTrustEnforced: 'Premium',
  screenshotProtection: 'Premium',
  certificatePinning: 'Premium',
  missions: 'Standard',
  compensationDays: 'Standard',
  generalLeave: 'Standard',
  generalExit: 'Standard',
  leaveManagement: 'Standard',
  authorizationManagement: 'Standard',
};

// Le backend renvoie la feature en PascalCase (cf. RequirePlanFeatureAttribute) ; on
// normalise vers la clé camelCase utilisée par MINIMUM_PLAN_FOR_FEATURE.
function featureToCamelKey(feature?: string): keyof PlanFeatures | null {
  if (!feature) return null;
  const k = feature.charAt(0).toLowerCase() + feature.slice(1);
  return (k in MINIMUM_PLAN_FOR_FEATURE ? (k as keyof PlanFeatures) : null);
}

export default function PlanUpgradePage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { planCode, isAdmin, isManager } = useAuth();
  const canManage = isAdmin || isManager;
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
    Missions: 'Gestion des missions',
    CompensationDays: 'Jours de compensation',
    GeneralLeave: 'Titre de congé général',
    GeneralExit: 'Autorisation de sortie générale',
    LeaveManagement: 'Gestion des congés',
    AuthorizationManagement: 'Gestion des autorisations de sortie',
  };
  const featureLabel = state.feature ? (featureLabels[state.feature] ?? state.feature) : 'Cette fonctionnalité';
  const currentPlan = state.currentPlan ?? planCode ?? 'Inconnu';
  const camelKey = featureToCamelKey(state.feature);
  // Plan minimal qui débloque la feature. Si on n'a pas le mapping (feature inconnue
  // ou state.feature absent), on retombe sur Standard — c'est le plan qui ouvre la
  // majorité des modules, donc une recommandation par défaut raisonnable.
  const recommendedPlan: PlanKey = camelKey ? MINIMUM_PLAN_FOR_FEATURE[camelKey] : 'Standard';

  const handleDirectUpgrade = () => {
    // On passe le plan recommandé via location.state ; PlanConfigurationPage lit
    // initialState.plan et pré-sélectionne le forfait correspondant. L'utilisateur n'a
    // plus qu'à ajuster l'effectif puis confirmer Stripe Checkout.
    navigate('/dashboard/plan-configuration', {
      state: { plan: recommendedPlan, cycle: 'monthly' },
    });
  };

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
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
            <Typography sx={{ fontSize: 12, fontWeight: 700, color: '#0040a1', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Plan recommandé
            </Typography>
            <Chip
              icon={<ArrowUpwardIcon sx={{ fontSize: 14 }} />}
              label={recommendedPlan}
              size="small"
              sx={{ fontWeight: 700, background: '#0040a1', color: '#fff', '& .MuiChip-icon': { color: '#fff' } }}
            />
          </Box>
          <Typography sx={{ fontSize: 13, color: '#334155', lineHeight: 1.55 }}>
            Le pack <strong>{recommendedPlan}</strong> débloque <strong>{featureLabel}</strong>
            {recommendedPlan === 'Standard' && ' ainsi que mobile, géolocalisation, coffre numérique et signature électronique.'}
            {recommendedPlan === 'Premium' && ', l\'assistant IA, l\'audit avancé et la sécurité mobile renforcée.'}
          </Typography>
        </Box>

        {!canManage && (
          <Alert severity="info" sx={{ mb: 3, textAlign: 'left', borderRadius: '12px' }}>
            Seul un administrateur ou un manager peut modifier l'abonnement. Contactez la personne
            qui gère votre compte pour demander l'upgrade.
          </Alert>
        )}

        <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center', flexWrap: 'wrap' }}>
          {canManage && (
            <Button
              variant="contained"
              startIcon={<RocketLaunchIcon />}
              onClick={handleDirectUpgrade}
              sx={{
                textTransform: 'none', fontWeight: 700, borderRadius: '12px', px: 3, py: 1.5,
                background: 'linear-gradient(135deg, #0040a1 0%, #0056d2 100%)',
                boxShadow: '0 8px 24px rgba(0, 64, 161, 0.25)',
              }}
            >
              Passer au pack {recommendedPlan}
            </Button>
          )}
          <Button
            variant={canManage ? 'outlined' : 'contained'}
            onClick={() => navigate('/pricing')}
            sx={{
              textTransform: 'none', fontWeight: 700, borderRadius: '12px', px: 3, py: 1.5,
              ...(canManage ? {} : {
                background: 'linear-gradient(135deg, #0040a1 0%, #0056d2 100%)',
                boxShadow: '0 8px 24px rgba(0, 64, 161, 0.25)',
              }),
            }}
          >
            Comparer tous les plans
          </Button>
          <Button
            variant="text"
            onClick={() => navigate(state.from ?? '/dashboard')}
            sx={{ textTransform: 'none', fontWeight: 700, borderRadius: '12px', px: 3, py: 1.5, color: '#64748b' }}
          >
            Retour
          </Button>
        </Box>
      </Paper>
    </Box>
  );
}
