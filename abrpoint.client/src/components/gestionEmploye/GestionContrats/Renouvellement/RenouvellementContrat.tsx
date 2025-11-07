import { Box, Grid, Typography } from '@mui/material';
import { useState } from 'react';
import FiltrageRenouvellement, { Filters } from './FiltrageRenouvellement';
import ListContrats from '../ListContrats';
import { QueryClient, QueryClientProvider } from 'react-query';

function RenouvellementContrat() {
  const [filters, setFilters] = useState<Filters>({
    sitcod: '8',
    srvcod: '01',
    echdeb: '2024-12-16',
    echfin: '2024-12-16',
  });
  const queryClient = new QueryClient()
  return (
    <QueryClientProvider client={queryClient}>
      <Box sx={{ flexGrow: 1, mt: '-10%' }}>
        <Grid container spacing={2}>
          <Typography variant="h6" color="primary" sx={{ mr: 'auto', ml: 'auto' }}>
            Renouvellement de Contrats
          </Typography>
          <Grid item xs={12}>
            {/* Pass filters and setFilters to FiltrageRenouvellement */}
            <FiltrageRenouvellement filters={filters} setFilters={setFilters} />
          </Grid>
          <Grid item xs={12}>
            {/* Pass filters to ListContrats */}
            <ListContrats req="Contrats/get-contrats" filters={filters} />
          </Grid>
        </Grid>
      </Box>
    </QueryClientProvider>
  );
}

export default RenouvellementContrat;
