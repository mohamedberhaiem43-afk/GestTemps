import Box from '@mui/material/Box';
import Grid from '@mui/material/Grid';
import EmpRetard from './EmpRetard';
import { Item } from '../../helper/Item/Item';
import { EmployeeProvider } from '../../Pointeuse/EtatPeriodique/EmployeeContext';
import { DateRangeProvider } from '../../Pointeuse/EtatPeriodique/FilterContext';
import FilterRetard from './FilterRetard';
import { QueryClient, QueryClientProvider } from 'react-query';
import BreadcrumbNavigation from '../../helper/BreadcrumbNavigation';


export default function EtatRetard() {
    const queryClient = new QueryClient();
    return (
        <QueryClientProvider client={queryClient}>

        <Box width={"90vw"} height={'83vh'} ml={5} sx={{ flexGrow: 1 }}>
                <BreadcrumbNavigation />
            <Grid container spacing={2}>
                <DateRangeProvider>
                    <EmployeeProvider>
                    <Grid item xs={12}>
                        <Item><FilterRetard /></Item>
                    </Grid>

                    <Grid item xs={12} >
                        <EmpRetard />
                    </Grid>
                    </EmployeeProvider>
                </DateRangeProvider>
            </Grid>
        </Box>
        </QueryClientProvider>
    );
}
