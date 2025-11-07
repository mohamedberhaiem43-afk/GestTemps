import { Box, Grid, Typography } from "@mui/material";
import SaisieJourCompensation from "./Saisie/SaisieJourCompensation";
import CompensationList from "./Liste/CompensationList";
import './JourCompensation.css'
import { QueryClient, QueryClientProvider } from "react-query";
import { CompensationProvider } from "../../../helper/CompensationContext";



export default function JourDeCompensation()
{
    const queryClient = new QueryClient();
    return(
        <>
        <QueryClientProvider client={queryClient}>
         <Box sx={{ flexGrow: 1 }} width={'95vw'} height={'90vh'}>
            <Typography fontWeight={'bold'} variant="h6" gutterBottom color={'primary'}>
                Jour de Compensation
            </Typography>
                <Grid container >
                 <CompensationProvider>

                    <Grid item xs={12} >
                       <SaisieJourCompensation />
                    </Grid>
                    <Grid item xs={12}>
                        <CompensationList />
                    </Grid>
                 </CompensationProvider>
            </Grid>
            </Box>
        </QueryClientProvider>
        </>
    )
}