import { Box } from '@mui/material';
import './Fonction.css';
import { QueryClient, QueryClientProvider } from 'react-query';
import FonctionList from './FonctionList';
import BreadcrumbNavigation from '../../helper/BreadcrumbNavigation';



export function Fonction() {

    const queryClient = new QueryClient();

    return (
        <QueryClientProvider client={queryClient}>
        <Box sx={{width:'95vw', height:'90vh', marginTop:'-50px'}} >
        <BreadcrumbNavigation />
                {/* <FonctionForm /> */}
                <FonctionList />
        </Box>
        </QueryClientProvider>
    );
}
