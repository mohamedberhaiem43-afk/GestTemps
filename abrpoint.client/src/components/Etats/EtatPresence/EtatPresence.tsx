import Box from '@mui/material/Box';
import Grid from '@mui/material/Grid';
import EmpPresence from './EmpPresence';
import { Item } from '../../helper/Item/Item';
import { DateRangeProvider } from '../../Pointeuse/EtatPeriodique/FilterContext';
import FilterPresence from './FilterPresence';
import { QueryClient, QueryClientProvider } from 'react-query';
import BreadcrumbNavigation from '../../helper/BreadcrumbNavigation';


export default function EtatPresence() {
    const queryClient = new QueryClient();
    return (
        <QueryClientProvider client={queryClient} >

        <Box width={"95vw"} height={'95vh'} ml={5} mt={-10} sx={{ flexGrow: 1 }}>
                <BreadcrumbNavigation />
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
