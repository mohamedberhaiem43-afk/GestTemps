import { Box, Grid } from "@mui/material";
import SaisieAutSortie from "./Saisie/SaisieAutSortie";
import AutoriserList from "./AutList/AutList";
import { QueryClient, QueryClientProvider } from "react-query";
import { SortieGeneralProvider } from "../../../../helper/SortieGeneralContext";
import BreadcrumbNavigation from "../../../../helper/BreadcrumbNavigation";



export default function AutSortie()
{
    const queryClient = new QueryClient();
    return(
        <>
        <QueryClientProvider client={queryClient}>

         <Box sx={{ flexGrow: 1 }} height={'90vh'} width={'95vw'} mt={-10}>
            
            <BreadcrumbNavigation />
            <Grid container >
                <SortieGeneralProvider>
                    <Grid item xs={12}>
                       <SaisieAutSortie type='speciale' />
                    </Grid>
                <Grid item xs={12} >
                    <AutoriserList />
                </Grid>
                </SortieGeneralProvider>
            </Grid>
            </Box>
        </QueryClientProvider>
        </>
    )
}