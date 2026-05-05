import { useEffect, useState } from 'react';
import { Box, keyframes } from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';

// Animation de succès réutilisable : un disque vert avec checkmark qui apparaît
// au centre de l'écran avec un rebond, puis se fane. Branche-la sur un état
// (open=true) après un onSuccess de mutation. Auto-fermeture après ~1.6s.

const pop = keyframes`
  0%   { opacity: 0; transform: scale(0.2) rotate(-15deg); }
  60%  { opacity: 1; transform: scale(1.15) rotate(0deg); }
  80%  { transform: scale(0.95); }
  100% { opacity: 1; transform: scale(1); }
`;

const fadeOut = keyframes`
  0%   { opacity: 1; transform: scale(1); }
  100% { opacity: 0; transform: scale(0.85); }
`;

const ringPulse = keyframes`
  0%   { transform: scale(0.6); opacity: 0.7; }
  100% { transform: scale(2.0); opacity: 0; }
`;

interface SuccessAnimationProps {
  open: boolean;
  onClose?: () => void;
  message?: string;
  durationMs?: number;
}

export default function SuccessAnimation({
  open,
  onClose,
  message = 'Terminé !',
  durationMs = 1600,
}: SuccessAnimationProps) {
  const [phase, setPhase] = useState<'in' | 'out' | 'closed'>('closed');

  useEffect(() => {
    if (!open) {
      setPhase('closed');
      return;
    }
    setPhase('in');
    const t1 = window.setTimeout(() => setPhase('out'), durationMs - 300);
    const t2 = window.setTimeout(() => {
      setPhase('closed');
      onClose?.();
    }, durationMs);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
  }, [open, durationMs, onClose]);

  if (phase === 'closed') return null;

  return (
    <Box
      sx={{
        position: 'fixed',
        inset: 0,
        zIndex: 2000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        pointerEvents: 'none',
        background: 'radial-gradient(circle, rgba(16,185,129,0.10) 0%, transparent 60%)',
      }}
    >
      <Box
        sx={{
          position: 'relative',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 1.5,
          animation: phase === 'in'
            ? `${pop} 0.55s cubic-bezier(0.34, 1.56, 0.64, 1) both`
            : `${fadeOut} 0.3s ease-out forwards`,
        }}
      >
        {/* Halo pulsant derrière le check */}
        <Box
          sx={{
            position: 'absolute',
            top: 0,
            width: 96, height: 96,
            borderRadius: '50%',
            background: 'rgba(16,185,129,0.35)',
            animation: `${ringPulse} 1.1s ease-out`,
          }}
        />
        <CheckCircleIcon
          sx={{
            fontSize: 96,
            color: '#10b981',
            filter: 'drop-shadow(0 8px 16px rgba(16,185,129,0.45))',
          }}
        />
        <Box
          sx={{
            background: 'rgba(255,255,255,0.95)',
            backdropFilter: 'blur(8px)',
            color: '#065f46',
            fontWeight: 800,
            fontSize: 14,
            letterSpacing: 0.3,
            px: 2.5,
            py: 1,
            borderRadius: '999px',
            boxShadow: '0 6px 20px rgba(0,0,0,0.10)',
          }}
        >
          {message}
        </Box>
      </Box>
    </Box>
  );
}
