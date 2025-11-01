import Box from '@mui/material/Box';
import Grid from '@mui/material/Grid';
import { Typography } from '@mui/material';
import EmpPresence from './EmpPresence';
import { Item } from '../../helper/Item/Item';
import { DateRangeProvider } from '../../Pointeuse/EtatPeriodique/FilterContext';
import FilterPresence from './FilterPresence';
import { QueryClient, QueryClientProvider } from 'react-query';



export default function EtatPresence() {
    const queryClient = new QueryClient();
    return (
        <QueryClientProvider client={queryClient} >

        <Box width={"95vw"} height={'83vh'} ml={5} sx={{ flexGrow: 1 }}>
                <Typography variant='h6' color={'primary'} fontWeight={'bold'} mb={2}>
                    Etat de Présence
                </Typography>
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
