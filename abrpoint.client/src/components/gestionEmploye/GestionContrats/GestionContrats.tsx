import { Box, Grid, Stack } from '@mui/material';
import ListContrats from './ListContrats';
import './GestionContrats.css';
import SaisieContrat from './SaisieContrat';
import { QueryClient, QueryClientProvider } from 'react-query';
import { useState } from 'react';
import BreadcrumbNavigation from '../../helper/BreadcrumbNavigation';
import { Contrat } from '../../../models/Contrat';

const GestionContrats = () => {
  const queryClient = new QueryClient();
  const [editingContract, setEditingContract] = useState<Contrat | null>(null);

  return (
    <QueryClientProvider client={queryClient}>
      <Box width="100%">
        <Stack spacing={1}>
          <BreadcrumbNavigation />
          <Grid container spacing={1}>
            <Grid item xs={12}>
              <SaisieContrat editingContract={editingContract} setEditingContract={setEditingContract} />
            </Grid>
            <Grid item xs={12}>
              <ListContrats req="Contrats/get-contrats" onEdit={setEditingContract} />
            </Grid>
          </Grid>
        </Stack>
      </Box>
    </QueryClientProvider>
  );
};

export default GestionContrats;
