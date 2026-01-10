import { Box } from '@mui/material';
import "./Societe.css";
import { SaisieSociete } from './SaisieSociete';
import { QueryClient, QueryClientProvider } from 'react-query';
import { SocieteList } from './SocieteList';
import BreadcrumbNavigation from '../../helper/BreadcrumbNavigation';

export function Societe() {
   
   const queryClient = new QueryClient();
    return (
        <>
        <QueryClientProvider client={queryClient}>
        <Box style={{minWidth:'90vw'}} height={'90vh'}>
                <BreadcrumbNavigation />
                <SaisieSociete />
                <SocieteList />
        </Box>
        </QueryClientProvider>
        </>
    );
}
