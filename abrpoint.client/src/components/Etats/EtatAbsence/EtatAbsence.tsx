import Box from '@mui/material/Box';
import Grid from '@mui/material/Grid';
import { Item } from '../../helper/Item/Item';
import { EmployeeProvider } from '../../Pointeuse/EtatPeriodique/EmployeeContext';
import { DateRangeProvider } from '../../Pointeuse/EtatPeriodique/FilterContext';
import FilterPeriode from '../../Pointeuse/EtatPeriodique/FilterPeriode';
import ListeAbsence from './ListeAbsence';
import { QueryClient, QueryClientProvider } from 'react-query';
import { AbsParamsProvider } from '../../helper/AbsParamsContext';
import BreadcrumbNavigation from '../../helper/BreadcrumbNavigation';


export default function EtatAbsence() {
    const queryClient = new QueryClient();
    return (
        <QueryClientProvider client={queryClient}>
            <Box width={"97vw"} height={'90vh'} sx={{ flexGrow: 1 }} mt={-10}>
                    <BreadcrumbNavigation />
                <Grid container spacing={2}>
                    <EmployeeProvider>
                    <DateRangeProvider>
                    <AbsParamsProvider>
                        <Grid item xs={12}>
                            <Item><FilterPeriode type={'absence'} /></Item>
                        </Grid>
                        <Grid item xs={12} >
                            <ListeAbsence />
                        </Grid>
                    </AbsParamsProvider>
                    </DateRangeProvider>
                    </EmployeeProvider>
                </Grid>
            </Box>
        </QueryClientProvider>
    );
}
