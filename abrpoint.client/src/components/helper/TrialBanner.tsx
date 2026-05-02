import { Box, Typography, Button } from '@mui/material';
import { Sparkles } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from './AuthProvider';

const TrialBanner = () => {
  const { isTrialing, trialDaysRemaining } = useAuth();
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
          — Limites : 10 collaborateurs, 1 société/filiale, sans rapports détaillés ni préparation paie.
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
