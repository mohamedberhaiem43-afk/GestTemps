import React from 'react';
import { Box, Typography } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { ListAllaitementModern } from './ListeAllaitementModern';
import AllaitementSaisieModern from './AllaitementSaisieModern';
import { AllaitementProvider } from '../../helper/AllaitementContext';
import './AllaitementModern.css';

export const AllaitementModern: React.FC = () => {
  const { t } = useTranslation();

  return (
    <AllaitementProvider>
        <Box className="allaitement-modern-container">

          {/* HEADER */}
          <Box className="allaitement-header">
            <Typography className="allaitement-title">
              {t('allaitement.title')}
            </Typography>
            <Typography className="allaitement-subtitle">
              {t('allaitement.subtitle')}
            </Typography>
          </Box>

          {/* GRID */}
          <Box className="allaitement-grid">

            {/* LEFT */}
            <Box className="allaitement-left">
              <AllaitementSaisieModern />
            </Box>

            {/* RIGHT */}
            <Box className="allaitement-right">
              <ListAllaitementModern />
              {/* 2026-05-22 — Bande bleue « info-card » retirée : les clés i18n
                  (allaitement.infoTitle / infoText / infoButton) n'étaient pas
                  traduites et affichaient les clés brutes à l'écran. */}
            </Box>

          </Box>
        </Box>
      </AllaitementProvider>
  );
};

export default AllaitementModern;