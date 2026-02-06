import { Box, Grid } from "@mui/material";
import SaisieJourCompensation from "./Saisie/SaisieJourCompensation";
import CompensationList from "./Liste/CompensationList";
import { QueryClient, QueryClientProvider } from "react-query";
import { CompensationProvider } from "../../../helper/CompensationContext";
import BreadcrumbNavigation from "../../../helper/BreadcrumbNavigation";



export default function JourDeCompensation()
{
    const queryClient = new QueryClient();
    return(
        <>
        <QueryClientProvider client={queryClient}>
         <Box sx={{ flexGrow: 1 }} width={'95vw'} height={'90vh'} mt={-10}>
        <BreadcrumbNavigation />
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