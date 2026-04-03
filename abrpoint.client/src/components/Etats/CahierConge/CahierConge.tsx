import Box from '@mui/material/Box';
import Grid from '@mui/material/Grid';
import { Item } from '../../helper/Item/Item';
import { EmployeeProvider } from '../../Pointeuse/EtatPeriodique/EmployeeContext';
import { DateRangeProvider } from '../../Pointeuse/EtatPeriodique/FilterContext';
import { QueryClient, QueryClientProvider } from 'react-query';
import FilterCahierConge from './FilterCahierConge';
import ListeCahierConge from './ListeCahierConge';
import BreadcrumbNavigation from '../../helper/BreadcrumbNavigation';


export default function CahierConge() {
    const queryClient = new QueryClient();
    return (
        <QueryClientProvider client={queryClient}>
            <Box width={"97vw"} height={'83vh'} sx={{ flexGrow: 1 }} mt={-2}>
                    <BreadcrumbNavigation />
                <Grid container spacing={2}>
                    <EmployeeProvider>
                    <DateRangeProvider>
                        <Grid item xs={12}>
                            <Item>
                                <FilterCahierConge />
                            </Item>
                        </Grid>
                        <Grid item xs={12} >
                            <ListeCahierConge />
                        </Grid>
                    </DateRangeProvider>
                    </EmployeeProvider>
                </Grid>
            </Box>
        </QueryClientProvider>
    );
}
