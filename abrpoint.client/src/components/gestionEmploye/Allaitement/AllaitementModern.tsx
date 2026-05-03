import React from 'react';
import { Box, Typography } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { ListAllaitementModern } from './ListeAllaitementModern';
import AllaitementSaisieModern from './AllaitementSaisieModern';
import { QueryClient, QueryClientProvider } from 'react-query';
import { AllaitementProvider } from '../../helper/AllaitementContext';
import './AllaitementModern.css';

export const AllaitementModern: React.FC = () => {
  const queryClient = new QueryClient();
  const { t } = useTranslation();

  return (
    <QueryClientProvider client={queryClient}>
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

              {/* INFO CARD */}
              <Box className="allaitement-info-card">
                <Typography className="info-title">
                  {t('allaitement.infoTitle')}
                </Typography>
                <Typography className="info-text">
                  {t('allaitement.infoText')}
                </Typography>

                <button className="info-button">
                  {t('allaitement.infoButton')}
                </button>
              </Box>
            </Box>

          </Box>
        </Box>
      </AllaitementProvider>
    </QueryClientProvider>
  );
};

export default AllaitementModern;