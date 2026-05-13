import { Box, Grid } from "@mui/material";
import AbsenceSanctionSaisie from "./Saisie/AbsenceSanctionSaisie";
import AbsenceSanctionList from "./List/AbsenceSanctionList";
import { SanctionProvider } from "../../../../helper/SanctionContext";
import BreadcrumbNavigation from "../../../../helper/BreadcrumbNavigation";

export default function AbsanceSanction()
{
    return(
        <>
        <Box sx={{ flexGrow: 1 }} height={'90vh'} width={'95vw'}>
            
             <BreadcrumbNavigation />
                <Grid container >
                    <SanctionProvider>
                        <Grid item xs={12}>
                            <AbsenceSanctionSaisie />
                        </Grid>
                        <Grid item xs={12}>
                            <AbsenceSanctionList />
                        </Grid>
                    </SanctionProvider>
               
            </Grid>
            </Box>
        </>
    )
}