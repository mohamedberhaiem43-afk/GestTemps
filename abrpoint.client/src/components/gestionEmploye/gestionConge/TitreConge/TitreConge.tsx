import { QueryClient, QueryClientProvider } from 'react-query';
import { Box, Grid } from '@mui/material';
import TitreCongeForm from './Saisie/SaisieTitreConge';
import TitreCongeList from './List/ListTitreConge';
import { CongeProvider } from '../../../helper/CongeContext';


const queryClient = new QueryClient();
export default function  TitreConge (){

  return (
    <QueryClientProvider client={queryClient}>
        <Box sx={{ flexGrow: 1 }} height={'90vh'} width={'95vw'} mt={-10} >
          <CongeProvider>
            <Grid item xs={12}>
              <TitreCongeForm titre="Titre de Congés" />
            </Grid>
            <Grid item xs={12}>
              <TitreCongeList />
            </Grid>
          </CongeProvider>  
        </Box>
    </QueryClientProvider>
  );
};

