import { Box, Grid } from '@mui/material';
import ListContrats from './ListContrats';
import './GestionContrats.css';
import SaisieContrat from './SaisieContrat';
import { QueryClient, QueryClientProvider } from 'react-query';
import { Item } from '../../helper/Item/Item';
import { useState } from 'react';
import BreadcrumbNavigation from '../../helper/BreadcrumbNavigation';

// Define the Contrat type to match ListContrats
type Contrat = {
  soccod: string;
  concod: string;
  empcod: string;
  condat?: Date | string;
  empemb?: Date | string;
  empsort?: Date | string;
  conmois?: number;
  contype?: string;
  sitcod?: string;
};

const GestionContrats = () => {
  const queryClient = new QueryClient();
  // Change the type from null to Contrat | null
  const [editingContract, setEditingContract] = useState<Contrat | null>(null);

  return (
    <QueryClientProvider client={queryClient}>
      <Box height={'90vh'} width={'95vw'} mt={-10}>
        <BreadcrumbNavigation />

        <Grid>
          <Item>
            <SaisieContrat 
              editingContract={editingContract} 
              setEditingContract={setEditingContract} 
            />
          </Item>
        </Grid>
        <Grid mt={2}>
          <ListContrats 
            req="Contrats/get-contrats" 
            filters={undefined}
            onEdit={setEditingContract}
          />
        </Grid>
      </Box>
    </QueryClientProvider>
  );
}

export default GestionContrats;