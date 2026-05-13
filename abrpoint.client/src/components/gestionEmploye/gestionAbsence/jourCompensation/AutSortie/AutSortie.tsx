import { Box, Grid } from "@mui/material";
import SaisieAutSortie from "./Saisie/SaisieAutSortie";
import AutoriserList from "./AutList/AutList";
import { SortieGeneralProvider } from "../../../../helper/SortieGeneralContext";
import BreadcrumbNavigation from "../../../../helper/BreadcrumbNavigation";

export default function AutSortie()
{
    return(
        <>
        <Box sx={{ flexGrow: 1 }} height={'90vh'} width={'95vw'}>
            
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
        </>
    )
}