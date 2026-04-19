import Box from '@mui/material/Box';
import Grid from '@mui/material/Grid';
import EmpPresence from './EmpPresence';
import { Item } from '../../helper/Item/Item';
import { DateRangeProvider } from '../../Pointeuse/EtatPeriodique/FilterContext';
import FilterPresence from './FilterPresence';
import { QueryClient, QueryClientProvider } from 'react-query';
import { useAuth } from '../../helper/AuthProvider';
import AccessDenied from '../../helper/AccessDenied';


export default function EtatPresence() {
  const queryClient = new QueryClient();
  const { hasPermission } = useAuth();

  if (!hasPermission('Rapports et Statistiques', 'consult')) {
    return <AccessDenied message="Vous n'avez pas le droit de consulter l'état de présence." />;
  }

  return (
    <QueryClientProvider client={queryClient} >

        <Box width={"75vw"} height={'95vh'} sx={{ flexGrow: 1, overflowX: 'hidden', px: 1 }}>
            <Grid container spacing={2}>
                <DateRangeProvider>
                    <Grid item xs={12}>
                        <Item><FilterPresence /></Item>
                    </Grid>

                    {/* <EmployeeProvider> */}
                    <Grid item xs={12} >
                        <EmpPresence />
                    </Grid>
                    {/* </EmployeeProvider> */}
                </DateRangeProvider>
            </Grid>
        </Box>
        </QueryClientProvider>
    );
}
