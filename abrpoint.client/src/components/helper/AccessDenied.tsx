import React from 'react';
import { Box, Typography } from '@mui/material';
import LockPersonIcon from '@mui/icons-material/LockPerson';

interface AccessDeniedProps {
  message?: string;
}

const AccessDenied: React.FC<AccessDeniedProps> = ({ message }) => {
  return (
    <Box 
      sx={{ 
        p: 6, 
        textAlign: 'center', 
        backgroundColor: '#fff', 
        borderRadius: '20px', 
        boxShadow: '0 4px 20px rgba(0,0,0,0.05)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '400px',
        m: 3
      }}
    >
      <Box 
        sx={{ 
          backgroundColor: 'rgba(186, 26, 26, 0.08)', 
          p: 3, 
          borderRadius: '50%', 
          mb: 3 
        }}
      >
        <LockPersonIcon sx={{ fontSize: 64, color: '#ba1a1a' }} />
      </Box>
      <Typography variant="h5" sx={{ fontWeight: 800, color: '#0f172a', mb: 1, fontFamily: 'Manrope, sans-serif' }}>
        Accès Refusé
      </Typography>
      <Typography sx={{ color: '#64748b', maxWidth: '400px', mx: 'auto' }}>
        {message || "Vous n'avez pas les droits nécessaires pour accéder à ce module. Veuillez contacter votre administrateur si vous pensez qu'il s'agit d'une erreur."}
      </Typography>
    </Box>
  );
};

export default AccessDenied;
