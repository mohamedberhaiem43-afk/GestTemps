import Box from '@mui/material/Box';
import Grid from '@mui/material/Grid';
import { Typography } from '@mui/material';
import EmpRetard from './EmpRetard';
import { Item } from '../../helper/Item/Item';
import { EmployeeProvider } from '../../Pointeuse/EtatPeriodique/EmployeeContext';
import { DateRangeProvider } from '../../Pointeuse/EtatPeriodique/FilterContext';
import FilterRetard from './FilterRetard';
import { QueryClient, QueryClientProvider } from 'react-query';


export default function EtatRetard() {
    const queryClient = new QueryClient();
    return (
        <QueryClientProvider client={queryClient}>

        <Box width={"90vw"} height={'83vh'} ml={5} sx={{ flexGrow: 1 }}>
                <Typography variant='h6' color={'primary'} fontWeight={'bold'} mb={2}>
                    Etat des Retards
                </Typography>
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
