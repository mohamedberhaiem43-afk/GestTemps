import React from 'react';
import { Box, Typography } from '@mui/material';
import { ListAllaitementModern } from './ListeAllaitementModern';
import AllaitementSaisieModern from './AllaitementSaisieModern';
import { QueryClient, QueryClientProvider } from 'react-query';
import { AllaitementProvider } from '../../helper/AllaitementContext';
import './AllaitementModern.css';

export const AllaitementModern: React.FC = () => {
  const queryClient = new QueryClient();

  return (
    <QueryClientProvider client={queryClient}>
      <AllaitementProvider>
        <Box className="allaitement-modern-container">

          {/* HEADER */}
          <Box className="allaitement-header">
            <Typography className="allaitement-title">
              Gestion de l'Allaitement
            </Typography>
            <Typography className="allaitement-subtitle">
              Configurez et suivez les périodes d'allaitement des collaboratrices.
            </Typography>
          </Box>

          {/* GRID */}
          <Box className="allaitement-grid">

            {/* LEFT */}
            <Box className="allaitement-left">
              <AllaitementSaisieModern />

              {/* HEURES */}
              <Box className="allaitement-card allaitement-fade-in">
                <Typography className="section-title">
                  Heures d'Allaitement
                </Typography>

                <Box className="allaitement-hours">
                  <Box>
                    <Typography className="label">Matin</Typography>
                    <Typography>10:00 - 10:30</Typography>
                  </Box>

                  <Box>
                    <Typography className="label">Après-midi</Typography>
                    <Typography>15:30 - 16:00</Typography>
                  </Box>
                </Box>

                <button className="allaitement-button-primary">
                  Enregistrer la période
                </button>
              </Box>
            </Box>

            {/* RIGHT */}
            <Box className="allaitement-right">
              <ListAllaitementModern />

              {/* INFO CARD */}
              <Box className="allaitement-info-card">
                <Typography className="info-title">
                  Conformité Légale
                </Typography>
                <Typography className="info-text">
                  Le temps d'allaitement est comptabilisé comme temps de travail effectif.
                  Assurez-vous que les créneaux respectent la convention collective en vigueur.
                </Typography>

                <button className="info-button">
                  Consulter le guide RH
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