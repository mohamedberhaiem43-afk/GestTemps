import { QueryClient, QueryClientProvider } from 'react-query';
import { Box, Grid } from '@mui/material';
import SoldeForm from './SoldeCongeForme';
import SoldeList from './ListeSoldeConge';
import { SoldeProvider } from '../../../helper/SoldeContext';


const queryClient = new QueryClient();
export default function  SoldeConge (){

  return (
    <QueryClientProvider client={queryClient}>
        <Box sx={{ flexGrow: 1 }} ml={7}  mt={-5} width={'90vw'} >
          <SoldeProvider>
            <Grid container item xs={12} >
                <SoldeForm  />
            </Grid>
            <Grid container item xs={12}>
                <SoldeList />
            </Grid>
          </SoldeProvider>
        </Box>
    </QueryClientProvider>
  );
};

