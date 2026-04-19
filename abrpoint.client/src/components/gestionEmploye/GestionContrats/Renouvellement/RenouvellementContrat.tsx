import { Box, Grid, Stack } from '@mui/material';
import { useMemo, useState } from 'react';
import FiltrageRenouvellement, { Filters } from './FiltrageRenouvellement';
import ListContrats from '../ListContrats';
import { QueryClient, QueryClientProvider } from 'react-query';
import BreadcrumbNavigation from '../../../helper/BreadcrumbNavigation';
import { Contrat } from '../../../../models/Contrat';
import { useAuth } from '../../../helper/AuthProvider';
import AccessDenied from '../../../helper/AccessDenied';

const formatDateInput = (date: Date) => date.toISOString().split('T')[0];
const addDays = (date: Date, days: number) => new Date(date.getTime() + (days * 24 * 60 * 60 * 1000));

function RenouvellementContrat() {
  const { hasPermission } = useAuth();
  
  if (!hasPermission('Contrats et Avenants', 'consult')) {
    return <AccessDenied message="Vous n'avez pas le droit de consulter le renouvellement des contrats." />;
  }

  const today = useMemo(() => new Date(), []);
  const initialFilters = useMemo<Filters>(() => ({
    sitcod: sessionStorage.getItem('sitcod') || '',
    srvcod: '',
    echdeb: formatDateInput(today),
    echfin: formatDateInput(addDays(today, 90)),
  }), [today]);
  const [selectedContract, setSelectedContract] = useState<Contrat | null>(null);
  const [filters, setFilters] = useState<Filters>(initialFilters);
  const [draftFilters, setDraftFilters] = useState<Filters>(initialFilters);
  const queryClient = new QueryClient();

  const handleApplyFilters = () => {
    setFilters({ ...draftFilters });
    setSelectedContract(null);
  };

  return (
    <QueryClientProvider client={queryClient}>
      <Box sx={{ flexGrow: 1 }} mt={-3}>
        <Stack spacing={1}>
          <BreadcrumbNavigation />

          <Grid container spacing={1}>
            <Grid item xs={12}>
              <FiltrageRenouvellement
                filters={draftFilters}
                setFilters={setDraftFilters}
                selectedContract={selectedContract}
                onApplyFilters={handleApplyFilters}
                onRenewSuccess={() => setSelectedContract(null)}
              />
            </Grid>
            <Grid item xs={12}>
              <ListContrats
                req="Contrats/get-contrats"
                filters={filters}
                onRenew={setSelectedContract}
                allowDelete={false}
              />
            </Grid>
          </Grid>
        </Stack>
      </Box>
    </QueryClientProvider>
  );
}

export default RenouvellementContrat;
