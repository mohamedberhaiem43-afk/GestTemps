import { Container } from '@mui/material';
import './Fonction.css';
import { QueryClient, QueryClientProvider } from 'react-query';
import FonctionList from './FonctionList';
import BreadcrumbNavigation from '../../helper/BreadcrumbNavigation';



export function Fonction() {

    const queryClient = new QueryClient();

    return (
        <QueryClientProvider client={queryClient}>
        <Container>
            <BreadcrumbNavigation />
                {/* <FonctionForm /> */}
                <FonctionList />
        </Container>
        </QueryClientProvider>
    );
}
