import { Typography, Container } from '@mui/material';
import './Fonction.css';
import { QueryClient, QueryClientProvider } from 'react-query';
import FonctionList from './FonctionList';



export function Fonction() {

    const queryClient = new QueryClient();

    return (
        <QueryClientProvider client={queryClient}>
        <Container>
            {<Typography fontWeight={'bold'} variant="h6" color={'primary'}>Gestion des Fonctions</Typography>}
                {/* <FonctionForm /> */}
                <FonctionList />
        </Container>
        </QueryClientProvider>
    );
}
