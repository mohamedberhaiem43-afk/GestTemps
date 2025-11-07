import { Typography, Box } from '@mui/material';
import "./Societe.css";
import { SaisieSociete } from './SaisieSociete';
import { QueryClient, QueryClientProvider } from 'react-query';
import { SocieteList } from './SocieteList';

export function Societe() {
   
   const queryClient = new QueryClient();
    return (
        <>
        <QueryClientProvider client={queryClient}>
        <Box style={{minWidth:'90vw'}} height={'90vh'}>

                <Typography mb={2} variant='h6' color={'primary'} fontWeight={'bold'}>Gestion des sociétés</Typography>
                <SaisieSociete />
                <SocieteList />
        </Box>
        </QueryClientProvider>
        </>
    );
}
