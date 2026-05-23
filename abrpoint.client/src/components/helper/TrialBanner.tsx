import { Box, Typography, Button } from '@mui/material';
import { Sparkles } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from './AuthProvider';

/**
 * Bandeau jaune affiché en haut du dashboard tant que le tenant est en essai gratuit.
 *
 * Les limites présentées doivent refléter le pack auquel le tenant a accès pendant
 * l'essai — c'est le pack Starter par défaut (cf. TrialPolicy.cs : MaxEmployees=10,
 * MaxSocietes=1, MaxSites=1). Auparavant les chiffres étaient hardcodés dans le
 * markup — un changement de grille (Starter passe de 25 à 10 inclus en 2026-05)
 * obligeait à toucher ce composant. On lit maintenant `planLimits` exposé par
 * `/api/Utilisateurs/me` (via useAuth) pour rester aligné automatiquement.
 */
const TrialBanner = () => {
  const { isTrialing, trialDaysRemaining, planLimits, planCode, isAdmin, isManager } = useAuth();
  const navigate = useNavigate();

  if (!isTrialing) return null;
  // 2026-05-18 — Le bandeau d'essai (qui invite à passer au plan payant + affiche
  // les limites du pack) n'a aucun sens pour un salarié : ce n'est pas son rôle
  // de gérer l'abonnement, et le message « Passer au plan payant » est trompeur
  // car le bouton mène vers /dashboard/mon-abonnement qui nécessite des
  // permissions admin/manager. On masque donc le bandeau à toute personne qui
  // n'est ni admin ni manager.
  if (!isAdmin && !isManager) return null;

  const daysLabel =
    trialDaysRemaining == null
      ? 'Essai gratuit en cours'
      : trialDaysRemaining <= 0
        ? 'Votre essai gratuit a expiré'
        : trialDaysRemaining === 1
          ? 'Dernier jour de votre essai gratuit'
          : `Il vous reste ${trialDaysRemaining} jours d'essai gratuit`;

  // Bannière trial : on reflète les limites + le périmètre fonctionnel du PACK
  // CHOISI par le tenant (Starter / Standard / Premium). Avant le fix 2026-05-18,
  // la tagline était hardcodée à « pointage simple sans workflow RH avancé »
  // — ce qui contredisait la description Premium (multi-filiales, IA, sécurité)
  // affichée sur la landing. On utilise désormais le mapping ci-dessous, aligné
  // sur PricingPage.tsx (descriptions commerciales) et PlanCatalog.cs (features).
  const packName = (planCode || 'Starter') as 'Starter' | 'Standard' | 'Premium';
  const maxEmp = planLimits?.maxEmployees ?? planLimits?.includedEmployees ?? 10;
  // maxSocietes === null ⇒ pas de plafond (Premium). On affiche « illimité » au lieu
  // de retomber silencieusement sur "1" (ce qui aurait fait croire qu'un Premium trial
  // est limité à une seule filiale alors que la matrice MultiSociete=true le permet).
  const maxSocRaw = planLimits?.maxSocietes;
  const societeLabel = maxSocRaw == null
    ? 'sociétés/filiales illimitées'
    : `${maxSocRaw} société/filiale`;
  // Tagline courte du pack — miroir condensé des descriptions PricingPage.tsx :
  //   Starter  → pointage simple sans workflow RH avancé
  //   Standard → suite complète mobile + paie, sans IA ni multi-filiales
  //   Premium  → tous les modules (états, multi-filiales, IA, sécurité renforcée)
  const packTagline: Record<typeof packName, string> = {
    Starter: 'pointage simple, sans workflow RH avancé',
    Standard: 'mobile, congés, signature, coffre — sans IA ni multi-filiales',
    Premium: 'tous les modules : états, multi-filiales, IA, sécurité renforcée',
  };

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1.5,
        px: 2,
        py: 1,
        bgcolor: '#fef3c7',
        borderBottom: '1px solid #fde68a',
        color: '#92400e',
      }}
    >
      <Sparkles size={16} style={{ flexShrink: 0 }} />
      <Typography sx={{ fontSize: 13, fontWeight: 700, flex: 1 }}>
        {daysLabel}
        <Box component="span" sx={{ fontWeight: 500, ml: 1 }}>
          — Pack <strong style={{ fontWeight: 700 }}>{packName}</strong> (essai) : jusqu'à {maxEmp} collaborateur{maxEmp > 1 ? 's' : ''}, {societeLabel}, {packTagline[packName]}.
        </Box>
      </Typography>
      {/* 2026-05-22 — Le CTA pointe désormais vers la page d'abonnement
          (/dashboard/mon-abonnement) plutôt que vers /plan-configuration.
          Raison : l'admin déjà inscrit a son tenant et son trial — il doit
          gérer son abonnement (statut, paiement, pack, période), pas
          re-configurer un plan « à neuf ». Cohérent avec la même redirection
          déjà appliquée dans AjoutEmploye (dialogue plafond essai). */}
      <Button
        size="small"
        variant="contained"
        onClick={() => navigate('/dashboard/mon-abonnement')}
        sx={{
          bgcolor: '#0040a1',
          fontSize: 12,
          fontWeight: 700,
          textTransform: 'none',
          py: 0.5,
          px: 2,
          minHeight: 0,
          '&:hover': { bgcolor: '#003080' },
        }}
      >
        Passer au plan payant
      </Button>
    </Box>
  );
};

export default TrialBanner;
