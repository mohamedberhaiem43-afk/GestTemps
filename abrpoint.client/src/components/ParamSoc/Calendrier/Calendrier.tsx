import { Box, Grid } from "@mui/material"
import { QueryClient, QueryClientProvider } from "react-query"
import CumulHeuresMensuelle from "./CumulHeuresMensuelle";
import SocieteCalendrier from "./SocieteCalendrier";
import { CalendrierProvider } from "../../helper/CalendrierContext";

function Calendrier() {
    const queryClient = new QueryClient();
  return (
    <QueryClientProvider client={queryClient}>
        <CalendrierProvider>
            <Box sx={{ flexGrow: 1 }} ml={7}  mt={-5} width={'92vw'} >
                <Grid container item xs={12} mt={1}>
                    <SocieteCalendrier />
                </Grid>
                <Grid container item xs={12} mt={1}>
                    <CumulHeuresMensuelle />
                </Grid>
            </Box>
        </CalendrierProvider>
    </QueryClientProvider>
  )
}

export default Calendrier