import { Box, Typography, Grid } from "@mui/material";
import { QueryClient, QueryClientProvider } from "react-query";
import { ClasseHoraireProvider } from "../helper/ClasseHoraireContext";
import { Item } from "../helper/Item/Item";
import PosteHoraireList from "./PosteHoraireList";
import SaisieClasseHoraire from "./Saisie/SaisieClasseHoraire";
import PeriodiciteNew from "./Periodicite/PeriodiciteNew";

export default function ClasseHoraire() {
  const queryClient = new QueryClient();
  
  return (
    <QueryClientProvider client={queryClient}>
      <ClasseHoraireProvider>
        <Content />
      </ClasseHoraireProvider>
    </QueryClientProvider>
  );
}

function Content() {
  return (
    <Box height={'85vh'}>
      <Typography
        className='basic-info-title'
        variant="h6"
        component="div"
        gutterBottom
        color="primary"
        sx={{
          fontFamily: "'San Francisco', -apple-system, BlinkMacSystemFont, 'Helvetica Neue', Arial, sans-serif",
          fontWeight: "600",  
          fontSize: "1.25rem", 
          lineHeight: 1.5,
        }}
      >
        Classes Horaires
      </Typography>

      <Grid container spacing={0.5}>
        <Grid item xs={12} ml={7}>
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
