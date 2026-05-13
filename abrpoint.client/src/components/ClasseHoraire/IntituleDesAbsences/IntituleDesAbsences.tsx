import { Box, Grid } from "@mui/material";
import SaisieIntitule from "./SaisieIntitule/SaisieIntitule";
import AbsenceList from "./IntituleDesAbsenceList";
import { AbsenceProvider } from "../../helper/AbsenceContext";
import { Item } from "../../helper/Item/Item";
import BreadcrumbNavigation from "../../helper/BreadcrumbNavigation";

export default function IntituleDesAbsences() {
    return (
        <Box height={'90vh'} >
                <BreadcrumbNavigation />
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
    )
}