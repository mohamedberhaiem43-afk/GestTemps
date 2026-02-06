import { QueryClient, QueryClientProvider } from 'react-query';
import { Box, Grid } from '@mui/material';
import ListCongeGeneral from './ListCongeGeneral';
import TitreCongeForm from '../TitreConge/Saisie/SaisieTitreConge';
import { CongeProvider } from '../../../helper/CongeContext';


const queryClient = new QueryClient();
export default function  CongeGneral (){

  return (
    <QueryClientProvider client={queryClient}>
        <Box sx={{ flexGrow: 1 }} height={'90vh'} mt={-10}>
            <CongeProvider>
              <Grid item xs={12}>
                  <TitreCongeForm titre="Titre de Congés Génerale" />
              </Grid>
              <Grid item xs={12} mt={1}>
                  <ListCongeGeneral />
              </Grid>
            </CongeProvider>
        </Box>
    </QueryClientProvider>
  );
};

