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
  const { isTrialing, trialDaysRemaining, planLimits, planCode } = useAuth();
  const navigate = useNavigate();

  if (!isTrialing) return null;

  const daysLabel =
    trialDaysRemaining == null
      ? 'Essai gratuit en cours'
      : trialDaysRemaining <= 0
        ? 'Votre essai gratuit a expiré'
        : trialDaysRemaining === 1
          ? 'Dernier jour de votre essai gratuit'
          : `Il vous reste ${trialDaysRemaining} jours d'essai gratuit`;

  // Pendant l'essai, on est sur les limites Starter (cf. TrialPolicy.GetLimits).
  // Si planCode est déjà choisi par le tenant, on le respecte ; sinon Starter par défaut.
  const packName = planCode || 'Starter';
  const maxEmp = planLimits?.maxEmployees ?? planLimits?.includedEmployees ?? 10;
  const maxSoc = planLimits?.maxSocietes ?? 1;

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
          — Pack <strong style={{ fontWeight: 700 }}>{packName}</strong> (essai) : jusqu'à {maxEmp} collaborateur{maxEmp > 1 ? 's' : ''}, {maxSoc} société/filiale, pointage simple sans workflow RH avancé.
        </Box>
      </Typography>
      <Button
        size="small"
        variant="contained"
        onClick={() => navigate('/dashboard/plan-configuration')}
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
