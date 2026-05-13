import Box from '@mui/material/Box';
import Grid from '@mui/material/Grid';
import EmpPeriodique from './EmpPeriodique';
import EmpEtatPeriodique from './EmpEtatPeriodique';
import { EmployeeProvider } from './EmployeeContext';
import { DateRangeProvider } from './FilterContext';
import { Item } from '../../helper/Item/Item';
import EmpPoste from './EmpPoste';
import BreadcrumbNavigation from '../../helper/BreadcrumbNavigation';
import FilterEtatPeriodique from './FilterEtatPeriodique';

export default function EtatPeriodique() {
    return (
        <Box width={"95vw"} height={'95vh'} sx={{ flexGrow: 1 }} >
                    <BreadcrumbNavigation />
                <Grid container spacing={1}>
                    <DateRangeProvider>
                        <EmployeeProvider>
                        <Grid item xs={12}>
                            <Item><FilterEtatPeriodique /></Item>
                        </Grid>
                        <Grid item xs={4.5} >
                            <EmpPeriodique />
                        </Grid>
                        <Grid item xs={7.5}>
                        <EmpEtatPeriodique />
                            </Grid>
                            <Grid item xs={12}>
                                <Item><EmpPoste /></Item>
                            </Grid>
                        </EmployeeProvider>
                    </DateRangeProvider>
                </Grid>
            </Box>
    );
}
