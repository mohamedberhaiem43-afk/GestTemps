import { Box, Grid, Typography } from '@mui/material';
import ListContrats from './ListContrats';
import './GestionContrats.css';
import SaisieContrat from './SaisieContrat';
import { QueryClient, QueryClientProvider } from 'react-query';
import { Item } from '../../helper/Item/Item';

const GestionContrats = () => {
  
const queryClient = new QueryClient();
  return (
    <QueryClientProvider client={queryClient}>
      <Box height={'90vh'} width={'95vw'}>
      <Typography variant="h6" color={'primary'} textAlign="center" fontWeight={'bold'} gutterBottom>
        Gestion De Contrats
      </Typography>

        <Grid>
          <Item>
            <SaisieContrat />
          </Item>
        </Grid>
        <Grid mt={2}>
          <ListContrats req="Contrats/get-contrats"  filters={undefined}/>
        </Grid>

      </Box>
    </QueryClientProvider>
  );
}
export default GestionContrats
