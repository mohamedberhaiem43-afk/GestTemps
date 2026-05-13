import React from 'react';
import { Box, Grid } from '@mui/material';
import { ListAllaitement } from './ListeAllaitement';
import AllaitementSaisie from './AllaitementSaisie';
import { AllaitementProvider } from '../../helper/AllaitementContext';
import BreadcrumbNavigation from '../../helper/BreadcrumbNavigation';

export const Allaitement: React.FC = () => {
  return (
    <AllaitementProvider>
      <Box sx={{ display: 'flex', flexDirection: 'column'}} height={'90vh'}width={'95vw'}>
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
  );
};

export default Allaitement;
