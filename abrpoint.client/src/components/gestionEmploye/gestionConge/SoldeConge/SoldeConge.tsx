import { Box, Grid } from '@mui/material';
import SoldeForm from './SoldeCongeForme';
import SoldeList from './ListeSoldeConge';
import { SoldeProvider } from '../../../helper/SoldeContext';
export default function  SoldeConge (){

  return (
    <Box sx={{ flexGrow: 1 }} width={'90vw'} height={'90vh'} >
          <SoldeProvider>
            <Grid container item xs={12} >
                <SoldeForm  />
            </Grid>
            <Grid container item xs={12}>
                <SoldeList />
            </Grid>
          </SoldeProvider>
        </Box>
  );
};

