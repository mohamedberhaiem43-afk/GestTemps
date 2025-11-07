import { Box, Grid, Typography } from "@mui/material";
import AbsenceSanctionSaisie from "./Saisie/AbsenceSanctionSaisie";
import AbsenceSanctionList from "./List/AbsenceSanctionList";
import { QueryClient, QueryClientProvider } from "react-query";
import { SanctionProvider } from "../../../../helper/SanctionContext";


export default function AbsanceSanction()
{
    const queryClient = new QueryClient();
    return(
        <>
        <QueryClientProvider client={queryClient}>
         <Box sx={{ flexGrow: 1 }} height={'90vh'} width={'95vw'}>
            <Typography fontWeight={'bold'} variant="h6" gutterBottom color={'primary'} >
                Absences et Sanctions
            </Typography>
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
        </QueryClientProvider>
        </>
    )
}