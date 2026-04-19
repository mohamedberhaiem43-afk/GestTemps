import Box from '@mui/material/Box';
import Grid from '@mui/material/Grid';
import EmpRetard from './EmpRetard';
import { Item } from '../../helper/Item/Item';
import { EmployeeProvider } from '../../Pointeuse/EtatPeriodique/EmployeeContext';
import { DateRangeProvider } from '../../Pointeuse/EtatPeriodique/FilterContext';
import FilterRetard from './FilterRetard';
import { QueryClient, QueryClientProvider } from 'react-query';
import { useAuth } from '../../helper/AuthProvider';
import AccessDenied from '../../helper/AccessDenied';


export default function EtatRetard() {
    const queryClient = new QueryClient();
    const { hasPermission } = useAuth();

    if (!hasPermission('Rapports et Statistiques', 'consult')) {
        return <AccessDenied message="Vous n'avez pas le droit de consulter l'état de retard." />;
    }

    return (
        <QueryClientProvider client={queryClient}>

            <Box width={"80vw"} height={'90vh'} sx={{ flexGrow: 1, overflowX: 'hidden', px: 1 }}>
                <Grid container spacing={2}>
                    <EmployeeProvider>
                        <DateRangeProvider>
                            <Grid item xs={12}>
                                <Item><FilterRetard /></Item>
                            </Grid>

                            <Grid item xs={12} >
                                <EmpRetard />
                            </Grid>
                        </DateRangeProvider>
                    </EmployeeProvider>
                </Grid>
            </Box>
        </QueryClientProvider>
    );
}
