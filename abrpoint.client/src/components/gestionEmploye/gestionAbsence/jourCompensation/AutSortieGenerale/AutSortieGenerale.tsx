import { Box, Grid } from "@mui/material";
import AutoriserList from "../AutSortie/AutList/AutList";
import SaisieAutSortie from "../AutSortie/Saisie/SaisieAutSortie";
import { QueryClient, QueryClientProvider } from "react-query";
import { SortieGeneralProvider } from "../../../../helper/SortieGeneralContext";
import BreadcrumbNavigation from "../../../../helper/BreadcrumbNavigation";


export default function AutSortieGenerale()
{
    const queryClient = new QueryClient();
    return(
        <>
        <QueryClientProvider client={queryClient}>

         <Box sx={{ flexGrow: 1 }} height={'90vh'} width={'95vw'}>
                    <BreadcrumbNavigation />
                <Grid container >
                    <SortieGeneralProvider>
                        <Grid item xs={12} >
                        <SaisieAutSortie type='generale'/>
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