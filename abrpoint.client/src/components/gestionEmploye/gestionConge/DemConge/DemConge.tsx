import { QueryClient, QueryClientProvider } from 'react-query';
import CongeList from './ListConge';
import CongeForm from './CongeInputs';
import { Box, Grid } from '@mui/material';
import { CongeProvider } from '../../../helper/CongeContext';



const queryClient = new QueryClient();
export default function  DemConge (){

  return (
    <QueryClientProvider client={queryClient}>
        <Box sx={{ flexGrow: 1 }} width={'95vw'} height={'95vh'}>
          <CongeProvider>
            <Grid item xs={12} >
                <CongeForm />
            </Grid>
            <Grid item xs={12} mt={3}>
                <CongeList />
            </Grid>
          </CongeProvider>
        </Box>
    </QueryClientProvider>
  );
};

