import { Box, Grid } from "@mui/material";
import { ClasseHoraireProvider } from "../helper/ClasseHoraireContext";
import { Item } from "../helper/Item/Item";
import PosteHoraireList from "./PosteHoraireList";
import SaisieClasseHoraire from "./Saisie/SaisieClasseHoraire";
import PeriodiciteNew from "./Periodicite/PeriodiciteNew";
import BreadcrumbNavigation from "../helper/BreadcrumbNavigation";

export default function ClasseHoraire() {
  return (
    <ClasseHoraireProvider>
        <Content />
      </ClasseHoraireProvider>
  );
}

function Content() {
  return (
    <Box height={'90vh'}>
      <BreadcrumbNavigation />

      <Grid container spacing={0.5}>
        <Grid item xs={12} >
          <Item>
            <SaisieClasseHoraire />
          </Item>
        </Grid>

        <Grid item xs={5}>
          <PeriodiciteNew />
        </Grid>

        <Grid item xs={7}>
          <PosteHoraireList />
        </Grid>
      </Grid>
    </Box>
  );
}
