import { Box } from '@mui/material';
import './Fonction.css';
import FonctionList from './FonctionList';
import BreadcrumbNavigation from '../../helper/BreadcrumbNavigation';

export function Fonction() {
    return (
        <Box sx={{width:'95vw', height:'90vh', marginTop:'-20px'}} >
        <BreadcrumbNavigation />
                {/* <FonctionForm /> */}
                <FonctionList />
        </Box>
    );
}
