import { Box, Grid, Typography } from "@mui/material";
import SaisieIntitule from "./SaisieIntitule/SaisieIntitule";
import AbsenceList from "./IntituleDesAbsenceList";
import { QueryClient, QueryClientProvider } from "react-query";
import './IntituleDesAbsence.css'
import { AbsenceProvider } from "../../helper/AbsenceContext";
import { Item } from "../../helper/Item/Item";

export default function IntituleDesAbsences() {
    const queryClient = new QueryClient();
    return (
        <QueryClientProvider client={queryClient}>
            <Box height={'85vh'}>
                <Typography fontWeight={'bold'} variant="h6" component="div" gutterBottom color={'primary'} mb={2}>
                    Intitulé des Absences
                </Typography>
                <AbsenceProvider>
                    <Grid container spacing={2}>
                        <Grid item xs={12}>
                            <Item>
                                <SaisieIntitule />
                            </Item>
                        </Grid>
                        <Grid item xs={12}>
                            <AbsenceList />
                        </Grid>
                    </Grid>
                </AbsenceProvider>
            </Box>
        </QueryClientProvider>
    )
}