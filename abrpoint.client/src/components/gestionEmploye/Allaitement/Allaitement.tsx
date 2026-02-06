import React from 'react';
import { Box, Grid } from '@mui/material';
import { ListAllaitement } from './ListeAllaitement';
import AllaitementSaisie from './AllaitementSaisie';
import { QueryClient, QueryClientProvider } from 'react-query';
import { AllaitementProvider } from '../../helper/AllaitementContext';
import BreadcrumbNavigation from '../../helper/BreadcrumbNavigation';

export const Allaitement: React.FC = () => {
  
  const queryClient = new QueryClient();

  return (
    <QueryClientProvider client={queryClient}>
    <AllaitementProvider>
      <Box sx={{ display: 'flex', flexDirection: 'column'}} height={'90vh'}width={'95vw'} mt={-10}>
        <BreadcrumbNavigation />
        
        <Grid container spacing={1} >
          <Grid spacing={3} item xs={12} ml={5}>
            <AllaitementSaisie />
          </Grid>
          <Grid item xs={12} mt={3}>
            <ListAllaitement />
          </Grid>
        </Grid>
      </Box>
    </AllaitementProvider>
    </QueryClientProvider>
  );
};

export default Allaitement;
